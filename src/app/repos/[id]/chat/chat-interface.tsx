"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { Sidebar } from "./sidebar";
import { BranchModal } from "./branch-modal";
import {
  useOrchestrator,
  type Message,
} from "@/hooks/useOrchestrator";
import type { PersistedExecutionState } from "@/lib/agents/types";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  platform?: string;
}

interface ChatInterfaceProps {
  repoId: string;
  repoName: string;
  defaultBranch: string;
  fileCount: number;
  llmProvider: string;
  llmBaseUrl?: string;
  llmModel?: string;
  conversationId?: string;
  conversationTitle?: string;
  initialMessages: Message[];
  conversations: Conversation[];
  initialWorkingBranch?: string;
  initialExecutionState?: Record<string, unknown>;
}

export function ChatInterface({
  repoId,
  repoName,
  defaultBranch,
  fileCount,
  llmProvider,
  llmBaseUrl,
  llmModel,
  conversationId: initialConversationId,
  conversationTitle,
  initialMessages,
  conversations: initialConversations,
  initialWorkingBranch,
  initialExecutionState,
}: ChatInterfaceProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  const handleConversationCreated = useCallback(
    (id: string, title: string) => {
      setConversations((prev) => [
        { id, title, updated_at: new Date().toISOString(), platform: "web" },
        ...prev,
      ]);
    },
    []
  );

  const {
    state,
    sendMessage,
    handleApprove,
    handleReject,
    handleBranchSelect,
    handleBranchCancel,
    openBranchSelector,
    abort,
    newChat,
  } = useOrchestrator({
    repoId,
    repoFullName: repoName,
    defaultBranch,
    llmProvider,
    llmBaseUrl,
    llmModel,
    initialConversationId,
    initialMessages,
    initialWorkingBranch,
    initialExecutionState: initialExecutionState as PersistedExecutionState | undefined,
    onConversationCreated: handleConversationCreated,
  });

  const handleNewChat = () => {
    newChat();
    router.push(`/repos/${repoId}/chat`);
  };

  const handleSelectConversation = (convId: string) => {
    router.push(`/repos/${repoId}/chat/${convId}`);
  };

  const messagesForList = state.messages.map((m) => ({
    ...m,
    metadata: m.metadata || null,
  }));

  return (
    <div className="flex h-screen bg-[#0C0A09]">
      {/* Sidebar */}
      <Sidebar
        repoId={repoId}
        repoName={repoName}
        fileCount={fileCount}
        conversations={conversations}
        currentConversationId={state.conversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-[#0C0A09]/80 backdrop-blur-xl border-b border-[#1C1917] px-4 sm:px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold text-[#FAFAF9] truncate">
                {conversationTitle || "New Chat"}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {llmModel && (
                  <span className="px-2 py-0.5 rounded-md bg-[#292524] border border-[#3F3F46] text-[#E8A87C] text-[10px] font-mono">
                    {llmProvider} / {llmModel}
                  </span>
                )}
                {state.workingBranch ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-[10px]">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                    </svg>
                    <span className="font-mono">{state.workingBranch}</span>
                  </span>
                ) : (
                  <button
                    onClick={openBranchSelector}
                    disabled={state.isRunning || state.isLoadingBranches}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed border-[#3F3F46] text-[#71717A] hover:border-[#E8A87C]/40 hover:text-[#E8A87C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[10px]"
                  >
                    {state.isLoadingBranches ? (
                      <span className="w-3 h-3 border border-[#E8A87C] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                    {state.isLoadingBranches ? "Loading..." : "Branch"}
                  </button>
                )}
                {state.isRunning && (
                  <span className="flex items-center gap-1.5 text-[10px] text-[#E8A87C]">
                    <span className="w-1.5 h-1.5 bg-[#E8A87C] rounded-full animate-pulse" />
                    {state.executionProgress && state.executionProgress.status !== "complete"
                      ? `Step ${state.executionProgress.currentStep}/${state.executionProgress.totalSteps}`
                      : "Working..."}
                  </span>
                )}
                {state.prUrl && (
                  <a
                    href={state.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-green-400 hover:text-green-300 transition-colors"
                  >
                    PR #{state.prNumber} →
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
              <Link
                href="/settings"
                className="text-[#71717A] hover:text-[#A8A29E] transition-colors"
                title="Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
              <Link
                href={`/repos/${repoId}`}
                className="text-xs text-[#71717A] hover:text-[#A8A29E] transition-colors"
              >
                ← Repo
              </Link>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <MessageList
            messages={messagesForList}
            streamingContent={state.streamingContent}
            toolActivity={state.toolActivity}
            isLoading={state.isRunning}
            executionProgress={state.executionProgress}
            onApprove={handleApprove}
            onReject={handleReject}
            isRunning={state.isRunning}
            workingBranch={state.workingBranch}
            isLoadingBranches={state.isLoadingBranches}
          />
        </div>

        {/* Branch Selection Modal */}
        {state.branchSelectionRequest && (
          <BranchModal
            isOpen={true}
            availableBranches={state.branchSelectionRequest.availableBranches}
            suggestedName={state.branchSelectionRequest.suggestedName}
            defaultBase={state.branchSelectionRequest.defaultBase}
            protectedBranches={state.branchSelectionRequest.protectedBranches}
            onSelect={(selection) => {
              handleBranchSelect(
                selection.branchName,
                selection.action === "create_new",
                selection.baseBranch
              );
            }}
            onCancel={handleBranchCancel}
            isLoading={state.isRunning}
          />
        )}

        {/* Error Display */}
        {state.error && (
          <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/20 flex-shrink-0">
            <p className="text-xs text-red-400">{state.error}</p>
          </div>
        )}

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          disabled={state.isRunning}
          onStop={abort}
          placeholder={
            state.currentPlan
              ? 'Type "yes" to approve or "no" to reject...'
              : "Ask about your code or request changes..."
          }
        />
      </div>
    </div>
  );
}
