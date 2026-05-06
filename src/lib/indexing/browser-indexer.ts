// Browser-side indexing loop
// Iterates through files sequentially: fetch → summarize → save
// Checks cancellation flag before each file
// Reports progress via callback

import { generateFileSummaryBrowser, type BrowserLLMConfig } from "./browser-summary";
import { getLanguageFromPath } from "@/lib/github";

export interface IndexFile {
  path: string;
  sha: string;
  size: number;
}

export interface IndexProgress {
  currentFile: string;
  processedFiles: number;
  failedFiles: number;
  totalFiles: number;
  phase: "fetching" | "summarizing" | "saving";
}

export interface IndexResult {
  processedFiles: number;
  failedFiles: number;
  totalFiles: number;
  failedPaths: Array<{ path: string; error: string }>;
}

export interface IndexerOptions {
  repoId: string;
  jobId: string;
  files: IndexFile[];
  llmConfig: BrowserLLMConfig;
  branch: string;
  onProgress: (progress: IndexProgress) => void;
  cancelRef: { current: boolean };
}

// Fetch file content from GitHub via our proxy
async function fetchFileContent(
  repoId: string,
  path: string,
  branch: string
): Promise<string> {
  const response = await fetch(
    `/api/repos/${repoId}/files?path=${encodeURIComponent(path)}&branch=${encodeURIComponent(branch)}`,
    { credentials: "include" }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch ${path} (${response.status})`);
  }

  const data = await response.json();
  return data.content;
}

// Save processed file to backend (upserts file_summaries + generates embedding server-side)
async function saveFile(
  repoId: string,
  jobId: string,
  file: IndexFile,
  code: string,
  summary: string
): Promise<number> {
  const response = await fetch(`/api/repos/${repoId}/index/save-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      jobId,
      path: file.path,
      code,
      summary,
      contentHash: file.sha,
      language: getLanguageFromPath(file.path),
      size: file.size,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to save ${file.path}`);
  }

  const data = await response.json();
  return data.processedFiles;
}

// Record a file failure
async function recordFailure(
  repoId: string,
  jobId: string,
  path: string,
  error: string
): Promise<void> {
  await fetch(`/api/repos/${repoId}/index/fail-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ jobId, path, error }),
  }).catch(() => {
    // Best effort — don't fail the loop if recording failure fails
  });
}

// Complete the indexing job
async function completeJob(repoId: string, jobId: string): Promise<void> {
  await fetch(`/api/repos/${repoId}/index/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ jobId }),
  });
}

// Pause the indexing job
async function pauseJob(repoId: string, jobId: string): Promise<void> {
  await fetch(`/api/repos/${repoId}/index/pause`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ jobId }),
  });
}

const CONCURRENCY = 2;

// Process a single file: fetch → summarize → save
async function processFile(
  repoId: string,
  jobId: string,
  file: IndexFile,
  llmConfig: BrowserLLMConfig,
  branch: string,
): Promise<{ success: boolean; error?: string }> {
  const code = await fetchFileContent(repoId, file.path, branch);

  let summary: string;
  try {
    summary = await generateFileSummaryBrowser(llmConfig, file.path, code);
  } catch (err) {
    // Retry once
    try {
      summary = await generateFileSummaryBrowser(llmConfig, file.path, code);
    } catch (retryErr) {
      const msg = retryErr instanceof Error ? retryErr.message : "LLM summary failed";
      return { success: false, error: msg };
    }
  }

  await saveFile(repoId, jobId, file, code, summary);
  return { success: true };
}

// Main indexing loop — runs in the browser, 2 files at a time
export async function runBrowserIndexer(options: IndexerOptions): Promise<IndexResult> {
  const { repoId, jobId, files, llmConfig, branch, onProgress, cancelRef } = options;

  let processedFiles = 0;
  let failedFiles = 0;
  const failedPaths: Array<{ path: string; error: string }> = [];

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    // Check cancellation before each batch
    if (cancelRef.current) {
      await pauseJob(repoId, jobId);
      return { processedFiles, failedFiles, totalFiles: files.length, failedPaths };
    }

    const batch = files.slice(i, i + CONCURRENCY);

    onProgress({
      currentFile: batch.map((f) => f.path).join(", "),
      processedFiles,
      failedFiles,
      totalFiles: files.length,
      phase: "summarizing",
    });

    // Process batch concurrently
    const results = await Promise.allSettled(
      batch.map((file) => processFile(repoId, jobId, file, llmConfig, branch))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled" && result.value.success) {
        processedFiles++;
      } else {
        const errorMsg =
          result.status === "rejected"
            ? result.reason instanceof Error ? result.reason.message : "Unknown error"
            : result.value.error || "Unknown error";
        failedFiles++;
        failedPaths.push({ path: batch[j].path, error: errorMsg });
        await recordFailure(repoId, jobId, batch[j].path, errorMsg);

        // Stop indexing on LLM errors — don't silently continue with broken summaries
        await pauseJob(repoId, jobId);
        return { processedFiles, failedFiles, totalFiles: files.length, failedPaths };
      }
    }
  }

  // All files processed — mark complete
  if (!cancelRef.current) {
    await completeJob(repoId, jobId);
  }

  return { processedFiles, failedFiles, totalFiles: files.length, failedPaths };
}
