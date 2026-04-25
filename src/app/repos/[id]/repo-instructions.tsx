"use client";

import { useState } from "react";

interface RepoInstructionsProps {
  repoId: string;
  initialInstructions: string;
}

export function RepoInstructions({ repoId, initialInstructions }: RepoInstructionsProps) {
  const [instructions, setInstructions] = useState(initialInstructions);
  const [isOpen, setIsOpen] = useState(false);
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Repo Instructions
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {instructions ? "Custom rules for this repository" : "Add coding rules specific to this repo"}
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-3">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
            placeholder={`Example:\n- This project uses Python 3.11 + Django 5\n- Follow PEP 8 style guide\n- All functions must have docstrings\n- Use pytest for tests`}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono resize-y"
          />
          <div className="flex items-center justify-between">
            {message && (
              <span className={`text-sm ${message.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {message.text}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
