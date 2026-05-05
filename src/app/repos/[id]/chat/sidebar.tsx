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
                      {conv.platform && conv.platform !== "web" && <PlatformIcon platform={conv.platform} />}
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
  if (platform === "slack") {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="#4A154B">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
      </svg>
    );
  }
  if (platform === "telegram") {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="#0088cc">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    );
  }
  if (platform === "discord") {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="#5865F2">
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
      </svg>
    );
  }
  return null;
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
