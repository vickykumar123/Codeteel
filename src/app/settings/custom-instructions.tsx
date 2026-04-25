"use client";

import { useState } from "react";

interface CustomInstructionsProps {
  initialInstructions: string;
}

export function CustomInstructions({ initialInstructions }: CustomInstructionsProps) {
  const [instructions, setInstructions] = useState(initialInstructions);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "user", instructions: instructions.trim() || null }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }
      setMessage({ type: "success", text: "Instructions saved" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          These instructions are included in every agent prompt. Use them to define your coding style, conventions, and preferences.
        </p>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={8}
          placeholder={`Example:\n- Use TypeScript strict mode\n- Prefer functional components\n- Always add JSDoc comments to public functions\n- Use snake_case for Python, camelCase for TypeScript\n- Keep functions under 30 lines`}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono resize-y"
        />
      </div>

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
          {saving ? "Saving..." : "Save Instructions"}
        </button>
      </div>
    </div>
  );
}
