"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@/lib/db/client";

interface ChangedFile {
  path: string;
  status: string;
}

interface ChangeBannerProps {
  repoId: string;
  initialChanges: ChangedFile[];
}

export function ChangeBanner({ repoId, initialChanges }: ChangeBannerProps) {
  const [changes, setChanges] = useState<ChangedFile[]>(initialChanges);
  const [dismissed, setDismissed] = useState(false);
  const supabase = createBrowserClient();

  // Poll for pending_changes as a reliable fallback
  const pollChanges = useCallback(async () => {
    const { data } = await supabase
      .from("repositories")
      .select("pending_changes")
      .eq("id", repoId)
      .single();

    if (data) {
      const newChanges = (data.pending_changes as ChangedFile[] | null) || [];
      setChanges((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(newChanges)) {
          if (newChanges.length > 0 && newChanges.length !== prev.length) {
            setDismissed(false);
          }
          return newChanges;
        }
        return prev;
      });
    }
  }, [repoId, supabase]);

  // Poll every 30 seconds for pending changes
  useEffect(() => {
    const interval = setInterval(pollChanges, 30_000);
    return () => clearInterval(interval);
  }, [pollChanges]);

  if (changes.length === 0 || dismissed) return null;

  const added = changes.filter((c) => c.status === "added").length;
  const modified = changes.filter((c) => c.status === "modified").length;
  const removed = changes.filter((c) => c.status === "removed").length;

  const parts: string[] = [];
  if (added > 0) parts.push(`${added} added`);
  if (modified > 0) parts.push(`${modified} modified`);
  if (removed > 0) parts.push(`${removed} removed`);

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <svg
          className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {changes.length} file{changes.length !== 1 ? "s" : ""} changed since last index
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            {parts.join(", ")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
