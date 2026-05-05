"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { Plan } from "@/lib/agents/types";
import type { StepResult, ExecutionProgress } from "@/hooks/useOrchestrator";

// ===========================================
// TYPES
// ===========================================

export interface Message {
  id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  toolActivity: string | null;
  isLoading: boolean;
  executionProgress: ExecutionProgress | null;
  onApprove?: () => void;
  onReject?: () => void;
  isRunning?: boolean;
  workingBranch?: string | null;
  isLoadingBranches?: boolean;
}

// ===========================================
// MARKDOWN COMPONENTS
// ===========================================

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const isInline = !match && !className;
    if (isInline) {
      return (
        <code className="bg-[#292524] px-1.5 py-0.5 rounded text-sm font-mono text-[#E8A87C]" {...props}>
          {children}
        </code>
      );
    }
    return <code className={`${className} block`} {...props}>{children}</code>;
  },
  pre({ children }) {
    return <pre className="bg-[#0C0A09] border border-[#292524] rounded-xl p-4 overflow-x-auto my-3 text-sm">{children}</pre>;
  },
  a({ href, children }) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#E8A87C] hover:text-[#F5D5C3] hover:underline">{children}</a>;
  },
  ul({ children }) { return <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>; },
  ol({ children }) { return <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>; },
  li({ children }) { return <li className="text-[#A8A29E]">{children}</li>; },
  h1({ children }) { return <h1 className="text-xl font-bold mt-4 mb-2 text-[#FAFAF9]">{children}</h1>; },
  h2({ children }) { return <h2 className="text-lg font-bold mt-3 mb-2 text-[#FAFAF9]">{children}</h2>; },
  h3({ children }) { return <h3 className="text-base font-bold mt-3 mb-1 text-[#FAFAF9]">{children}</h3>; },
  p({ children }) { return <p className="my-2 text-[#A8A29E] leading-relaxed">{children}</p>; },
  blockquote({ children }) {
    return <blockquote className="border-l-4 border-[#292524] pl-4 my-2 italic text-[#A8A29E]">{children}</blockquote>;
  },
  table({ children }) {
    return <div className="overflow-x-auto my-3"><table className="min-w-full border border-[#292524] rounded-lg">{children}</table></div>;
  },
  thead({ children }) { return <thead className="bg-[#292524]">{children}</thead>; },
  th({ children }) { return <th className="px-4 py-2 text-left text-sm font-semibold text-[#FAFAF9] border-b border-[#292524]">{children}</th>; },
  td({ children }) { return <td className="px-4 py-2 text-sm text-[#A8A29E] border-b border-[#292524]">{children}</td>; },
  hr() { return <hr className="my-4 border-[#292524]" />; },
  strong({ children }) { return <strong className="font-semibold text-[#FAFAF9]">{children}</strong>; },
  em({ children }) { return <em className="italic">{children}</em>; },
};

// ===========================================
// MAIN COMPONENT
// ===========================================

export function MessageList({
  messages,
  streamingContent,
  toolActivity,
  isLoading,
  executionProgress,
  onApprove,
  onReject,
  isRunning,
  workingBranch,
  isLoadingBranches,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, toolActivity, executionProgress]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#E8A87C]/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#E8A87C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#FAFAF9] mb-2">Start a conversation</h3>
          <p className="text-sm text-[#71717A]">
            Ask questions about your codebase or request code changes.
            I&apos;ll search through your indexed files to help you.
          </p>
          <div className="mt-6 space-y-2 text-left">
            <p className="text-xs font-medium text-[#71717A] uppercase">Try asking:</p>
            <div className="space-y-1">
              {["Where is the authentication logic?", "How does the API handle errors?", "Add a logout button to the navbar"].map((example, i) => (
                <p key={i} className="text-sm text-[#A8A29E] bg-[#292524] rounded px-3 py-2">
                  &quot;{example}&quot;
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onApprove={onApprove}
            onReject={onReject}
            isRunning={isRunning}
            workingBranch={workingBranch}
            executionProgress={executionProgress}
          />
        ))}

        {/* Tool Activity Indicator */}
        {toolActivity && (
          <div className="flex gap-4">
            <AiAvatar />
            <div className="flex-1">
              <div className="inline-flex items-center gap-2.5 bg-[#1C1917] rounded-xl px-4 py-3 border border-[#292524]">
                <span className="w-2 h-2 bg-[#E8A87C] rounded-full animate-pulse flex-shrink-0" />
                <span className="text-sm text-[#A8A29E]">{toolActivity}</span>
                <ElapsedTime />
              </div>
            </div>
          </div>
        )}

        {/* Streaming Content */}
        {streamingContent && (
          <div className="flex gap-4">
            <AiAvatar />
            <div className="flex-1 bg-[#1C1917] rounded-lg p-4 shadow-sm">
              <MarkdownContent content={streamingContent} />
              <span className="inline-block w-0.5 h-4 bg-[#E8A87C] animate-pulse rounded-full ml-1" />
            </div>
          </div>
        )}

        {/* Branch loading indicator */}
        {isLoadingBranches && (
          <div className="flex gap-4">
            <AiAvatar />
            <div className="flex-1">
              <div className="inline-flex items-center gap-2.5 bg-[#1C1917] rounded-xl px-4 py-3 border border-[#292524]">
                <span className="animate-spin w-4 h-4 border-2 border-[#E8A87C] border-t-transparent rounded-full" />
                <span className="text-sm text-[#A8A29E]">Loading branches...</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingContent && !toolActivity && !isLoadingBranches && (
          <div className="flex gap-4">
            <AiAvatar />
            <div className="flex-1">
              <div className="inline-flex items-center gap-2.5 bg-[#1C1917] rounded-xl px-4 py-3 border border-[#292524]">
                <ThinkingDots />
                <span className="text-sm text-[#71717A]">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ===========================================
// AI AVATAR
// ===========================================

function AiAvatar() {
  return (
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#E8A87C] to-[#C9A96E] flex items-center justify-center flex-shrink-0">
      <span className="text-white text-sm font-medium">AI</span>
    </div>
  );
}

// ===========================================
// MESSAGE BUBBLE (handles all message types)
// ===========================================

function MessageBubble({
  message,
  onApprove,
  onReject,
  isRunning,
  workingBranch,
  executionProgress,
}: {
  message: Message;
  onApprove?: () => void;
  onReject?: () => void;
  isRunning?: boolean;
  workingBranch?: string | null;
  executionProgress?: ExecutionProgress | null;
}) {
  const isUser = message.role === "user";
  const metadataType = message.metadata?.type as string | undefined;

  if (isUser) {
    return (
      <div className="flex gap-4 flex-row-reverse">
        <div className="w-8 h-8 rounded-xl bg-[#292524] border border-[#3F3F46] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-medium">U</span>
        </div>
        <div className="flex-1 max-w-[80%] rounded-2xl p-4 bg-[#292524] border border-[#3F3F46] text-[#FAFAF9] ml-auto">
          <p className="whitespace-pre-wrap">{message.content}</p>
          <div className="text-xs mt-2 text-[#71717A]">{formatTime(message.created_at)}</div>
        </div>
      </div>
    );
  }

  // Assistant message — check metadata for rich types
  return (
    <div className="flex gap-4">
      <AiAvatar />
      <div className="flex-1 max-w-[80%] rounded-2xl p-4 bg-[#1C1917] border border-[#292524]">
        {/* Plan message */}
        {metadataType === "plan" && message.metadata?.plan ? (
          <InlinePlan
            plan={message.metadata.plan as Plan}
            approved={message.metadata.approved as boolean | undefined}
            onApprove={onApprove}
            onReject={onReject}
            isRunning={isRunning}
            workingBranch={workingBranch}
          />
        ) : metadataType === "execution" ? (
          <InlineExecution
            content={message.content}
            executionProgress={executionProgress}
            steps={(message.metadata?.steps as StepResult[]) || executionProgress?.steps || []}
            filesChanged={(message.metadata?.filesChanged as string[]) || []}
            isComplete={!!message.metadata?.isComplete}
          />
        ) : (
          <>
            <MarkdownContent content={message.content} />
            {/* PR Link */}
            {typeof message.metadata?.prUrl === "string" && (
              <a
                href={message.metadata.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl text-sm hover:bg-green-500/20 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Pull Request
              </a>
            )}
          </>
        )}
        <div className="text-xs mt-2 text-[#71717A]">{formatTime(message.created_at)}</div>
      </div>
    </div>
  );
}

// ===========================================
// INLINE PLAN (inside assistant message)
// ===========================================

function InlinePlan({
  plan,
  approved,
  onApprove,
  onReject,
  isRunning,
  workingBranch,
}: {
  plan: Plan;
  approved?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  isRunning?: boolean;
  workingBranch?: string | null;
}) {
  const showButtons = approved === undefined && !isRunning;

  return (
    <div>
      <p className="text-[#A8A29E] mb-3">
        I&apos;ve analyzed the codebase and created a plan:
      </p>

      {/* Plan card */}
      <div className="border border-[#292524] rounded-lg overflow-hidden">
        {/* Plan header */}
        <div className="bg-gray-50 dark:bg-gray-750 px-4 py-3 border-b border-[#292524]">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="font-medium text-[#FAFAF9] text-sm">{plan.title}</span>
          </div>
          {plan.summary && (
            <p className="text-xs text-[#71717A] mt-1">{plan.summary}</p>
          )}
        </div>

        {/* Steps */}
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {plan.steps.map((step, i) => (
            <div key={step.id} className="px-4 py-2.5 flex items-start gap-3">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium flex-shrink-0 mt-0.5 ${
                step.type === "create" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                : step.type === "delete" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400"
              }`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase text-[#71717A]">{step.type}</span>
                  <code className="text-xs text-[#A8A29E] font-mono truncate">{step.path}</code>
                </div>
                <p className="text-sm text-[#A8A29E] mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Approval buttons */}
      {showButtons && (
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Approve
          </button>
          <button
            onClick={onReject}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#292524] text-[#A8A29E] text-sm font-medium rounded-lg hover:bg-[#3F3F46] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Reject
          </button>
          {!workingBranch && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              (branch will be selected on approve)
            </span>
          )}
        </div>
      )}

      {/* Approved state */}
      {approved === true && (
        <div className="flex items-center gap-2 mt-3 text-sm text-green-600 dark:text-green-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Plan approved
        </div>
      )}

      {/* Rejected state */}
      {approved === false && (
        <div className="flex items-center gap-2 mt-3 text-sm text-[#71717A]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Plan rejected
        </div>
      )}

      {/* Loading state while executing */}
      {approved === undefined && isRunning && (
        <div className="flex items-center gap-2 mt-3 text-sm text-blue-500">
          <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Processing...
        </div>
      )}
    </div>
  );
}

// ===========================================
// INLINE EXECUTION (inside assistant message)
// ===========================================

function InlineExecution({
  content,
  executionProgress,
  steps,
  filesChanged,
  isComplete,
}: {
  content: string;
  executionProgress?: ExecutionProgress | null;
  steps: StepResult[];
  filesChanged: string[];
  isComplete: boolean;
}) {
  // Use live progress if available, otherwise use saved steps from metadata
  const liveSteps = executionProgress?.steps;
  const displaySteps = liveSteps && liveSteps.length > 0 ? liveSteps : steps;
  const isAllComplete = isComplete || executionProgress?.status === "complete";

  return (
    <div>
      {content && (
        <p className="text-[#A8A29E] mb-3">{content}</p>
      )}

      {/* Steps */}
      {displaySteps.length > 0 && (
        <div className="space-y-2">
          {displaySteps.map((step) => (
            <ExecutionStep key={step.stepId} step={step} />
          ))}
        </div>
      )}

      {/* Summary when complete */}
      {isAllComplete && (
        <div className="flex items-center gap-2 mt-4 text-sm text-green-600 dark:text-green-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          All {displaySteps.length} step{displaySteps.length !== 1 ? "s" : ""} completed.
          {filesChanged.length > 0 && ` ${[...new Set(filesChanged)].length} file${[...new Set(filesChanged)].length !== 1 ? "s" : ""} changed.`}
        </div>
      )}
    </div>
  );
}

// ===========================================
// EXECUTION STEP (with expandable diff)
// ===========================================

function ExecutionStep({ step }: { step: StepResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = step.diff && (step.diff.oldString || step.diff.newString);

  return (
    <div className="border border-[#292524] rounded-lg overflow-hidden">
      {/* Step header */}
      <button
        type="button"
        onClick={() => hasDiff && setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${hasDiff ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750" : "cursor-default"}`}
      >
        {/* Status icon */}
        <StepStatusIcon status={step.status} />

        {/* Step info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-[#A8A29E] truncate">
              {step.path || "..."}
            </code>
          </div>
          <p className="text-xs text-[#71717A] truncate mt-0.5">
            {step.description}
          </p>
        </div>

        {/* Error badge */}
        {step.error && (
          <span className="text-xs text-red-500 dark:text-red-400 flex-shrink-0">
            Error
          </span>
        )}

        {/* Expand indicator */}
        {hasDiff && (
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Expanded diff */}
      {expanded && hasDiff && (
        <div className="border-t border-[#292524]">
          <DiffView
            oldString={step.diff!.oldString}
            newString={step.diff!.newString}
          />
        </div>
      )}

      {/* Error detail */}
      {step.error && (
        <div className="border-t border-red-100 dark:border-red-900/30 px-3 py-2 bg-red-50 dark:bg-red-900/10">
          <p className="text-xs text-red-600 dark:text-red-400">{step.error}</p>
        </div>
      )}
    </div>
  );
}

// ===========================================
// STEP STATUS ICON
// ===========================================

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "failed":
      return (
        <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "in_progress":
      return (
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    default:
      return (
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
      );
  }
}

// ===========================================
// DIFF VIEW
// ===========================================

function DiffView({ oldString, newString }: { oldString: string; newString: string }) {
  const oldLines = oldString ? oldString.split("\n") : [];
  const newLines = newString ? newString.split("\n") : [];
  const isNewFile = !oldString && newString;

  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto bg-gray-950 text-xs font-mono">
      {isNewFile ? (
        // New file — all additions
        newLines.map((line, i) => (
          <div key={i} className="px-3 py-0.5 bg-green-900/30 text-green-300">
            <span className="text-green-600 select-none mr-2">+</span>{line}
          </div>
        ))
      ) : (
        // Modification — show removed then added
        <>
          {oldLines.map((line, i) => (
            <div key={`old-${i}`} className="px-3 py-0.5 bg-red-900/30 text-red-300">
              <span className="text-red-600 select-none mr-2">-</span>{line}
            </div>
          ))}
          {newLines.map((line, i) => (
            <div key={`new-${i}`} className="px-3 py-0.5 bg-green-900/30 text-green-300">
              <span className="text-green-600 select-none mr-2">+</span>{line}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ===========================================
// UTILITY COMPONENTS
// ===========================================

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function ToolActivityIcon({ activity }: { activity: string }) {
  const lower = activity.toLowerCase();
  if (lower.includes("search") || lower.includes("finding")) {
    return <svg className="w-4 h-4 text-blue-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
  }
  if (lower.includes("reading") || lower.includes("read")) {
    return <svg className="w-4 h-4 text-amber-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
  }
  if (lower.includes("writing") || lower.includes("wrote") || lower.includes("committing")) {
    return <svg className="w-4 h-4 text-green-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
  }
  if (lower.includes("generating") || lower.includes("code")) {
    return <svg className="w-4 h-4 text-purple-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>;
  }
  if (lower.includes("step") || lower.includes("execut")) {
    return <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
  }
  if (lower.includes("plan") || lower.includes("explor") || lower.includes("analyz")) {
    return <svg className="w-4 h-4 text-indigo-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;
  }
  return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      <div className="w-1.5 h-1.5 bg-[#E8A87C] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="w-1.5 h-1.5 bg-[#E8A87C] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="w-1.5 h-1.5 bg-[#E8A87C] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function ElapsedTime() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (seconds < 3) return null; // Don't show for quick responses
  return <span className="text-[10px] text-[#71717A] ml-1">{seconds}s</span>;
}
