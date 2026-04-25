"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useIndexer, type IndexerStatus } from "@/hooks/useIndexer";
import type { BrowserLLMConfig } from "@/lib/indexing/browser-summary";

interface IndexButtonProps {
  repoId: string;
  currentStatus: string;
  defaultBranch: string;
  llmProvider: string;
  llmBaseUrl?: string;
  llmModel?: string;
}

const phaseLabels: Record<string, string> = {
  fetching: "Fetching...",
  summarizing: "Summarizing...",
  saving: "Saving...",
};

export function IndexButton({
  repoId,
  currentStatus,
  defaultBranch,
  llmProvider,
  llmBaseUrl,
  llmModel,
}: IndexButtonProps) {
  const llmConfig: BrowserLLMConfig = { provider: llmProvider, baseUrl: llmBaseUrl, model: llmModel };
  const router = useRouter();

  const indexer = useIndexer({ repoId, defaultBranch, currentStatus, llmConfig });

  // Refresh server component data when indexing completes or fails
  const prevStatus = useRef(indexer.status);
  useEffect(() => {
    if (
      prevStatus.current === "indexing" &&
      (indexer.status === "completed" || indexer.status === "failed")
    ) {
      router.refresh();
    }
    prevStatus.current = indexer.status;
  }, [indexer.status, router]);

  const progressPercent =
    indexer.progress
      ? Math.round((indexer.progress.processedFiles / indexer.progress.totalFiles) * 100)
      : indexer.existingTotal > 0
        ? Math.round((indexer.existingProcessed / indexer.existingTotal) * 100)
        : 0;

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Progress bar during indexing */}
      {indexer.status === "indexing" && indexer.progress && (
        <div className="w-72 space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>
              {indexer.progress.processedFiles} / {indexer.progress.totalFiles} files
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 text-right truncate">
            {phaseLabels[indexer.progress.phase] || ""}{" "}
            <span className="font-mono">{indexer.progress.currentFile}</span>
            {indexer.progress.failedFiles > 0 && (
              <span className="text-red-500 ml-2">
                ({indexer.progress.failedFiles} failed)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Paused info */}
      {indexer.status === "paused" && indexer.existingTotal > 0 && (
        <div className="text-sm text-yellow-600 dark:text-yellow-400">
          Paused at {indexer.existingProcessed}/{indexer.existingTotal} files
        </div>
      )}

      {/* Completed result */}
      {indexer.status === "completed" && indexer.result && (
        <div className="text-sm text-green-600 dark:text-green-400">
          {indexer.result.totalFiles === 0
            ? "All files up to date"
            : `${indexer.result.processedFiles} files indexed`}
          {indexer.result.failedFiles > 0 && (
            <span className="text-red-500 ml-1">
              ({indexer.result.failedFiles} failed)
            </span>
          )}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        {indexer.status === "paused" && (
          <>
            <button
              onClick={indexer.resume}
              className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Resume
            </button>
            <button
              onClick={indexer.startFresh}
              className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Start Fresh
            </button>
          </>
        )}

        {indexer.status === "starting" && (
          <button
            disabled
            className="px-4 py-2 rounded-md text-sm font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 cursor-not-allowed flex items-center gap-2"
          >
            <span className="animate-spin w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full" />
            Starting...
          </button>
        )}

        {indexer.status === "indexing" && (
          <button
            onClick={indexer.cancel}
            className="px-4 py-2 rounded-md text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            Cancel
          </button>
        )}

        {(indexer.status === "idle" || indexer.status === "completed" || indexer.status === "failed") && (
          <button
            onClick={indexer.start}
            className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {renderButtonLabel(indexer.status, currentStatus)}
          </button>
        )}
      </div>

      {/* Error */}
      {indexer.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{indexer.error}</p>
      )}
    </div>
  );
}

function renderButtonLabel(status: IndexerStatus, repoStatus: string): string {
  if (status === "failed") return "Retry Indexing";
  if (status === "completed" || repoStatus === "ready") return "Re-index";
  return "Start Indexing";
}
