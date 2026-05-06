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
        <p className="text-sm text-[#A8A29E] mb-3">
          These instructions are included in every agent prompt. Use them to define your coding style, conventions, and preferences.
        </p>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={8}
          placeholder={`Example:\n- Use TypeScript strict mode\n- Prefer functional components\n- Always add JSDoc comments to public functions\n- Use snake_case for Python, camelCase for TypeScript\n- Keep functions under 30 lines`}
          className="w-full px-4 py-3 bg-[#0C0A09] border border-[#292524] rounded-xl text-[#FAFAF9] placeholder-[#44403C] text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#E8A87C]/40 focus:border-[#E8A87C]/40 transition-all"
        />
      </div>

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
          {saving ? "Saving..." : "Save Instructions"}
        </button>
      </div>
    </div>
  );
}
