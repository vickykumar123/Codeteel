"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Repo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  updated_at: string;
  language: string | null;
}

interface RepoListProps {
  repos: Repo[];
  connectedIds: string[];
  userId: string;
}

export function RepoList({ repos, connectedIds, userId }: RepoListProps) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleConnect = async (repo: Repo) => {
    setConnecting(String(repo.id));
    setError(null);

    try {
      const response = await fetch("/api/repos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          github_id: String(repo.id),
          name: repo.name,
          full_name: repo.full_name,
          default_branch: repo.default_branch,
          private: repo.private,
          languages: repo.language ? [repo.language] : [],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to connect repository");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (githubId: string, repoName: string) => {
    const confirmed = window.confirm(
      `Disconnect "${repoName}"?\n\nThis will permanently delete:\n- All indexed files and summaries\n- All chat conversations with this repo\n- All tasks and execution history\n- Webhook for change detection\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setConnecting(githubId);
    setError(null);

    try {
      const response = await fetch(`/api/repos?github_id=${githubId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect repository");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div>
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {repos.map((repo) => {
          const isConnected = connectedIds.includes(String(repo.id));
          const isLoading = connecting === String(repo.id);

          return (
            <li
              key={repo.id}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex justify-between items-center"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {repo.full_name}
                  </span>
                  {repo.private && (
                    <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                      Private
                    </span>
                  )}
                  {isConnected && (
                    <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                      Connected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {repo.language && <span>{repo.language}</span>}
                  <span>⭐ {repo.stargazers_count}</span>
                  <span>
                    Updated{" "}
                    {new Date(repo.updated_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {repo.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                    {repo.description}
                  </p>
                )}
              </div>

              <div className="ml-4">
                {isConnected ? (
                  <button
                    onClick={() => handleDisconnect(String(repo.id), repo.full_name || repo.name)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    {isLoading ? "..." : "Disconnect"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(repo)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? "Connecting..." : "Connect"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {repos.length === 0 && (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          No repositories found
        </div>
      )}
    </div>
  );
}
