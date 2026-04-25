/**
 * ToolExecutor Interface
 *
 * Swappable interface for executing agent tools.
 * Same interface for all platforms:
 *   - WebToolExecutor: fetch() → /api/* (browser + test scripts)
 *   - ServerToolExecutor: direct DB/GitHub calls (Slack/Telegram webhooks)
 */

// ===========================================
// SEARCH
// ===========================================

export interface SearchResult {
  path: string;
  language: string | null;
  summary: string | null;
  similarity: number;
  code?: string | null;
}

export interface SemanticSearchParams {
  query: string;
  limit?: number;
}

export interface TextSearchParams {
  query: string;
  filePattern?: string;
  limit?: number;
}

export interface GrepParams {
  pattern: string;
  isRegex?: boolean;
  filePattern?: string;
  contextLines?: number;
  limit?: number;
}

export interface GrepMatch {
  path: string;
  language: string | null;
  lineNumber: number;
  lineContent: string;
  isMatch: boolean;
  matchGroup: number;
}

// ===========================================
// FILE OPERATIONS
// ===========================================

export interface FileContent {
  path: string;
  content: string;
  sha: string;
  language?: string;
  summary?: string;
}

export interface ReadFileParams {
  path: string;
  startLine?: number;
  endLine?: number;
}

export interface WriteFileParams {
  path: string;
  content: string;
  message: string;
  branch: string;
  sha?: string; // Required for updating existing files
}

export interface EditFileParams {
  path: string;
  oldString: string;
  newString: string;
  message: string;
  branch: string;
}

export interface DeleteFileParams {
  path: string;
  message: string;
  branch: string;
}

// Batch commit: multiple file changes in a single commit (Git Trees API)
export interface BatchFileChange {
  path: string;
  content: string | null; // null = delete file
}

export interface CommitFilesParams {
  branch: string;
  message: string;
  files: BatchFileChange[];
}

// ===========================================
// BRANCH OPERATIONS
// ===========================================

export interface BranchInfo {
  name: string;
  sha: string;
  protected: boolean;
  aheadBy?: number;
}

export interface CreateBranchParams {
  name: string;
  baseBranch?: string;
}

export interface BranchListResult {
  branches: BranchInfo[];
  defaultBranch: string;
  protectedBranches: string[];
}

// ===========================================
// PR OPERATIONS
// ===========================================

export interface CreatePRParams {
  title: string;
  body: string;
  head: string;
  base: string;
}

export interface PRResult {
  url: string;
  number: number;
}

export interface PRSummary {
  number: number;
  title: string;
  state: string;
  user: string;
  createdAt: string;
  url: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface PRDiff {
  number: number;
  title: string;
  body: string;
  user: string;
  url: string;
  baseBranch: string;
  headBranch: string;
  files: PRDiffFile[];
  comments: PRComment[];
}

export interface PRDiffFile {
  filename: string;
  status: string; // added, removed, modified, renamed
  additions: number;
  deletions: number;
  patch: string; // unified diff
}

export interface PRComment {
  user: string;
  body: string;
  createdAt: string;
  path?: string;    // file path (for review comments)
  line?: number;    // line number (for review comments)
}

export interface IssueSummary {
  number: number;
  title: string;
  state: string;
  user: string;
  labels: string[];
  createdAt: string;
  url: string;
  commentCount: number;
}

export interface IssueDetail {
  number: number;
  title: string;
  body: string;
  state: string;
  user: string;
  labels: string[];
  url: string;
  createdAt: string;
  comments: { user: string; body: string; createdAt: string }[];
}

// ===========================================
// CONVERSATION OPERATIONS
// ===========================================

export interface CreateConversationParams {
  repoId: string;
  title?: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: unknown;
  toolCallId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SaveMessageParams {
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: unknown;
  toolCallId?: string;
  metadata?: Record<string, unknown>;
}

// ===========================================
// LIST FILES
// ===========================================

export interface ListFilesParams {
  language?: string;
  pattern?: string;
  limit?: number;
}

export interface FileInfo {
  path: string;
  language: string | null;
  size: number | null;
}

export interface ListCodeDefinitionsParams {
  pattern: string;
  limit?: number;
}

export interface CodeDefinition {
  path: string;
  language: string | null;
  summary: string | null;
}

// ===========================================
// CHAT SUMMARY
// ===========================================

export interface ChatSummaryRecord {
  conversationId: string;
  summary: string;
  lastMessageId: string;
  tokensCompressed: number;
}

// ===========================================
// TOOL EXECUTOR INTERFACE
// ===========================================

export interface ToolExecutor {
  // Search
  semanticSearch(repoId: string, params: SemanticSearchParams): Promise<SearchResult[]>;
  textSearch(repoId: string, params: TextSearchParams): Promise<SearchResult[]>;
  grepSearch(repoId: string, params: GrepParams): Promise<GrepMatch[]>;

  // File reading (from indexed DB)
  readFile(repoId: string, params: ReadFileParams): Promise<FileContent | null>;
  listFiles(repoId: string, params: ListFilesParams): Promise<FileInfo[]>;
  listCodeDefinitions(repoId: string, params: ListCodeDefinitionsParams): Promise<CodeDefinition[]>;

  // File writing (via GitHub API)
  readFileFromGitHub(repoId: string, path: string, branch: string): Promise<FileContent | null>;
  writeFile(repoId: string, params: WriteFileParams): Promise<void>;
  deleteFile(repoId: string, params: DeleteFileParams): Promise<void>;
  commitFiles(repoId: string, params: CommitFilesParams): Promise<void>;

  // Branches
  listBranches(repoId: string): Promise<BranchListResult>;
  createBranch(repoId: string, params: CreateBranchParams): Promise<BranchInfo>;

  // PR
  createPR(repoId: string, params: CreatePRParams): Promise<PRResult>;
  listPRs(repoId: string, state?: "open" | "closed" | "all"): Promise<PRSummary[]>;
  getPRDiff(repoId: string, prNumber: number): Promise<PRDiff>;

  // Issues
  listIssues(repoId: string, state?: "open" | "closed" | "all"): Promise<IssueSummary[]>;
  getIssue(repoId: string, issueNumber: number): Promise<IssueDetail>;

  // Conversations
  createConversation(params: CreateConversationParams): Promise<string>; // returns conversationId
  getMessages(conversationId: string): Promise<ConversationMessage[]>;
  saveMessage(params: SaveMessageParams): Promise<void>;

  // Chat Summaries (compression)
  getChatSummary(conversationId: string): Promise<ChatSummaryRecord | null>;
  upsertChatSummary(summary: ChatSummaryRecord): Promise<void>;

  // Web Search & Fetch
  webSearch(query: string, limit?: number): Promise<{ title: string; url: string; snippet: string }[]>;
  webFetch(url: string): Promise<{ url: string; title: string; content: string }>;

  // Custom Instructions
  getCustomInstructions(repoId: string): Promise<string | null>;
}
