"use client";

// useOrchestrator - React hook that drives the orchestrator in the browser
//
// Responsibilities:
//   1. Creates WebToolExecutor + ChatFn (via /api/llm/chat proxy)
//   2. Manages React state: messages, plan, execution, branch, errors
//   3. Runs orchestrator loop on user message (non-blocking)
//   4. Approval/rejection via UI buttons (code guards, not LLM parsing)
//   5. Branch selection guard before execution
//   6. Background DB saves for messages and execution state
//
// The orchestrator, planner, search, and executor modules are pure —
// they run in the browser without any server-side dependencies.

import { useState, useRef, useCallback, useEffect } from "react";
import { WebToolExecutor } from "@/lib/agents/tools/web";
import { runOrchestrator } from "@/lib/agents";
import type {
  AgentContext,
  AgentMessage,
  Plan,
  StreamEvent,
  PersistedExecutionState,
  BranchSelectionRequest,
  ChatFn,
  LLMChatMessage,
  LLMToolDef,
  LLMChatResponse,
  LLMConfig,
} from "@/lib/agents/types";

// ===========================================
// TYPES
// ===========================================

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface OrchestratorState {
  messages: Message[];
  isRunning: boolean;
  streamingContent: string;
  toolActivity: string | null;
  error: string | null;
  currentPlan: Plan | null;
  workingBranch: string | null;
  branchSelectionRequest: BranchSelectionRequest | null;
  isLoadingBranches: boolean;
  filesChanged: string[];
  prUrl: string | null;
  prNumber: number | null;
  conversationId: string | undefined;
  executionProgress: ExecutionProgress | null;
}

export interface StepResult {
  stepId: string;
  stepIndex: number;
  description: string;
  path: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  error?: string;
  diff?: { oldString: string; newString: string };
}

export interface ExecutionProgress {
  currentStep: number;
  totalSteps: number;
  currentFile: string | null;
  status: "generating" | "reading" | "writing" | "complete" | "failed";
  steps: StepResult[];
}

interface UseOrchestratorOptions {
  repoId: string;
  repoFullName: string;
  defaultBranch: string;
  llmProvider: string;      // "ollama" | "openai" | "claude" | "gemini" | etc.
  llmBaseUrl?: string;      // OpenAI-compatible endpoint
  llmModel?: string;        // Model name
  initialConversationId?: string;
  initialMessages?: Message[];
  initialWorkingBranch?: string;
  initialExecutionState?: PersistedExecutionState;
  onConversationCreated?: (id: string, title: string) => void;
}

// ===========================================
// APPROVAL/REJECTION DETECTION (from constants — single source of truth)
// ===========================================

import { APPROVAL_PHRASES, REJECTION_PHRASES } from "@/lib/agents/constants";
import { compressConversation } from "@/lib/agents/compression";
import { securityScan, reviewPR, listOpenPRs } from "@/lib/agents/reviewer";

function isApprovalText(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  if (APPROVAL_PHRASES.includes(normalized)) return true;
  return APPROVAL_PHRASES.some(
    (p) =>
      normalized.startsWith(p + ",") ||
      normalized.startsWith(p + ".") ||
      normalized.startsWith(p + "!")
  );
}

function isRejectionText(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  if (REJECTION_PHRASES.includes(normalized)) return true;
  return REJECTION_PHRASES.some(
    (p) =>
      normalized.startsWith(p + ",") ||
      normalized.startsWith(p + ".") ||
      normalized.startsWith(p + "!")
  );
}

// ===========================================
// SLASH COMMANDS
// ===========================================

const HELP_TEXT = `**Available Commands:**

| Command | Description |
|---------|-------------|
| \`/help\` | Show this help message |
| \`/branch [name]\` | Switch branch or open branch selector |
| \`/branches\` | List available branches |
| \`/reset\` | Clear execution state (plan, files changed) |
| \`/clear\` | Start a new conversation |
| \`/security [path]\` | Security scan (full, scoped, or PR) |
| \`/review pr [N]\` | Review a PR or list open PRs |
| \`/compact\` | Compress conversation to save tokens |
| \`/pr\` | Create PR for current changes |
| \`/diff\` | Show all file changes in this conversation |
| \`/undo\` | Revert last file change |

**Examples:**
- \`/security src/auth/\` — scan auth directory
- \`/security pr 42\` — scan PR #42 diff
- \`/review pr 15\` — review PR #15
- \`/branch feature/new-api\` — switch to branch`;

/** Check if text is a slash command */
function isCommand(text: string): boolean {
  return text.startsWith("/");
}

/** Parse a slash command into name + args */
function parseCommand(text: string): { name: string; args: string } {
  const trimmed = text.trim();
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) {
    return { name: trimmed.slice(1).toLowerCase(), args: "" };
  }
  return {
    name: trimmed.slice(1, spaceIdx).toLowerCase(),
    args: trimmed.slice(spaceIdx + 1).trim(),
  };
}

// ===========================================
// CHAT FUNCTION
// ===========================================

// Local providers (Ollama) → direct browser fetch (no proxy needed)
// Cloud providers (OpenAI, Claude, Gemini, etc.) → /api/llm/chat proxy (keeps API keys server-side)

function createChatFn(llmProvider: string, llmBaseUrl?: string, llmModel?: string): ChatFn {
  if (llmProvider === "ollama") {
    // Direct browser → Ollama (OpenAI-compatible streaming API)
    const baseUrl = llmBaseUrl || "http://localhost:11434/v1";
    const model = llmModel || "llama3";

    return async (
      messages: LLMChatMessage[],
      tools?: LLMToolDef[],
      onStream?: (delta: string) => void,
    ): Promise<LLMChatResponse> => {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          tools: tools && tools.length > 0 ? tools : undefined,
          tool_choice: tools && tools.length > 0 ? "auto" : undefined,
          stream: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Ollama request failed" }));
        throw new Error(data.error?.message || data.error || `Ollama request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let content = "";
      const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json || json === "[DONE]") continue;

          try {
            const chunk = JSON.parse(json);
            const delta = chunk.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              content += delta.content;
              if (onStream && toolCallMap.size === 0) {
                onStream(delta.content);
              }
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                const existing = toolCallMap.get(idx) || { id: "", name: "", arguments: "" };
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name += tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                toolCallMap.set(idx, existing);
              }
            }
          } catch {
            continue;
          }
        }
      }

      const toolCalls = toolCallMap.size > 0
        ? Array.from(toolCallMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([, tc]) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.arguments },
            }))
        : undefined;

      return { content, tool_calls: toolCalls };
    };
  }

  // Cloud providers → streaming proxy (API keys stay server-side)
  // Reads SSE stream to keep Vercel connection alive past 15s timeout
  return async (
    messages: LLMChatMessage[],
    tools?: LLMToolDef[],
    onStream?: (delta: string) => void,
  ): Promise<LLMChatResponse> => {
    const response = await fetch("/api/llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ messages, tools }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "LLM request failed" }));
      throw new Error(data.error || `LLM request failed (${response.status})`);
    }

    // Accumulate SSE stream into a complete LLMChatResponse
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let content = "";
    const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (!json) continue;

        try {
          const event = JSON.parse(json);

          if (event.type === "content") {
            content += event.text;
            if (onStream && toolCallMap.size === 0) {
              onStream(event.text);
            }
          } else if (event.type === "tool_call") {
            const idx = event.index as number;
            const existing = toolCallMap.get(idx);
            if (!existing) {
              toolCallMap.set(idx, {
                id: event.id || "",
                name: event.function?.name || "",
                arguments: event.function?.arguments || "",
              });
            } else {
              if (event.id) existing.id = event.id;
              if (event.function?.name) existing.name += event.function.name;
              if (event.function?.arguments) existing.arguments += event.function.arguments;
            }
          } else if (event.type === "error") {
            throw new Error(event.message || "LLM stream error");
          }
          // "done" type — just let the loop finish
        } catch (e) {
          if (e instanceof SyntaxError) continue; // skip malformed JSON
          throw e;
        }
      }
    }

    // Build tool_calls array from accumulated chunks
    const toolCalls = toolCallMap.size > 0
      ? Array.from(toolCallMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([, tc]) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.arguments },
          }))
      : undefined;

    return { content, tool_calls: toolCalls };
  };
}

// ===========================================
// HOOK
// ===========================================

export function useOrchestrator(options: UseOrchestratorOptions) {
  const {
    repoId,
    repoFullName,
    defaultBranch,
    llmProvider,
    llmBaseUrl,
    llmModel,
    initialConversationId,
    initialMessages = [],
    initialWorkingBranch,
    initialExecutionState,
    onConversationCreated,
  } = options;

  // --- State ---
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId
  );
  const [isRunning, setIsRunning] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(
    initialExecutionState?.currentPlan || null
  );
  const [workingBranch, setWorkingBranch] = useState<string | null>(
    initialWorkingBranch || null
  );
  const [branchSelectionRequest, setBranchSelectionRequest] =
    useState<BranchSelectionRequest | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const branchLoadingRef = useRef(false);
  const pendingMessageRef = useRef<string | null>(null);
  const workingBranchRef = useRef<string | null>(workingBranch);
  const [filesChanged, setFilesChanged] = useState<string[]>(
    initialExecutionState?.filesChanged || []
  );
  const [prUrl, setPrUrl] = useState<string | null>(
    initialExecutionState?.prUrl || null
  );
  const [prNumber, setPrNumber] = useState<number | null>(
    initialExecutionState?.prNumber || null
  );
  const [executionProgress, setExecutionProgress] =
    useState<ExecutionProgress | null>(null);

  // --- Refs ---
  const executorRef = useRef<WebToolExecutor>(new WebToolExecutor(""));
  const chatFnRef = useRef<ChatFn>(createChatFn(llmProvider, llmBaseUrl, llmModel));
  const abortRef = useRef(false);
  // Mutable ref for conversationId so the event handler closure always sees latest
  const conversationIdRef = useRef(conversationId);
  // Mutable ref for execution progress so execution_complete can capture final steps/diffs
  const executionProgressRef = useRef<ExecutionProgress | null>(null);
  const executionStateRef = useRef<PersistedExecutionState>({
    filesChanged: initialExecutionState?.filesChanged || [],
    currentPlan: initialExecutionState?.currentPlan,
    prCreated: initialExecutionState?.prCreated,
    prUrl: initialExecutionState?.prUrl,
    prNumber: initialExecutionState?.prNumber,
  });

  // Keep refs in sync
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);
  useEffect(() => {
    executionProgressRef.current = executionProgress;
  }, [executionProgress]);

  // Sync state when conversation changes (navigation)
  useEffect(() => {
    setMessages(initialMessages);
    setConversationId(initialConversationId);
    setStreamingContent("");
    setToolActivity(null);
    setError(null);
    setCurrentPlan(initialExecutionState?.currentPlan || null);
    setWorkingBranch(initialWorkingBranch || null);
    setFilesChanged(initialExecutionState?.filesChanged || []);
    setPrUrl(initialExecutionState?.prUrl || null);
    setPrNumber(initialExecutionState?.prNumber || null);
    setBranchSelectionRequest(null);
    setExecutionProgress(null);
    executionStateRef.current = {
      filesChanged: initialExecutionState?.filesChanged || [],
      currentPlan: initialExecutionState?.currentPlan,
      prCreated: initialExecutionState?.prCreated,
      prUrl: initialExecutionState?.prUrl,
      prNumber: initialExecutionState?.prNumber,
    };
  }, [initialConversationId, initialMessages, initialWorkingBranch, initialExecutionState]);

  // ===========================================
  // BACKGROUND DB SAVES
  // ===========================================

  const saveMessageToDB = useCallback(
    async (convId: string, role: string, content: string, metadata?: Record<string, unknown>) => {
      try {
        await executorRef.current.saveMessage({
          conversationId: convId,
          role: role as "user" | "assistant" | "system" | "tool",
          content,
          metadata,
        });
      } catch (err) {
        console.error("[useOrchestrator] Failed to save message:", err);
      }
    },
    []
  );

  const saveExecutionStateToDB = useCallback(
    async (convId: string, state: PersistedExecutionState) => {
      try {
        // Save via a PATCH to the conversation (we need a route for this)
        await fetch(`/api/conversations/${convId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ execution_state: state }),
        });
      } catch (err) {
        console.error("[useOrchestrator] Failed to save execution state:", err);
      }
    },
    []
  );

  // ===========================================
  // ENSURE CONVERSATION EXISTS
  // ===========================================

  const ensureConversation = useCallback(
    async (title: string): Promise<string> => {
      if (conversationIdRef.current) return conversationIdRef.current;

      const shortTitle = title.slice(0, 100);
      const convId = await executorRef.current.createConversation({
        repoId,
        title: shortTitle,
      });

      setConversationId(convId);
      conversationIdRef.current = convId;

      // Notify parent so it can update sidebar
      onConversationCreated?.(convId, shortTitle);

      // Update URL without full page reload
      window.history.replaceState({}, "", `/repos/${repoId}/chat/${convId}`);

      return convId;
    },
    [repoId, onConversationCreated]
  );

  // ===========================================
  // EVENT HANDLER (orchestrator → React state)
  // ===========================================

  const handleEvent = useCallback(
    (event: StreamEvent) => {
      switch (event.type) {
        case "thinking":
          setToolActivity(event.message);
          break;

        case "tool_call":
          setToolActivity(`Using ${event.tool}...`);
          setStreamingContent(""); // Clear any partial streaming from previous LLM call
          break;

        case "tool_result":
          setToolActivity(null);
          break;

        case "message":
          if (event.partial) {
            setStreamingContent((prev) => prev + event.content);
          } else {
            setStreamingContent(event.content);
          }
          break;

        case "plan_pending": {
          setCurrentPlan(event.plan);
          setToolActivity(null);
          const planMetadata = { type: "plan", plan: event.plan, approved: undefined };
          // Add plan as an assistant message with rich metadata
          setMessages((prev) => [
            ...prev,
            {
              id: `plan-${Date.now()}`,
              role: "assistant",
              content: "",
              metadata: planMetadata,
              created_at: new Date().toISOString(),
            },
          ]);
          // Persist to DB
          if (conversationIdRef.current) {
            saveMessageToDB(conversationIdRef.current, "assistant", "", planMetadata).catch(console.error);
          }
          break;
        }

        case "branch_selection_required":
          // pendingMessageRef already set at start of runAgent
          // The orchestrator sends empty availableBranches — fetch real list from API
          setIsLoadingBranches(true);
          branchLoadingRef.current = true;
          executorRef.current
            .listBranches(repoId)
            .then((result) => {
              setBranchSelectionRequest({
                availableBranches: result.branches,
                suggestedName: event.request.suggestedName,
                defaultBase: result.defaultBranch,
                protectedBranches: result.protectedBranches,
              });
              setIsLoadingBranches(false);
              branchLoadingRef.current = false;
            })
            .catch(() => {
              setBranchSelectionRequest(event.request);
              setIsLoadingBranches(false);
              branchLoadingRef.current = false;
            });
          break;

        case "branch_selected":
          setWorkingBranch(event.branchName);
          setBranchSelectionRequest(null);
          break;

        case "execution_start": {
          setToolActivity(`Executing on branch: ${event.branchName}`);
          setExecutionProgress({
            currentStep: 0,
            totalSteps: 0,
            currentFile: null,
            status: "reading",
            steps: [],
          });
          // Mark the plan message as approved (in React state only —
          // the DB plan message still has approved: undefined, but the
          // execution_complete message saved later makes the final state clear)
          setMessages((prev) =>
            prev.map((m) =>
              m.metadata?.type === "plan" && m.metadata.approved === undefined
                ? { ...m, metadata: { ...m.metadata, approved: true } }
                : m
            )
          );
          // Add execution message
          const execContent = `Executing on branch \`${event.branchName}\`...`;
          const execMetadata = { type: "execution", steps: [], filesChanged: [], isComplete: false };
          setMessages((prev) => [
            ...prev,
            {
              id: `execution-${Date.now()}`,
              role: "assistant",
              content: execContent,
              metadata: execMetadata,
              created_at: new Date().toISOString(),
            },
          ]);
          // Don't persist yet — final state with diffs is saved at execution_complete
          break;
        }

        case "step_start":
          setExecutionProgress((prev) => {
            const steps = prev?.steps || [];
            // Add this step as in_progress
            const newStep: StepResult = {
              stepId: event.stepId,
              stepIndex: event.stepIndex,
              description: event.description,
              path: "",
              status: "in_progress",
            };
            return {
              currentStep: event.stepIndex + 1,
              totalSteps: event.totalSteps,
              currentFile: null,
              status: "reading",
              steps: [...steps, newStep],
            };
          });
          setToolActivity(
            `Step ${event.stepIndex + 1}/${event.totalSteps}: ${event.description}`
          );
          break;

        case "step_generating_code":
          setExecutionProgress((prev) => {
            if (!prev) return null;
            const steps = prev.steps.map((s) =>
              s.stepId === event.stepId ? { ...s, path: event.path } : s
            );
            return { ...prev, currentFile: event.path, status: "generating" as const, steps };
          });
          setToolActivity(`Generating code for ${event.path}...`);
          break;

        case "file_reading":
          setToolActivity(`Reading ${event.path}...`);
          break;

        case "file_writing":
          setExecutionProgress((prev) =>
            prev ? { ...prev, currentFile: event.path, status: "writing" as const } : null
          );
          setToolActivity(`Writing ${event.path}...`);
          break;

        case "file_written":
          setToolActivity(`Wrote ${event.path}`);
          break;

        case "step_diff":
          setExecutionProgress((prev) => {
            if (!prev) return null;
            const steps = prev.steps.map((s) =>
              s.stepId === event.stepId
                ? { ...s, path: event.path, diff: { oldString: event.oldString, newString: event.newString } }
                : s
            );
            return { ...prev, steps };
          });
          break;

        case "step_complete":
          setExecutionProgress((prev) => {
            if (!prev) return null;
            const steps = prev.steps.map((s) =>
              s.stepId === event.stepId
                ? { ...s, status: event.status as "completed" | "failed", error: event.error }
                : s
            );
            return { ...prev, steps };
          });
          break;

        case "execution_complete": {
          setFilesChanged(event.filesChanged);
          setToolActivity(null);
          const finalProgress = executionProgressRef.current;
          setExecutionProgress((prev) =>
            prev ? { ...prev, status: "complete" } : null
          );
          // Update execution message metadata with final state (steps + diffs)
          const finalExecMetadata = {
            type: "execution",
            steps: finalProgress?.steps || [],
            filesChanged: event.filesChanged,
            isComplete: true,
          };
          setMessages((prev) =>
            prev.map((m) =>
              m.metadata?.type === "execution" && !m.metadata.isComplete
                ? { ...m, metadata: finalExecMetadata }
                : m
            )
          );
          // Persist final execution state to DB (as a new message with all diffs)
          if (conversationIdRef.current) {
            const summary = `Execution complete. Changed ${event.filesChanged.length} file(s): ${event.filesChanged.join(", ")}`;
            saveMessageToDB(conversationIdRef.current, "assistant", summary, finalExecMetadata).catch(console.error);
          }
          break;
        }

        case "pr_created":
          setPrUrl(event.url);
          setPrNumber(event.number);
          setToolActivity(null);
          break;

        case "error":
          setError(event.message);
          break;

        case "done":
          setToolActivity(null);
          break;
      }
    },
    [repoId]
  );

  // ===========================================
  // RUN ORCHESTRATOR
  // ===========================================

  const runAgent = useCallback(
    async (userMessage: string) => {
      if (isRunning) return;

      // Save in case branch selection triggers and we need to re-send
      pendingMessageRef.current = userMessage;

      setIsRunning(true);
      setError(null);
      setStreamingContent("");
      setToolActivity(null);
      abortRef.current = false;

      try {
        // Guard 1: Ensure conversation exists
        const convId = await ensureConversation(userMessage);

        // Build conversation history for agent context
        const agentMessages: AgentMessage[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Build context
        const context: AgentContext = {
          repoId,
          userId: "", // Not needed client-side (auth is cookie-based)
          conversationId: convId,
          githubToken: "", // Not needed (goes through API proxy)
          repoFullName,
          defaultBranch,
          workingBranch: workingBranchRef.current || undefined,
          messages: agentMessages,
          llmConfig: {
            provider: llmProvider as LLMConfig["provider"],
            baseUrl: llmBaseUrl || "",
            model: llmModel || "",
          },
          embeddingConfig: {
            provider: "openai", // Doesn't matter — search goes through API proxy
            apiKey: "",
          },
        };

        // Fetch custom instructions and inject into context
        try {
          const instructions = await executorRef.current.getCustomInstructions(repoId);
          if (instructions) {
            context.customInstructions = instructions;
          }
        } catch {
          // Instructions fetch failed — continue without them
        }

        // Save user message to DB in background
        saveMessageToDB(convId, "user", userMessage).catch(console.error);

        // Run orchestrator (this is the agent loop — may take a while)
        const result = await runOrchestrator(
          userMessage,
          context,
          executorRef.current,
          chatFnRef.current,
          handleEvent,
          executionStateRef.current
        );

        // Update execution state ref
        executionStateRef.current = result.executionState;

        // Add assistant response to messages
        if (result.response) {
          let responseContent = result.response.trim();
          if (/confirm.*branch|select.*branch|branch.*you.*like|choose.*branch/i.test(responseContent)) {
            responseContent = "Please select a branch to continue.";
          }

          const assistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: responseContent,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setStreamingContent("");

          // Save assistant message to DB in background
          saveMessageToDB(convId, "assistant", result.response, {
            hasPlan: !!result.plan,
            planId: result.plan?.id,
          }).catch(console.error);
        }

        // Update plan state
        if (result.plan) {
          setCurrentPlan(result.plan);
        } else {
          setCurrentPlan(null);
        }

        // Save execution state to DB in background
        saveExecutionStateToDB(convId, result.executionState).catch(
          console.error
        );
      } catch (err) {
        if (abortRef.current) return;
        const msg = err instanceof Error ? err.message : "An error occurred";
        setError(msg);
        console.error("[useOrchestrator] Error:", err);
      } finally {
        setIsRunning(false);
        setToolActivity(null);
      }
    },
    [
      isRunning,
      messages,
      repoId,
      repoFullName,
      defaultBranch,
      workingBranch,
      ensureConversation,
      handleEvent,
      saveMessageToDB,
      saveExecutionStateToDB,
    ]
  );

  // ===========================================
  // BRANCH FETCHING HELPER
  // ===========================================

  // Shared helper: fetch branches from API and show modal
  const fetchAndShowBranchSelector = useCallback(
    async (suggestedName = "feature/codeteel-changes") => {
      setIsLoadingBranches(true);
      try {
        const result = await executorRef.current.listBranches(repoId);
        setBranchSelectionRequest({
          availableBranches: result.branches,
          suggestedName,
          defaultBase: result.defaultBranch,
          protectedBranches: result.protectedBranches,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load branches";
        setError(msg);
      } finally {
        setIsLoadingBranches(false);
      }
    },
    [repoId]
  );

  // ===========================================
  // PLAN APPROVAL (UI button or text)
  // ===========================================

  const handleApprove = useCallback(async () => {
    if (!currentPlan) return;

    // Guard 3: Branch must be selected before execution
    if (!workingBranch) {
      // Fetch branches from API, then show modal — callback will re-call handleApprove
      await fetchAndShowBranchSelector();
      return;
    }

    // Add a user message for the approval (visible in chat)
    const approveMsg: Message = {
      id: `user-approve-${Date.now()}`,
      role: "user",
      content: "Yes, proceed with the plan",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, approveMsg]);

    // Execute the plan by telling the orchestrator "yes"
    await runAgent("yes, proceed with the plan");
  }, [currentPlan, workingBranch, fetchAndShowBranchSelector, runAgent]);

  const handleReject = useCallback(async () => {
    setCurrentPlan(null);
    executionStateRef.current = {
      ...executionStateRef.current,
      currentPlan: undefined,
    };

    // Mark the plan message as rejected
    setMessages((prev) =>
      prev.map((m) =>
        m.metadata?.type === "plan" && m.metadata.approved === undefined
          ? { ...m, metadata: { ...m.metadata, approved: false } }
          : m
      )
    );

    // Add user rejection message + assistant response
    const userRejectMsg: Message = {
      id: `user-reject-${Date.now()}`,
      role: "user",
      content: "No, reject the plan",
      created_at: new Date().toISOString(),
    };
    const assistantMsg: Message = {
      id: `assistant-reject-${Date.now()}`,
      role: "assistant",
      content: "Plan rejected. Let me know if you'd like me to try a different approach.",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userRejectMsg, assistantMsg]);

    // Save to DB
    if (conversationId) {
      saveMessageToDB(conversationId, "assistant", assistantMsg.content).catch(
        console.error
      );
      saveExecutionStateToDB(conversationId, executionStateRef.current).catch(
        console.error
      );
    }
  }, [conversationId, saveMessageToDB, saveExecutionStateToDB]);

  // ===========================================
  // NEW CHAT
  // ===========================================

  const newChat = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    conversationIdRef.current = undefined;
    setStreamingContent("");
    setToolActivity(null);
    setError(null);
    setCurrentPlan(null);
    setWorkingBranch(null);
    setBranchSelectionRequest(null);
    setFilesChanged([]);
    setPrUrl(null);
    setPrNumber(null);
    setExecutionProgress(null);
    executionStateRef.current = { filesChanged: [] };
  }, []);

  // ===========================================
  // SLASH COMMAND HANDLER
  // ===========================================

  // Ephemeral: only add to React state (help, branches, unknown, etc.)
  const addSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `system-${Date.now()}`,
        role: "assistant" as const,
        content,
        created_at: new Date().toISOString(),
      },
    ]);
  }, []);

  // Persistent: add to React state AND save to DB
  const addAndSaveMessage = useCallback(
    (convId: string, role: "user" | "assistant", content: string, metadata?: Record<string, unknown>) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${role}-${Date.now()}`,
          role,
          content,
          metadata,
          created_at: new Date().toISOString(),
        },
      ]);
      saveMessageToDB(convId, role, content, metadata).catch(console.error);
    },
    [saveMessageToDB]
  );

  // Commands that persist results to DB
  const PERSISTENT_COMMANDS = new Set(["security", "review", "compact", "diff", "reset", "pr", "undo"]);

  const handleCommand = useCallback(
    async (input: string): Promise<boolean> => {
      if (!isCommand(input)) return false;

      const { name, args } = parseCommand(input);
      const shouldPersist = PERSISTENT_COMMANDS.has(name);

      // Auto-create conversation for persistent commands
      let convId = conversationIdRef.current;
      if (shouldPersist && !convId) {
        convId = await ensureConversation(input);
      }

      // Show the command as a user message
      if (shouldPersist && convId) {
        addAndSaveMessage(convId, "user", input);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `user-${Date.now()}`,
            role: "user",
            content: input,
            created_at: new Date().toISOString(),
          },
        ]);
      }

      // Helper: add response (persistent or ephemeral based on command)
      const respond = (content: string, metadata?: Record<string, unknown>) => {
        if (shouldPersist && convId) {
          addAndSaveMessage(convId, "assistant", content, metadata);
        } else {
          addSystemMessage(content);
        }
      };

      switch (name) {
        // ── /help ── (ephemeral)
        case "help": {
          addSystemMessage(HELP_TEXT);
          return true;
        }

        // ── /clear ── (ephemeral — destroys conversation)
        case "clear": {
          newChat();
          window.history.replaceState({}, "", `/repos/${repoId}/chat`);
          return true;
        }

        // ── /reset ── (persistent)
        case "reset": {
          setCurrentPlan(null);
          setFilesChanged([]);
          setPrUrl(null);
          setPrNumber(null);
          setExecutionProgress(null);
          setError(null);
          executionStateRef.current = { filesChanged: [] };
          if (convId) {
            saveExecutionStateToDB(convId, { filesChanged: [] }).catch(console.error);
          }
          respond("Execution state cleared. Plan, files changed, and PR state have been reset.");
          return true;
        }

        // ── /branch [name] ── (ephemeral)
        case "branch": {
          if (args) {
            setWorkingBranch(args);
            workingBranchRef.current = args;
            if (convId) {
              fetch(`/api/conversations/${convId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ working_branch: args }),
              }).catch(console.error);
            }
            addSystemMessage(`Switched to branch \`${args}\`.`);
          } else {
            await fetchAndShowBranchSelector();
          }
          return true;
        }

        // ── /branches ── (ephemeral)
        case "branches": {
          setToolActivity("Loading branches...");
          try {
            const result = await executorRef.current.listBranches(repoId);
            const current = workingBranch;
            const list = result.branches
              .map((b) => {
                const marker = b.name === current ? " **(current)**" : "";
                const protectedBadge = b.protected ? " (protected)" : "";
                return `- \`${b.name}\`${marker}${protectedBadge}`;
              })
              .join("\n");
            addSystemMessage(`**Branches:**\n\n${list}\n\nDefault: \`${result.defaultBranch}\``);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to list branches";
            addSystemMessage(`Error: ${msg}`);
          }
          setToolActivity(null);
          return true;
        }

        // ── /security [path | pr N] ── (persistent)
        case "security": {
          setIsRunning(true);
          setToolActivity("Running security scan...");
          try {
            let scanPath: string | undefined;
            let scanPR: number | undefined;

            const prMatch = args.match(/^pr\s+(\d+)$/i);
            if (prMatch) {
              scanPR = parseInt(prMatch[1], 10);
            } else if (args) {
              scanPath = args;
            }

            const context: AgentContext = {
              repoId,
              userId: "",
              conversationId: convId || "",
              githubToken: "",
              repoFullName,
              defaultBranch,
              workingBranch: workingBranch || undefined,
              messages: [],
              llmConfig: { provider: llmProvider as LLMConfig["provider"], baseUrl: llmBaseUrl || "", model: llmModel || "" },
              embeddingConfig: { provider: "openai", apiKey: "" },
            };

            const result = await securityScan(
              context, executorRef.current, chatFnRef.current,
              (e) => { if (e.type === "thinking") setToolActivity(e.message); },
              scanPath, scanPR,
            );
            respond(result.error || result.report, { type: "security_scan", scope: scanPR ? `pr:${scanPR}` : scanPath || "full" });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Security scan failed";
            respond(`Error: ${msg}`);
          }
          setIsRunning(false);
          setToolActivity(null);
          return true;
        }

        // ── /review pr [N] ── (persistent)
        case "review": {
          setIsRunning(true);
          setToolActivity("Reviewing...");
          try {
            const prMatch = args.match(/^pr(?:\s+(\d+))?$/i);
            if (!prMatch) {
              respond("Usage: `/review pr` (list PRs) or `/review pr 42` (review specific PR)");
              setIsRunning(false);
              setToolActivity(null);
              return true;
            }

            const context: AgentContext = {
              repoId,
              userId: "",
              conversationId: convId || "",
              githubToken: "",
              repoFullName,
              defaultBranch,
              workingBranch: workingBranch || undefined,
              messages: [],
              llmConfig: { provider: llmProvider as LLMConfig["provider"], baseUrl: llmBaseUrl || "", model: llmModel || "" },
              embeddingConfig: { provider: "openai", apiKey: "" },
            };

            const num = prMatch[1] ? parseInt(prMatch[1], 10) : undefined;
            if (!num) {
              const list = await listOpenPRs(context, executorRef.current);
              respond(list, { type: "pr_list" });
            } else {
              const result = await reviewPR(
                num, context, executorRef.current, chatFnRef.current,
                (e) => { if (e.type === "thinking") setToolActivity(e.message); },
              );
              respond(result.error || result.review, { type: "pr_review", prNumber: num });
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Review failed";
            respond(`Error: ${msg}`);
          }
          setIsRunning(false);
          setToolActivity(null);
          return true;
        }

        // ── /compact ── (persistent)
        case "compact": {
          if (!convId) {
            addSystemMessage("No conversation to compact.");
            return true;
          }
          setIsRunning(true);
          setToolActivity("Compressing conversation...");
          try {
            const existing = await executorRef.current.getChatSummary(convId);
            const result = await compressConversation(
              convId,
              executorRef.current,
              chatFnRef.current,
              existing,
              0,
            );
            if (result) {
              respond(`Conversation compressed. ${result.tokensCompressed.toLocaleString()} tokens summarized.`, { type: "compact", tokensCompressed: result.tokensCompressed });
            } else {
              respond("Nothing to compress — conversation is too short.");
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Compression failed";
            respond(`Error: ${msg}`);
          }
          setIsRunning(false);
          setToolActivity(null);
          return true;
        }

        // ── /pr ── (persistent — delegates to orchestrator)
        case "pr": {
          if (!workingBranch) {
            respond("No working branch set. Select a branch first with `/branch`.");
            return true;
          }
          if (filesChanged.length === 0) {
            respond("No files have been changed. Make some changes first.");
            return true;
          }
          if (prUrl) {
            respond(`PR already created: ${prUrl}`);
            return true;
          }
          await runAgent("Create a pull request for the changes made");
          return true;
        }

        // ── /diff ── (persistent)
        case "diff": {
          if (filesChanged.length === 0) {
            respond("No files have been changed in this conversation.");
            return true;
          }
          const fileList = filesChanged.map((f) => `- \`${f}\``).join("\n");
          let diffMsg = `**Files changed (${filesChanged.length}):**\n\n${fileList}`;
          if (workingBranch) {
            diffMsg += `\n\nBranch: \`${workingBranch}\``;
          }
          if (prUrl) {
            diffMsg += `\nPR: ${prUrl}`;
          }
          respond(diffMsg, { type: "diff", filesChanged });
          return true;
        }

        // ── /undo ── (persistent — delegates to orchestrator)
        case "undo": {
          if (!workingBranch) {
            respond("No working branch set. Nothing to undo.");
            return true;
          }
          if (filesChanged.length === 0) {
            respond("No file changes to undo.");
            return true;
          }
          await runAgent(`Revert the last file change on branch ${workingBranch}. The last changed file was: ${filesChanged[filesChanged.length - 1]}`);
          return true;
        }

        default: {
          addSystemMessage(`Unknown command: \`/${name}\`. Type \`/help\` for available commands.`);
          return true;
        }
      }
    },
    [
      repoId, repoFullName, defaultBranch, workingBranch,
      filesChanged, prUrl, llmProvider, llmBaseUrl, llmModel,
      newChat, fetchAndShowBranchSelector, runAgent, ensureConversation,
      addSystemMessage, addAndSaveMessage, saveExecutionStateToDB,
    ]
  );

  // ===========================================
  // SEND MESSAGE (with approval/rejection guard)
  // ===========================================

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isRunning) return;

      // Guard 0: Slash commands (before everything else)
      if (isCommand(content.trim())) {
        await handleCommand(content.trim());
        return;
      }

      // Guard 2: Text approval/rejection (before LLM)
      // handleApprove/handleReject add their own user messages, so skip adding one here
      if (currentPlan) {
        if (isApprovalText(content)) {
          handleApprove();
          return;
        }
        if (isRejectionText(content)) {
          handleReject();
          return;
        }
      }

      // Add user message to UI immediately
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Normal message → run orchestrator
      await runAgent(content);
    },
    [isRunning, currentPlan, runAgent, handleApprove, handleReject, handleCommand]
  );

  // ===========================================
  // BRANCH SELECTION
  // ===========================================

  const handleBranchSelect = useCallback(
    async (branchName: string, isNew: boolean, baseBranch?: string) => {
      setError(null);

      try {
        if (isNew) {
          await executorRef.current.createBranch(repoId, {
            name: branchName,
            baseBranch,
          });
        }

        setWorkingBranch(branchName);
        workingBranchRef.current = branchName;
        setBranchSelectionRequest(null);

        // Save to conversation if it exists
        if (conversationId) {
          await fetch(`/api/conversations/${conversationId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ working_branch: branchName }),
          });
        }

        // Re-send the pending message or approve the plan
        if (currentPlan) {
          setTimeout(() => {
            runAgent("yes, proceed with the plan");
          }, 100);
        } else if (pendingMessageRef.current) {
          const msg = pendingMessageRef.current;
          pendingMessageRef.current = null;
          setTimeout(() => {
            runAgent(msg);
          }, 100);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to select branch";
        setError(msg);
      }
    },
    [repoId, conversationId, currentPlan, runAgent]
  );

  const handleBranchCancel = useCallback(() => {
    setBranchSelectionRequest(null);
  }, []);

  const openBranchSelector = useCallback(async () => {
    if (workingBranch) return;
    await fetchAndShowBranchSelector();
  }, [workingBranch, fetchAndShowBranchSelector]);

  // ===========================================
  // ABORT / CLEANUP
  // ===========================================

  const abort = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
    setToolActivity(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);


  // ===========================================
  // RETURN
  // ===========================================

  return {
    // State
    state: {
      messages,
      isRunning,
      streamingContent,
      toolActivity,
      error,
      currentPlan,
      workingBranch,
      branchSelectionRequest,
      isLoadingBranches,
      filesChanged,
      prUrl,
      prNumber,
      conversationId,
      executionProgress,
    } as OrchestratorState,

    // Actions
    sendMessage,
    handleApprove,
    handleReject,
    handleBranchSelect,
    handleBranchCancel,
    openBranchSelector,
    abort,
    newChat,
  };
}
