"use client";

import { useState, useEffect } from "react";
import type { BranchInfo, BranchSelectionResponse } from "@/lib/agents/types";

interface BranchModalProps {
  isOpen: boolean;
  availableBranches: BranchInfo[];
  suggestedName: string;
  defaultBase: string;
  protectedBranches: string[];
  onSelect: (selection: BranchSelectionResponse) => void | Promise<void>;
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
  const [submitting, setSubmitting] = useState(false);

  const selectableBranches = availableBranches.filter(
    (b) => !b.protected && !protectedBranches.includes(b.name)
  );
  const baseBranches = availableBranches;

  const handleSubmit = async () => {
    setError(null);
    if (mode === "select") {
      if (!selectedBranch) { setError("Please select a branch"); return; }
      setSubmitting(true);
      try {
        await onSelect({ action: "select_existing", branchName: selectedBranch });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to select branch");
        setSubmitting(false);
      }
    } else {
      if (!newBranchName.trim()) { setError("Please enter a branch name"); return; }
      if (!/^[a-zA-Z0-9._/-]+$/.test(newBranchName)) {
        setError("Invalid name. Use letters, numbers, ., _, /, -");
        return;
      }
      setSubmitting(true);
      try {
        await onSelect({ action: "create_new", branchName: newBranchName, baseBranch });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create branch");
        setSubmitting(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-[#1C1917] border border-[#292524] rounded-2xl shadow-2xl shadow-black/40 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#292524]">
          <h2 className="text-base font-semibold text-[#FAFAF9] flex items-center gap-2">
            <svg className="w-4.5 h-4.5 text-[#E8A87C]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
            </svg>
            Select Working Branch
          </h2>
          <p className="text-xs text-[#71717A] mt-1">Changes will be committed to this branch</p>
        </div>

        <div className="p-6">
          {/* Mode Toggle */}
          <div className="flex gap-1 p-1 bg-[#0C0A09] rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setMode("select")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                mode === "select"
                  ? "bg-[#E8A87C]/10 text-[#E8A87C] border border-[#E8A87C]/20"
                  : "text-[#A8A29E] hover:text-[#FAFAF9]"
              }`}
            >
              Select Existing
            </button>
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                mode === "create"
                  ? "bg-[#E8A87C]/10 text-[#E8A87C] border border-[#E8A87C]/20"
                  : "text-[#A8A29E] hover:text-[#FAFAF9]"
              }`}
            >
              Create New
            </button>
          </div>

          {mode === "select" ? (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {selectableBranches.length === 0 ? (
                <p className="text-sm text-[#71717A] py-6 text-center">
                  No branches available. Create a new one.
                </p>
              ) : (
                selectableBranches.map((branch) => (
                  <label
                    key={branch.name}
                    onClick={() => setSelectedBranch(branch.name)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedBranch === branch.name
                        ? "border-[#E8A87C] bg-[#E8A87C]/5"
                        : "border-[#292524] hover:border-[#3F3F46] hover:bg-[#292524]/50"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedBranch === branch.name ? "border-[#E8A87C]" : "border-[#3F3F46]"
                    }`}>
                      {selectedBranch === branch.name && (
                        <div className="w-2 h-2 rounded-full bg-[#E8A87C]" />
                      )}
                    </div>
                    <span className="flex-1 text-sm text-[#FAFAF9] font-mono truncate">
                      {branch.name}
                    </span>
                    {branch.aheadBy !== undefined && branch.aheadBy > 0 && (
                      <span className="text-[10px] text-[#71717A]">{branch.aheadBy} ahead</span>
                    )}
                  </label>
                ))
              )}

              {/* Protected branches */}
              {availableBranches
                .filter((b) => b.protected || protectedBranches.includes(b.name))
                .map((branch) => (
                  <div
                    key={branch.name}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#292524] opacity-40"
                  >
                    <div className="w-4 h-4 rounded-full border-2 border-[#3F3F46] flex-shrink-0" />
                    <span className="flex-1 text-sm text-[#71717A] font-mono">{branch.name}</span>
                    <span className="text-[10px] text-[#71717A] flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      Protected
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#A8A29E] mb-1.5">Branch Name</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-[#71717A] font-mono">feature/</span>
                  <input
                    type="text"
                    value={newBranchName.replace(/^feature\//, "")}
                    onChange={(e) =>
                      setNewBranchName(
                        e.target.value.startsWith("feature/") ? e.target.value : `feature/${e.target.value}`
                      )
                    }
                    placeholder="my-feature"
                    className="flex-1 px-3 py-2 bg-[#0C0A09] border border-[#292524] rounded-xl text-[#FAFAF9] text-sm font-mono placeholder-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#E8A87C]/40 focus:border-[#E8A87C]/40 transition-all"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-[#71717A]">
                  Full name: <code className="text-[#E8A87C]">{newBranchName}</code>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#A8A29E] mb-1.5">Base Branch</label>
                <select
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0C0A09] border border-[#292524] rounded-xl text-[#FAFAF9] text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A87C]/40 focus:border-[#E8A87C]/40 transition-all"
                >
                  {baseBranches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name}{protectedBranches.includes(branch.name) ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-3 text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading || submitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-[#A8A29E] bg-[#292524] border border-[#3F3F46] rounded-xl hover:bg-[#3F3F46] hover:text-[#FAFAF9] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || submitting || (mode === "select" && selectableBranches.length === 0)}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {(isLoading || submitting) ? (
              <>
                <span className="w-4 h-4 border-2 border-[#0C0A09] border-t-transparent rounded-full animate-spin" />
                {mode === "create" ? "Creating..." : "Selecting..."}
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
