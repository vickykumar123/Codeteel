"use client";

import type { Plan } from "@/lib/agents/types";

interface PlanApprovalProps {
  plan: Plan;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
  workingBranch?: string | null;
  onSelectBranch?: () => void;
}

export function PlanApproval({
  plan,
  onApprove,
  onReject,
  isLoading,
  workingBranch,
  onSelectBranch,
}: PlanApprovalProps) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-yellow-600 dark:text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Implementation Plan
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Review and approve this plan to execute the changes
            </p>
          </div>
          <span className="px-2 py-1 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 text-xs font-medium rounded">
            Pending Approval
          </span>
        </div>

        {/* Plan Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            {plan.title}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {plan.summary}
          </p>

          {/* Steps */}
          <div className="space-y-3">
            <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Steps ({plan.steps.length})
            </h5>
            {plan.steps.map((step, index) => (
              <div
                key={step.id}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                        step.type === "create"
                          ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400"
                          : step.type === "delete"
                          ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400"
                          : "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400"
                      }`}
                    >
                      {step.type.toUpperCase()}
                    </span>
                    <code className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {step.path}
                    </code>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Files Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>{plan.filesAffected.length}</strong> file(s) will be
              affected:{" "}
              <span className="text-gray-500">
                {plan.filesAffected.join(", ")}
              </span>
            </p>
          </div>
        </div>

        {/* Branch Selection / Info */}
        {workingBranch ? (
          <div className="flex items-start gap-3 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg mb-4">
            <svg
              className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
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
            <p className="text-sm text-green-800 dark:text-green-200">
              Changes will be committed to branch{" "}
              <code className="font-mono bg-green-200 dark:bg-green-800 px-1 rounded">
                {workingBranch}
              </code>
              . A pull request will be opened for review.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg mb-4">
            <svg
              className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-orange-800 dark:text-orange-200 mb-2">
                You must select a working branch before approving this plan.
              </p>
              {onSelectBranch && (
                <button
                  onClick={onSelectBranch}
                  className="text-sm font-medium text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100 underline"
                >
                  Select or create a branch →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onReject}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Reject Plan
          </button>
          <button
            onClick={onApprove}
            disabled={isLoading || !workingBranch}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            title={!workingBranch ? "Select a branch first" : undefined}
          >
            {isLoading ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Executing...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Approve & Execute
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
