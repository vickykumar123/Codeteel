"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  platform?: string;
}

interface SidebarProps {
  repoId: string;
  repoName: string;
  fileCount: number;
  conversations: Conversation[];
  currentConversationId?: string;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  hasMore?: boolean;
}

export function Sidebar({
  repoId,
  repoName,
  fileCount,
  conversations: initialConversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  hasMore: initialHasMore = true,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [conversations, setConversations] = useState(initialConversations);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);

  // Sync when parent updates (new conversation created)
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const lastConv = conversations[conversations.length - 1];
      const res = await fetch(`/api/conversations?repoId=${repoId}&before=${encodeURIComponent(lastConv?.updated_at || "")}&limit=25`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const older = (data.conversations || []) as Conversation[];
      if (older.length < 25) setHasMore(false);
      setConversations((prev) => [...prev, ...older]);
    } catch { /* ignore */ } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-[#1C1917] border border-[#292524] rounded-xl text-[#A8A29E] hover:text-[#FAFAF9] transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          {collapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      {collapsed && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setCollapsed(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-40
        w-72 bg-[#0C0A09] border-r border-[#1C1917] flex flex-col
        transform transition-transform duration-200
        ${collapsed ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-[#1C1917]">
          <Link href={`/repos/${repoId}`} className="flex items-center gap-2.5 mb-3 group">
            <Image src="/logo.svg" alt="Codeteel" width={24} height={24} />
            <span className="text-sm font-semibold text-[#FAFAF9] truncate group-hover:text-[#E8A87C] transition-colors">
              {repoName.split("/")[1]}
            </span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-[#71717A]">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            {fileCount} files indexed
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => { onNewChat(); setCollapsed(false); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2">
          <div className="px-2 py-2">
            <h3 className="text-[10px] font-semibold text-[#71717A] uppercase tracking-[0.15em]">
              Recent
            </h3>
          </div>

          {conversations.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-[#71717A]">No conversations yet</p>
            </div>
          ) : (
            <>
              <nav className="space-y-0.5">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => { onSelectConversation(conv.id); setCollapsed(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                      conv.id === currentConversationId
                        ? "bg-[#E8A87C]/10 text-[#E8A87C]"
                        : "text-[#A8A29E] hover:bg-[#1C1917] hover:text-[#FAFAF9]"
                    }`}
                  >
                    <div className="truncate font-medium text-xs flex items-center gap-1.5">
                      {conv.title || "Untitled"}
                      {conv.platform && <PlatformIcon platform={conv.platform} />}
                    </div>
                    <div className="text-[10px] text-[#71717A] mt-0.5">
                      {formatRelativeTime(conv.updated_at)}
                    </div>
                  </button>
                ))}
              </nav>
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full mt-2 px-3 py-2.5 text-xs text-[#A8A29E] hover:text-[#E8A87C] hover:bg-[#1C1917] rounded-xl transition-all text-center"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1C1917]">
          <div className="text-[10px] text-[#71717A]">
            Type <span className="text-[#E8A87C]">/</span> for commands
          </div>
        </div>
      </aside>
    </>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  const icons: Record<string, { color: string }> = {
    slack: { color: "#4A154B" },
    telegram: { color: "#0088cc" },
    discord: { color: "#5865F2" },
  };
  const { color } = icons[platform] || { color: "#A8A29E" };
  return (
    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
