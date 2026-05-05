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
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filtered = search
    ? repos.filter(r => r.full_name.toLowerCase().includes(search.toLowerCase()))
    : repos;

  const handleConnect = async (repo: Repo) => {
    setConnecting(String(repo.id));
    setError(null);

    try {
      const response = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      {/* Search */}
      <div className="px-6 py-3 border-b border-[#292524]">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search repositories..."
          className="w-full px-4 py-2.5 bg-[#0C0A09] border border-[#292524] rounded-xl text-[#FAFAF9] placeholder-[#44403C] text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A87C]/40 focus:border-[#E8A87C]/40 transition-all"
        />
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Repo list */}
      <div className="divide-y divide-[#292524]">
        {filtered.map((repo) => {
          const isConnected = connectedIds.includes(String(repo.id));
          const isLoading = connecting === String(repo.id);

          return (
            <div
              key={repo.id}
              className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-[#292524]/30 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[#FAFAF9] truncate">
                    {repo.full_name}
                  </span>
                  {repo.private && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#292524] text-[#A8A29E] border border-[#3F3F46] rounded-md">
                      Private
                    </span>
                  )}
                  {isConnected && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 rounded-md">
                      Connected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[#44403C]">
                  {repo.language && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#E8A87C]" />
                      {repo.language}
                    </span>
                  )}
                  <span>{repo.stargazers_count} stars</span>
                  <span>
                    Updated{" "}
                    {new Date(repo.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {repo.description && (
                  <p className="text-xs text-[#44403C] mt-1 truncate">{repo.description}</p>
                )}
              </div>

              <div className="flex-shrink-0">
                {isConnected ? (
                  <button
                    onClick={() => handleDisconnect(String(repo.id), repo.full_name || repo.name)}
                    disabled={isLoading}
                    className="px-3.5 py-1.5 text-xs font-medium border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 disabled:opacity-50 transition-all"
                  >
                    {isLoading ? "..." : "Disconnect"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(repo)}
                    disabled={isLoading}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {isLoading ? "Connecting..." : "Connect"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="px-6 py-12 text-center text-sm text-[#44403C]">
          {search ? "No repositories match your search" : "No repositories found"}
        </div>
      )}
    </div>
  );
}
