"use client";

import { useState } from "react";
import type { ExecutionProgress, StepResult } from "@/hooks/useOrchestrator";

interface ExecutionProgressProps {
  progress: ExecutionProgress;
}

export function ExecutionProgressPanel({ progress }: ExecutionProgressProps) {
  const completedCount = progress.steps.filter(
    (s) => s.status === "completed"
  ).length;
  const failedCount = progress.steps.filter(
    (s) => s.status === "failed"
  ).length;
  const isDone = progress.status === "complete";

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-3xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isDone ? (
              <svg
                className="w-5 h-5 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            )}
            <h3 className="font-medium text-sm text-gray-900 dark:text-white">
              {isDone ? "Execution Complete" : "Executing Plan..."}
            </h3>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {completedCount}/{progress.totalSteps} completed
            {failedCount > 0 && (
              <span className="text-red-500 ml-1">({failedCount} failed)</span>
            )}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isDone
                ? failedCount > 0
                  ? "bg-yellow-500"
                  : "bg-green-500"
                : "bg-blue-500"
            }`}
            style={{
              width: `${
                progress.totalSteps > 0
                  ? ((completedCount + failedCount) / progress.totalSteps) * 100
                  : 0
              }%`,
            }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {progress.steps.map((step) => (
            <StepItem key={step.stepId} step={step} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepItem({ step }: { step: StepResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = step.diff && (step.diff.oldString || step.diff.newString);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Step header */}
      <button
        onClick={() => hasDiff && setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm ${
          hasDiff ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" : "cursor-default"
        }`}
      >
        {/* Status icon */}
        <span className="flex-shrink-0">
          {step.status === "completed" && (
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {step.status === "failed" && (
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {step.status === "in_progress" && (
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          )}
          {step.status === "pending" && (
            <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
          )}
        </span>

        {/* Step info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              {step.stepIndex + 1}.
            </span>
            {step.path && (
              <code className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
                {step.path}
              </code>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {step.description}
          </p>
        </div>

        {/* Expand arrow */}
        {hasDiff && (
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}

        {/* Error badge */}
        {step.status === "failed" && step.error && (
          <span className="text-xs text-red-500 truncate max-w-[200px]" title={step.error}>
            {step.error.slice(0, 50)}
          </span>
        )}
      </button>

      {/* Expanded diff */}
      {expanded && hasDiff && step.diff && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <DiffView oldString={step.diff.oldString} newString={step.diff.newString} />
        </div>
      )}
    </div>
  );
}

function DiffView({
  oldString,
  newString,
}: {
  oldString: string;
  newString: string;
}) {
  const oldLines = oldString.split("\n");
  const newLines = newString.split("\n");

  // For new files (no old content), show all as additions
  if (!oldString && newString) {
    return (
      <pre className="text-xs font-mono overflow-x-auto p-3 bg-gray-950 max-h-80 overflow-y-auto">
        {newLines.map((line, i) => (
          <div key={i} className="text-green-400">
            <span className="select-none text-green-600 mr-2">+</span>
            {line}
          </div>
        ))}
      </pre>
    );
  }

  // Simple diff: show removed lines then added lines
  return (
    <pre className="text-xs font-mono overflow-x-auto p-3 bg-gray-950 max-h-80 overflow-y-auto">
      {oldLines.map((line, i) => (
        <div key={`old-${i}`} className="text-red-400 bg-red-950/30">
          <span className="select-none text-red-600 mr-2">-</span>
          {line}
        </div>
      ))}
      {newLines.map((line, i) => (
        <div key={`new-${i}`} className="text-green-400 bg-green-950/30">
          <span className="select-none text-green-600 mr-2">+</span>
          {line}
        </div>
      ))}
    </pre>
  );
}
