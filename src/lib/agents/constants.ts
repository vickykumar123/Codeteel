// ===========================================
// AGENT CONSTANTS (single source of truth)
// ===========================================

// --- Orchestrator ---
export const MAX_ORCHESTRATOR_ITERATIONS = 20;
export const SAME_ACTION_LIMIT = 3;

// --- Planner ---
export const MAX_PLANNER_ITERATIONS = 15;

// --- Search ---
export const MAX_SEARCH_RESULTS = 20;
export const MAX_LIST_FILES = 100;
export const READ_DEDUP_WARN_THRESHOLD = 3;

// --- Executor ---
export const MAX_EDIT_RETRIES = 3;
export const PROTECTED_BRANCHES = ["main", "master"];
/** Files with fewer lines than this use full-file replacement instead of old_string/new_string */
export const SMALL_FILE_THRESHOLD = 20;

// --- Search Token Limits ---
/** Max chars for any single tool result appended to search conversation */
export const MAX_TOOL_RESULT_CHARS = 8_000;
/** Lines of code preview when read_file is called without line range */
export const READ_FILE_PREVIEW_LINES = 50;
/** Max grep matches returned */
export const MAX_GREP_MATCHES = 20;

// --- LLM Provider Defaults ---
/** Default base URLs for each LLM provider (OpenAI-compatible endpoints) */
export const LLM_PROVIDER_BASE_URLS: Record<string, string> = {
  ollama:    "http://localhost:11434/v1",
  openai:    "https://api.openai.com/v1",
  claude:    "https://api.anthropic.com/v1",
  gemini:    "https://generativelanguage.googleapis.com/v1beta/openai",
  grok:      "https://api.x.ai/v1",
  qwen:      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  together:  "https://api.together.xyz/v1",
};

// --- Chat Compression ---
/** Token threshold to trigger compression */
export const COMPRESSION_TOKEN_THRESHOLD = 100_000;
/** Percentage of messages to compress (0-1) */
export const COMPRESSION_RATIO = 0.6;
