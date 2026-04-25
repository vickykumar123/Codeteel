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
        { id, title, updated_at: new Date().toISOString() },
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

  // URL is updated by useOrchestrator's ensureConversation via
  // window.history.replaceState (no full navigation).

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
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
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
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {conversationTitle || "New Chat"}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{repoName}</span>
                {llmModel && (
                  <>
                    <span>·</span>
                    <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-mono">
                      {llmModel}
                    </span>
                  </>
                )}
                <span>·</span>
                {state.workingBranch ? (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    title="Branch is locked for this conversation"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="font-mono text-xs">{state.workingBranch}</span>
                  </span>
                ) : (
                  <button
                    onClick={openBranchSelector}
                    disabled={state.isRunning}
                    className="flex items-center gap-1 px-2 py-0.5 rounded border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="text-xs">Select Branch</span>
                  </button>
                )}
                {/* Running indicator */}
                {state.isRunning && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      {state.executionProgress && state.executionProgress.status !== "complete"
                        ? `Step ${state.executionProgress.currentStep}/${state.executionProgress.totalSteps}`
                        : "Working..."}
                    </span>
                  </>
                )}
                {/* PR link */}
                {state.prUrl && (
                  <>
                    <span>·</span>
                    <a
                      href={state.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 dark:text-green-400 hover:underline"
                    >
                      PR #{state.prNumber}
                    </a>
                  </>
                )}
              </div>
            </div>
            <Link
              href={`/repos/${repoId}`}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              ← Back to Repository
            </Link>
          </div>
        </header>

        {/* Messages — plan, execution, diffs all render inline */}
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
          <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          </div>
        )}

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          disabled={state.isRunning}
          onStop={abort}
          placeholder={
            state.currentPlan
              ? 'Type "yes" to approve or "no" to reject the plan...'
              : "Ask about your code or request changes..."
          }
        />
      </div>
    </div>
  );
}
