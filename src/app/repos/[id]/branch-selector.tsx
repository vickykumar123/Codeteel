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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!open || branches.length > 0) return;
    setLoading(true);
    fetch(`/api/repos/${repoId}/branches`)
      .then((res) => res.json())
      .then((data) => {
        if (data.branches) setBranches(data.branches.map((b: { name: string }) => b.name));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, repoId, branches.length]);

  async function selectBranch(name: string) {
    if (name === branch) { setOpen(false); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/repos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: repoId, change_detection_branch: name }),
      });
      if (res.ok) setBranch(name);
    } catch (err) {
      console.error("Failed to update detection branch:", err);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="text-[10px] text-[#44403C] uppercase tracking-wider">Detection Branch</div>
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="mt-1.5 flex items-center gap-2 text-sm font-medium text-[#FAFAF9] hover:text-[#E8A87C] transition-colors cursor-pointer"
      >
        <svg className="w-3.5 h-3.5 text-[#A8A29E]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
        </svg>
        {saving ? "Saving..." : branch}
        <svg className={`w-3 h-3 text-[#44403C] transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-10 mt-2 w-56 bg-[#1C1917] border border-[#292524] rounded-xl shadow-xl shadow-black/30 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-[#44403C]">Loading branches...</div>
          ) : branches.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[#44403C]">No branches found</div>
          ) : (
            branches.map((b) => (
              <button
                key={b}
                onClick={() => selectBranch(b)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
                  b === branch
                    ? "text-[#E8A87C] font-medium bg-[#E8A87C]/10"
                    : "text-[#A8A29E] hover:bg-[#292524] hover:text-[#FAFAF9]"
                }`}
              >
                {b}
                {b === branch && <span className="ml-2 text-[10px] text-[#44403C]">current</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
