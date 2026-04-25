"use client";

import { useState } from "react";
import type { BranchInfo, BranchSelectionResponse } from "@/lib/agents/types";

interface BranchModalProps {
  isOpen: boolean;
  availableBranches: BranchInfo[];
  suggestedName: string;
  defaultBase: string;
  protectedBranches: string[];
  onSelect: (selection: BranchSelectionResponse) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function BranchModal({
  isOpen,
  availableBranches,
  suggestedName,
  defaultBase,
  protectedBranches,
  onSelect,
  onCancel,
  isLoading = false,
}: BranchModalProps) {
  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [newBranchName, setNewBranchName] = useState(suggestedName);
  const [baseBranch, setBaseBranch] = useState(defaultBase);
  const [error, setError] = useState<string | null>(null);

  // Filter out protected branches for selection
  const selectableBranches = availableBranches.filter(
    (b) => !b.protected && !protectedBranches.includes(b.name)
  );

  // All branches available as base for new branch creation
  const baseBranches = availableBranches;

  const handleSubmit = () => {
    setError(null);

    if (mode === "select") {
      if (!selectedBranch) {
        setError("Please select a branch");
        return;
      }
      onSelect({
        action: "select_existing",
        branchName: selectedBranch,
      });
    } else {
      if (!newBranchName.trim()) {
        setError("Please enter a branch name");
        return;
      }
      // Validate branch name
      const branchNameRegex = /^[a-zA-Z0-9._/-]+$/;
      if (!branchNameRegex.test(newBranchName)) {
        setError("Invalid branch name. Use only letters, numbers, ., _, /, -");
        return;
      }
      onSelect({
        action: "create_new",
        branchName: newBranchName,
        baseBranch,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-xl">🌿</span>
          Select Working Branch
        </h2>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode("select")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === "select"
                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Select Existing
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === "create"
                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Create New
          </button>
        </div>

        {mode === "select" ? (
          /* Select Existing Branch */
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectableBranches.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                No branches available. Create a new branch to continue.
              </p>
            ) : (
              selectableBranches.map((branch) => (
                <label
                  key={branch.name}
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    selectedBranch === branch.name
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="branch"
                    value={branch.name}
                    checked={selectedBranch === branch.name}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="text-blue-600"
                  />
                  <span className="flex-1 text-sm text-gray-900 dark:text-white font-mono">
                    {branch.name}
                  </span>
                  {branch.aheadBy !== undefined && branch.aheadBy > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {branch.aheadBy} ahead
                    </span>
                  )}
                </label>
              ))
            )}

            {/* Show protected branches as disabled */}
            {availableBranches
              .filter((b) => b.protected || protectedBranches.includes(b.name))
              .map((branch) => (
                <div
                  key={branch.name}
                  className="flex items-center gap-3 p-3 rounded-md border border-gray-200 dark:border-gray-700 opacity-50"
                >
                  <input type="radio" disabled className="text-gray-400" />
                  <span className="flex-1 text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {branch.name}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    🔒 Protected
                  </span>
                </div>
              ))}
          </div>
        ) : (
          /* Create New Branch */
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Branch Name
              </label>
              <div className="flex items-center">
                <span className="text-gray-500 dark:text-gray-400 text-sm mr-1">
                  feature/
                </span>
                <input
                  type="text"
                  value={newBranchName.replace(/^feature\//, "")}
                  onChange={(e) =>
                    setNewBranchName(
                      e.target.value.startsWith("feature/")
                        ? e.target.value
                        : `feature/${e.target.value}`
                    )
                  }
                  placeholder="my-feature"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Full name: <code className="font-mono">{newBranchName}</code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Base Branch
              </label>
              <select
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {baseBranches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                    {protectedBranches.includes(branch.name) ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || (mode === "select" && selectableBranches.length === 0)}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing...
              </>
            ) : mode === "select" ? (
              "Select Branch"
            ) : (
              "Create & Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
