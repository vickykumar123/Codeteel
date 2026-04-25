"use client";

// useIndexer - React hook for browser-side repository indexing
//
// Responsibilities:
//   1. Start/Cancel/Resume indexing
//   2. Track progress (currentFile, processedFiles, phase)
//   3. Detect paused/processing jobs on mount → show Resume
//   4. beforeunload warning during active indexing
//   5. Progress is source of truth (no Supabase Realtime needed)

import { useState, useRef, useCallback, useEffect } from "react";
import { runBrowserIndexer, type IndexFile, type IndexProgress, type IndexResult } from "@/lib/indexing/browser-indexer";
import type { BrowserLLMConfig } from "@/lib/indexing/browser-summary";

export type IndexerStatus = "idle" | "starting" | "indexing" | "paused" | "completed" | "failed";

export interface IndexerState {
  status: IndexerStatus;
  progress: IndexProgress | null;
  result: IndexResult | null;
  error: string | null;
  // Info from existing job (for resume)
  existingJobId: string | null;
  existingProcessed: number;
  existingTotal: number;
}

export interface UseIndexerOptions {
  repoId: string;
  defaultBranch: string;
  currentStatus: string; // repo.index_status from server
  llmConfig: BrowserLLMConfig;
}

export function useIndexer(options: UseIndexerOptions) {
  const { repoId, defaultBranch, currentStatus, llmConfig } = options;

  const [state, setState] = useState<IndexerState>({
    // If repo status is "indexing" from DB, the browser isn't actively running — treat as paused until mount check
    status: currentStatus === "indexing" ? "paused" : "idle",
    progress: null,
    result: null,
    error: null,
    existingJobId: null,
    existingProcessed: 0,
    existingTotal: 0,
  });

  const cancelRef = useRef(false);
  const isRunningRef = useRef(false);

  // Check for existing paused/processing jobs on mount
  useEffect(() => {
    const checkExistingJob = async () => {
      try {
        const response = await fetch(`/api/repos/${repoId}/index`, { credentials: "include" });
        if (!response.ok) return;

        const data = await response.json();
        if (data.job && (data.job.status === "paused" || data.job.status === "processing")) {
          setState((prev) => ({
            ...prev,
            status: "paused",
            existingJobId: data.job.id,
            existingProcessed: data.job.processedFiles || 0,
            existingTotal: data.job.totalFiles || 0,
          }));
        }
      } catch {
        // Silently ignore — not critical
      }
    };

    checkExistingJob();
  }, [repoId]);

  // beforeunload warning during active indexing
  useEffect(() => {
    if (state.status !== "indexing" && state.status !== "starting") return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.status]);

  // Start indexing (fresh = true to ignore existing job)
  const start = useCallback(async (fresh = false) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    cancelRef.current = false;

    setState((prev) => ({
      ...prev,
      status: "starting",
      progress: null,
      result: null,
      error: null,
    }));

    try {
      // Call /start endpoint to get file list
      const response = await fetch(`/api/repos/${repoId}/index/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fresh }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to start indexing (${response.status})`);
      }

      const data = await response.json();
      const { jobId, files, totalFiles } = data as {
        jobId: string;
        files: IndexFile[];
        totalFiles: number;
      };

      if (totalFiles === 0) {
        // All files unchanged — finalize the job and mark ready
        await fetch(`/api/repos/${repoId}/index/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ jobId }),
        });
        setState((prev) => ({
          ...prev,
          status: "completed",
          result: { processedFiles: 0, failedFiles: 0, totalFiles: 0, failedPaths: [] },
        }));
        isRunningRef.current = false;
        return;
      }

      // Start processing
      setState((prev) => ({ ...prev, status: "indexing" }));

      const result = await runBrowserIndexer({
        repoId,
        jobId,
        files,
        llmConfig,
        branch: defaultBranch,
        onProgress: (progress) => {
          setState((prev) => ({ ...prev, progress }));
        },
        cancelRef,
      });

      setState((prev) => ({
        ...prev,
        status: cancelRef.current ? "paused" : result.failedFiles === result.totalFiles ? "failed" : "completed",
        progress: null,
        result,
        existingJobId: cancelRef.current ? jobId : null,
        existingProcessed: cancelRef.current ? result.processedFiles : 0,
        existingTotal: cancelRef.current ? result.totalFiles : 0,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "failed",
        error: err instanceof Error ? err.message : "Indexing failed",
      }));
    } finally {
      isRunningRef.current = false;
    }
  }, [repoId, defaultBranch, llmConfig]);

  // Cancel (pause) indexing
  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  // Resume from where we left off
  const resume = useCallback(() => {
    start(false);
  }, [start]);

  // Start fresh (ignore existing job)
  const startFresh = useCallback(() => {
    start(true);
  }, [start]);

  return {
    ...state,
    start: () => start(false),
    startFresh,
    cancel,
    resume,
  };
}
