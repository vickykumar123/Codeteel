"use client";

import { useState } from "react";

interface RepoInstructionsProps {
  repoId: string;
  initialInstructions: string;
}

export function RepoInstructions({ repoId, initialInstructions }: RepoInstructionsProps) {
  const [instructions, setInstructions] = useState(initialInstructions);
  const [isOpen, setIsOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "repo", repoId, instructions: instructions.trim() || null }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }
      setMessage({ type: "success", text: "Saved" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#1C1917] border border-[#292524] rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left px-6 py-4 hover:bg-[#292524]/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#292524] rounded-lg flex items-center justify-center text-[#E8A87C] flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#FAFAF9]">Repo Instructions</h2>
            <p className="text-xs text-[#44403C] mt-0.5">
              {instructions ? "Custom rules for this repository" : "Add coding rules specific to this repo"}
            </p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-[#44403C] transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-6 pb-5 space-y-3">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
            placeholder={`Example:\n- This project uses Python 3.11 + Django 5\n- Follow PEP 8 style guide\n- All functions must have docstrings\n- Use pytest for tests`}
            className="w-full px-4 py-3 bg-[#0C0A09] border border-[#292524] rounded-xl text-[#FAFAF9] placeholder-[#44403C] text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#E8A87C]/40 focus:border-[#E8A87C]/40 transition-all"
          />
          <div className="flex items-center justify-between">
            {message && (
              <span className={`text-sm ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
                {message.text}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="ml-auto px-5 py-2 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] font-semibold rounded-xl text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
