"use client";

import { useState, useEffect, useRef } from "react";

interface BranchSelectorProps {
  repoId: string;
  currentBranch: string;
}

export function BranchSelector({ repoId, currentBranch }: BranchSelectorProps) {
  const [branch, setBranch] = useState(currentBranch);
  const [branches, setBranches] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch branches when dropdown opens
  useEffect(() => {
    if (!open || branches.length > 0) return;

    setLoading(true);
    fetch(`/api/repos/${repoId}/branches`)
      .then((res) => res.json())
      .then((data) => {
        if (data.branches) {
          setBranches(data.branches.map((b: { name: string }) => b.name));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, repoId, branches.length]);

  async function selectBranch(name: string) {
    if (name === branch) {
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/repos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: repoId, change_detection_branch: name }),
      });

      if (res.ok) {
        setBranch(name);
      }
    } catch (err) {
      console.error("Failed to update detection branch:", err);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Change Detection Branch
      </div>
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="mt-1 flex items-center gap-2 text-lg font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {saving ? "Saving..." : branch}
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              Loading branches...
            </div>
          ) : branches.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              No branches found
            </div>
          ) : (
            branches.map((b) => (
              <button
                key={b}
                onClick={() => selectBranch(b)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  b === branch
                    ? "text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {b}
                {b === branch && (
                  <span className="ml-2 text-xs text-gray-400">current</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
