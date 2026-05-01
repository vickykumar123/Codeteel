// Agent types and interfaces

// ===========================================
// TOOL DEFINITIONS
// ===========================================

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required?: boolean;
  enum?: string[];
  items?: {
    type: string;
    properties?: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
  error?: boolean;
}

// ===========================================
// MESSAGES
// ===========================================

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

// ===========================================
// AGENT CONTEXT
// ===========================================

export interface AgentContext {
  repoId: string;
  userId: string;
  conversationId: string;
  githubToken: string;
  repoFullName: string;
  defaultBranch: string;
  workingBranch?: string; // Selected branch for edits (main/master protected)
  messages: AgentMessage[];
  llmConfig: LLMConfig;
  embeddingConfig: EmbeddingConfig;
  customInstructions?: string; // Merged user + repo + team instructions for system prompt
}

export type LLMProvider = "ollama" | "openai" | "claude" | "gemini" | "grok" | "qwen" | "fireworks" | "together";

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export interface EmbeddingConfig {
  provider: "openai" | "gemini" | "mistral" | "voyage" | "cohere";
  apiKey: string;
  model?: string;
}

// ===========================================
// PLAN
// ===========================================

export interface PlanStep {
  id: string;
  type: "create" | "modify" | "delete";
  path: string;
  description: string; // Human-readable: WHAT to change (code generated at execution time)
}

export interface Plan {
  id: string;
  title: string;
  summary: string;
  steps: PlanStep[];
  filesAffected: string[];
  estimatedChanges: number;
  createdAt: string;
}

// ===========================================
// AGENT TYPES
// ===========================================

export type AgentType = "orchestrator" | "search" | "planner" | "executor";

export interface AgentConfig {
  type: AgentType;
  maxIterations: number;
  tools: Tool[];
  systemPrompt: string;
}

// ===========================================
// BRANCH SELECTION
// ===========================================

export interface BranchInfo {
  name: string;
  sha?: string;
  protected: boolean;
  aheadBy?: number;
}

export interface BranchSelectionRequest {
  availableBranches: BranchInfo[];
  suggestedName: string;
  defaultBase: string;
  protectedBranches: string[];
}

export interface BranchSelectionResponse {
  action: "select_existing" | "create_new";
  branchName: string;
  baseBranch?: string; // Only for create_new
}

// ===========================================
// EXECUTION TASKS (Todo List)
// ===========================================

export interface ExecutionTask {
  id: string;
  planStepId: string;
  content: string;
  activeForm: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// ===========================================
// STREAMING EVENTS
// ===========================================

export type StreamEvent =
  | { type: "thinking"; message: string }
  | { type: "conversation_created"; conversationId: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; tool: string; result: string; error?: boolean }
  | { type: "message"; content: string; partial?: boolean }
  | { type: "plan_pending"; plan: Plan }
  | { type: "branch_selection_required"; request: BranchSelectionRequest }
  | { type: "branch_selected"; branchName: string }
  | { type: "execution_start"; branchName: string }
  | { type: "step_start"; stepId: string; stepIndex: number; totalSteps: number; description: string }
  | { type: "step_generating_code"; stepId: string; path: string }
  | { type: "file_reading"; path: string }
  | { type: "file_writing"; path: string }
  | { type: "file_written"; path: string }
  | { type: "step_diff"; stepId: string; path: string; oldString: string; newString: string }
  | { type: "step_complete"; stepId: string; status: "completed" | "failed"; error?: string }
  | { type: "execution_complete"; filesChanged: string[] }
  | { type: "pr_created"; url: string; number: number }
  | { type: "error"; message: string }
  | { type: "done" };

// ===========================================
// LLM CHAT FUNCTION (injected into agents)
// ===========================================

/** LLM message format (OpenAI-compatible) */
export interface LLMChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
  name?: string;
}

/** Tool call from LLM response */
export interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/** Tool definition for LLM */
export interface LLMToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** LLM response */
export interface LLMChatResponse {
  content: string;
  tool_calls?: LLMToolCall[];
}

/**
 * Injected chat function so agent modules don't import @/lib/llm directly.
 * The caller (useOrchestrator hook or server code) creates this as a closure
 * over the LLM config (provider, API key, model, etc.).
 */
export type ChatFn = (
  messages: LLMChatMessage[],
  tools?: LLMToolDef[],
) => Promise<LLMChatResponse>;

// ===========================================
// SEARCH RESULTS
// ===========================================

export interface SearchResult {
  id: string;
  path: string;
  language: string | null;
  summary: string | null;
  code: string | null;
  similarity: number;
}

// ===========================================
// EXECUTION RESULT
// ===========================================

export interface ExecutionResult {
  success: boolean;
  branchName?: string;
  prUrl?: string;
  prNumber?: number;
  filesChanged?: string[];
  error?: string;
}

// ===========================================
// PERSISTED EXECUTION STATE
// ===========================================

/**
 * State that persists across HTTP requests in the conversation.
 * Stored in conversations.execution_state JSONB column.
 */
/** Search journal entry — tracks what was searched and found */
export interface SearchJournalEntry {
  query: string;
  filesFound: string[];
  summary: string;
}

export interface PersistedExecutionState {
  /** Files that have been changed in this conversation */
  filesChanged: string[];
  /** The current plan (if any) that was created and may be executed */
  currentPlan?: Plan;
  /** Whether a PR has been created for this conversation */
  prCreated?: boolean;
  /** The PR URL if created */
  prUrl?: string;
  /** The PR number if created */
  prNumber?: number;
  /** Search journal — recent searches to avoid redundant lookups (max 7) */
  searchJournal?: SearchJournalEntry[];
}
