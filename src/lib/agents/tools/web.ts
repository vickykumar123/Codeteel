/**
 * WebToolExecutor
 *
 * Implements ToolExecutor via fetch() → /api/* routes.
 * Used by:
 *   - Browser (React useOrchestrator hook)
 *   - Test scripts (same fetch pattern, no React needed)
 *
 * All requests are authenticated via Supabase session cookie (browser)
 * or Authorization header (test scripts).
 */

import type {
  ToolExecutor,
  SearchResult,
  SemanticSearchParams,
  TextSearchParams,
  GrepParams,
  GrepMatch,
  FileContent,
  ReadFileParams,
  WriteFileParams,
  DeleteFileParams,
  CommitFilesParams,
  ListFilesParams,
  FileInfo,
  ListCodeDefinitionsParams,
  CodeDefinition,
  BranchListResult,
  BranchInfo,
  CreateBranchParams,
  CreatePRParams,
  PRResult,
  PRSummary,
  PRDiff,
  IssueSummary,
  IssueDetail,
  CreateConversationParams,
  ConversationMessage,
  SaveMessageParams,
  ChatSummaryRecord,
} from "./interface";

export class WebToolExecutor implements ToolExecutor {
  private baseUrl: string;
  private headers: Record<string, string>;

  /**
   * @param baseUrl - API base URL (e.g., "http://localhost:9999" or "" for same-origin)
   * @param auth - Optional auth: { token } for Bearer auth, or { cookie } for cookie auth (test scripts)
   */
  constructor(baseUrl: string = "", auth?: { token?: string; cookie?: string }) {
    this.baseUrl = baseUrl;
    this.headers = {
      "Content-Type": "application/json",
      ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...(auth?.cookie ? { Cookie: auth.cookie } : {}),
    };
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers, ...options?.headers },
      credentials: "include", // Send cookies for browser auth
    });

    if (!response.ok) {
      const body = await response.text();
      let message: string;
      try {
        message = JSON.parse(body).error || body;
      } catch {
        message = body;
      }
      throw new Error(`API ${response.status}: ${message}`);
    }

    return response.json();
  }

  // ===========================================
  // SEARCH
  // ===========================================

  async semanticSearch(repoId: string, params: SemanticSearchParams): Promise<SearchResult[]> {
    const data = await this.fetch<{ results: SearchResult[] }>(
      `/api/repos/${repoId}/search`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "semantic",
          query: params.query,
          limit: params.limit,
        }),
      }
    );
    return data.results;
  }

  async textSearch(repoId: string, params: TextSearchParams): Promise<SearchResult[]> {
    const data = await this.fetch<{ results: SearchResult[] }>(
      `/api/repos/${repoId}/search`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "text",
          query: params.query,
          filePattern: params.filePattern,
          limit: params.limit,
        }),
      }
    );
    return data.results;
  }

  async grepSearch(repoId: string, params: GrepParams): Promise<GrepMatch[]> {
    const data = await this.fetch<{ results: GrepMatch[] }>(
      `/api/repos/${repoId}/search`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "grep",
          pattern: params.pattern,
          isRegex: params.isRegex,
          filePattern: params.filePattern,
          contextLines: params.contextLines,
          limit: params.limit,
        }),
      }
    );
    return data.results;
  }

  // ===========================================
  // FILE READING (from indexed DB)
  // ===========================================

  async readFile(repoId: string, params: ReadFileParams): Promise<FileContent | null> {
    const searchParams = new URLSearchParams({ path: params.path });
    if (params.startLine) searchParams.set("startLine", String(params.startLine));
    if (params.endLine) searchParams.set("endLine", String(params.endLine));

    try {
      const data = await this.fetch<{
        path: string;
        content: string;
        language?: string;
        summary?: string;
        totalLines?: number;
      }>(`/api/repos/${repoId}/files?${searchParams}`);

      return {
        path: data.path,
        content: data.content,
        sha: "", // DB reads don't have sha
        language: data.language,
        summary: data.summary,
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) return null;
      throw err;
    }
  }

  async listFiles(repoId: string, params: ListFilesParams): Promise<FileInfo[]> {
    const searchParams = new URLSearchParams({ list: "true" });
    if (params.language) searchParams.set("language", params.language);
    if (params.pattern) searchParams.set("pattern", params.pattern);
    if (params.limit) searchParams.set("limit", String(params.limit));

    const data = await this.fetch<{ files: FileInfo[] }>(
      `/api/repos/${repoId}/files?${searchParams}`
    );
    return data.files;
  }

  async listCodeDefinitions(repoId: string, params: ListCodeDefinitionsParams): Promise<CodeDefinition[]> {
    const searchParams = new URLSearchParams({
      definitions: "true",
      pattern: params.pattern,
    });
    if (params.limit) searchParams.set("limit", String(params.limit));

    const data = await this.fetch<{ definitions: CodeDefinition[] }>(
      `/api/repos/${repoId}/files?${searchParams}`
    );
    return data.definitions;
  }

  // ===========================================
  // FILE WRITING (via GitHub API proxy)
  // ===========================================

  async readFileFromGitHub(repoId: string, path: string, branch: string): Promise<FileContent | null> {
    const searchParams = new URLSearchParams({ path, branch });

    try {
      const data = await this.fetch<{ path: string; content: string; sha: string }>(
        `/api/repos/${repoId}/files?${searchParams}`
      );
      return { path: data.path, content: data.content, sha: data.sha };
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) return null;
      throw err;
    }
  }

  async writeFile(repoId: string, params: WriteFileParams): Promise<void> {
    await this.fetch(`/api/repos/${repoId}/files`, {
      method: "PUT",
      body: JSON.stringify({
        path: params.path,
        content: params.content,
        message: params.message,
        branch: params.branch,
        sha: params.sha,
      }),
    });
  }

  async deleteFile(repoId: string, params: DeleteFileParams): Promise<void> {
    // Need sha first
    const file = await this.readFileFromGitHub(repoId, params.path, params.branch);
    if (!file) throw new Error(`File not found: ${params.path}`);

    await this.fetch(`/api/repos/${repoId}/files`, {
      method: "DELETE",
      body: JSON.stringify({
        path: params.path,
        message: params.message,
        branch: params.branch,
        sha: file.sha,
      }),
    });
  }

  async commitFiles(repoId: string, params: CommitFilesParams): Promise<void> {
    await this.fetch(`/api/repos/${repoId}/commit`, {
      method: "POST",
      body: JSON.stringify({
        branch: params.branch,
        message: params.message,
        files: params.files,
      }),
    });
  }

  // ===========================================
  // BRANCHES
  // ===========================================

  async listBranches(repoId: string): Promise<BranchListResult> {
    return this.fetch<BranchListResult>(`/api/repos/${repoId}/branches`);
  }

  async createBranch(repoId: string, params: CreateBranchParams): Promise<BranchInfo> {
    const data = await this.fetch<{ branch: BranchInfo }>(
      `/api/repos/${repoId}/branches`,
      {
        method: "POST",
        body: JSON.stringify({
          name: params.name,
          baseBranch: params.baseBranch,
        }),
      }
    );
    return data.branch;
  }

  // ===========================================
  // PR
  // ===========================================

  async createPR(repoId: string, params: CreatePRParams): Promise<PRResult> {
    return this.fetch<PRResult>(
      `/api/repos/${repoId}/pr`,
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    );
  }

  async listPRs(repoId: string, state: "open" | "closed" | "all" = "open"): Promise<PRSummary[]> {
    const data = await this.fetch<{ prs: PRSummary[] }>(
      `/api/repos/${repoId}/pr?state=${state}`
    );
    return data.prs;
  }

  async getPRDiff(repoId: string, prNumber: number): Promise<PRDiff> {
    return this.fetch<PRDiff>(
      `/api/repos/${repoId}/pr?number=${prNumber}`
    );
  }

  async listIssues(repoId: string, state: "open" | "closed" | "all" = "open"): Promise<IssueSummary[]> {
    const data = await this.fetch<{ issues: IssueSummary[] }>(
      `/api/repos/${repoId}/issues?state=${state}`
    );
    return data.issues;
  }

  async getIssue(repoId: string, issueNumber: number): Promise<IssueDetail> {
    return this.fetch<IssueDetail>(
      `/api/repos/${repoId}/issues?number=${issueNumber}`
    );
  }

  // ===========================================
  // CONVERSATIONS
  // ===========================================

  async createConversation(params: CreateConversationParams): Promise<string> {
    const data = await this.fetch<{ conversationId: string }>(
      "/api/conversations",
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    );
    return data.conversationId;
  }

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const data = await this.fetch<{ messages: ConversationMessage[] }>(
      `/api/conversations/${conversationId}/messages`
    );
    return data.messages;
  }

  async saveMessage(params: SaveMessageParams): Promise<void> {
    await this.fetch(
      `/api/conversations/${params.conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          role: params.role,
          content: params.content,
          toolCalls: params.toolCalls,
          toolCallId: params.toolCallId,
          metadata: params.metadata,
        }),
      }
    );
  }

  // ===========================================
  // CHAT SUMMARIES (compression)
  // ===========================================

  async getChatSummary(conversationId: string): Promise<ChatSummaryRecord | null> {
    try {
      return await this.fetch<ChatSummaryRecord>(
        `/api/conversations/${conversationId}/summary`
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) return null;
      throw err;
    }
  }

  async upsertChatSummary(summary: ChatSummaryRecord): Promise<void> {
    await this.fetch(
      `/api/conversations/${summary.conversationId}/summary`,
      {
        method: "PUT",
        body: JSON.stringify({
          summary: summary.summary,
          lastMessageId: summary.lastMessageId,
          tokensCompressed: summary.tokensCompressed,
        }),
      }
    );
  }

  // ===========================================
  // WEB SEARCH & FETCH
  // ===========================================

  async webSearch(query: string, limit?: number): Promise<{ title: string; url: string; snippet: string }[]> {
    const data = await this.fetch<{ results: { title: string; url: string; snippet: string }[] }>(
      "/api/web",
      {
        method: "POST",
        body: JSON.stringify({ action: "search", query, limit }),
      }
    );
    return data.results;
  }

  async webFetch(url: string): Promise<{ url: string; title: string; content: string }> {
    const data = await this.fetch<{ page: { url: string; title: string; content: string } }>(
      "/api/web",
      {
        method: "POST",
        body: JSON.stringify({ action: "fetch", url }),
      }
    );
    return data.page;
  }

  // ===========================================
  // CUSTOM INSTRUCTIONS
  // ===========================================

  async getCustomInstructions(repoId: string): Promise<string | null> {
    try {
      const data = await this.fetch<{ instructions: string | null }>(
        `/api/instructions?repoId=${repoId}`
      );
      return data.instructions;
    } catch {
      return null;
    }
  }
}
