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
// CHAT FUNCTION
// ===========================================

// Local providers (Ollama) → direct browser fetch (no proxy needed)
// Cloud providers (OpenAI, Claude, Gemini, etc.) → /api/llm/chat proxy (keeps API keys server-side)

function createChatFn(llmProvider: string, llmBaseUrl?: string, llmModel?: string): ChatFn {
  if (llmProvider === "ollama") {
    // Direct browser → Ollama (OpenAI-compatible API, no proxy needed)
    const baseUrl = llmBaseUrl || "http://localhost:11434/v1";
    const model = llmModel || "llama3";

    return async (
      messages: LLMChatMessage[],
      tools?: LLMToolDef[]
    ): Promise<LLMChatResponse> => {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          tools: tools && tools.length > 0 ? tools : undefined,
          tool_choice: tools && tools.length > 0 ? "auto" : undefined,
          temperature: undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Ollama request failed" }));
        throw new Error(data.error?.message || data.error || `Ollama request failed (${response.status})`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      // Parse OpenAI-compatible response into LLMChatResponse
      const toolCalls = message?.tool_calls
        ?.filter((tc: { type: string }) => tc.type === "function")
        .map((tc: { id: string; type: string; function: { name: string; arguments: string } }) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        }));

      return {
        content: message?.content || "",
        tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      };
    };
  }

  // Cloud providers → streaming proxy (API keys stay server-side)
  // Reads SSE stream to keep Vercel connection alive past 15s timeout
  return async (
    messages: LLMChatMessage[],
    tools?: LLMToolDef[]
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
          workingBranch: workingBranch || undefined,
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
          // Normalize branch selection messages (LLM sometimes writes verbose text)
          let responseContent = result.response
            .replace(/\n*\s*CONFIRMED\.?\s*$/i, "")
            .replace(/\n*\s*END\.?\s*$/i, "")
            .trim();
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
  // SEND MESSAGE (with approval/rejection guard)
  // ===========================================

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isRunning) return;

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
    [isRunning, currentPlan, runAgent, handleApprove, handleReject]
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

        // If we were waiting on branch to approve, now approve
        if (currentPlan) {
          // Small delay so state updates propagate
          setTimeout(() => {
            runAgent("yes, proceed with the plan");
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
