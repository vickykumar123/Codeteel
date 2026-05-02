/**
 * ServerToolExecutor
 *
 * Implements ToolExecutor via direct Supabase/GitHub calls.
 * Used by platform integrations (Slack, Telegram, Discord) where
 * there's no browser session/cookies.
 *
 * Requires: userId (to fetch GitHub token + settings)
 */

import { createAdminClient } from "@/lib/db/client";
import { Octokit } from "@octokit/rest";
import { webSearch as ddgSearch, webFetch as ddgFetch } from "@/lib/web";
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
  PRDiffFile,
  PRComment,
  IssueSummary,
  IssueDetail,
  CreateConversationParams,
  ConversationMessage,
  SaveMessageParams,
  ChatSummaryRecord,
} from "./interface";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export class ServerToolExecutor implements ToolExecutor {
  private userId: string;
  private adminClient: AnyClient;
  private _octokit: Octokit | null = null;

  constructor(userId: string) {
    this.userId = userId;
    this.adminClient = createAdminClient();
  }

  private async getOctokit(): Promise<Octokit> {
    if (this._octokit) return this._octokit;

    const { data: profile } = await this.adminClient
      .from("users")
      .select("github_access_token")
      .eq("id", this.userId)
      .single();

    if (!profile?.github_access_token) {
      throw new Error("GitHub access token not found for user");
    }

    this._octokit = new Octokit({ auth: profile.github_access_token });
    return this._octokit;
  }

  private async getRepoFullName(repoId: string): Promise<string> {
    const { data: repo } = await this.adminClient
      .from("repositories")
      .select("full_name")
      .eq("id", repoId)
      .single();

    if (!repo?.full_name) throw new Error(`Repository not found: ${repoId}`);
    return repo.full_name;
  }

  private splitRepo(fullName: string): { owner: string; repo: string } {
    const [owner, repo] = fullName.split("/");
    return { owner, repo };
  }

  // ===========================================
  // SEARCH
  // ===========================================

  async semanticSearch(repoId: string, params: SemanticSearchParams): Promise<SearchResult[]> {
    // Use embedding search via Supabase RPC
    const { data } = await this.adminClient.rpc("search_code_embeddings", {
      query_text: params.query,
      repo_id_filter: repoId,
      match_count: params.limit || 10,
    });

    return (data || []).map((r: AnyClient) => ({
      path: r.path,
      language: r.language,
      summary: r.summary,
      similarity: r.similarity || 0,
      code: r.code,
    }));
  }

  async textSearch(repoId: string, params: TextSearchParams): Promise<SearchResult[]> {
    let query = this.adminClient
      .from("file_summaries")
      .select("path, language, summary, code")
      .eq("repo_id", repoId)
      .textSearch("code", params.query, { type: "websearch" })
      .limit(params.limit || 20);

    if (params.filePattern) {
      query = query.ilike("path", `%${params.filePattern}%`);
    }

    const { data } = await query;

    return (data || []).map((r: AnyClient) => ({
      path: r.path,
      language: r.language,
      summary: r.summary,
      similarity: 0,
      code: r.code,
    }));
  }

  async grepSearch(repoId: string, params: GrepParams): Promise<GrepMatch[]> {
    // Grep through indexed code in DB
    let query = this.adminClient
      .from("file_summaries")
      .select("path, language, code")
      .eq("repo_id", repoId);

    if (params.filePattern) {
      query = query.ilike("path", `%${params.filePattern}%`);
    }

    const { data: files } = await query.limit(200);
    if (!files) return [];

    const matches: GrepMatch[] = [];
    const pattern = params.isRegex ? new RegExp(params.pattern, "gm") : null;
    const contextLines = params.contextLines || 0;
    const limit = params.limit || 50;

    for (const file of files) {
      if (!file.code) continue;
      const lines = file.code.split("\n");
      let matchGroup = 0;

      for (let i = 0; i < lines.length; i++) {
        const isMatch = pattern
          ? pattern.test(lines[i])
          : lines[i].includes(params.pattern);

        if (pattern) pattern.lastIndex = 0; // Reset regex

        if (isMatch) {
          matchGroup++;
          // Add context lines before
          for (let c = Math.max(0, i - contextLines); c < i; c++) {
            matches.push({
              path: file.path, language: file.language,
              lineNumber: c + 1, lineContent: lines[c],
              isMatch: false, matchGroup,
            });
          }
          // Add match line
          matches.push({
            path: file.path, language: file.language,
            lineNumber: i + 1, lineContent: lines[i],
            isMatch: true, matchGroup,
          });
          // Add context lines after
          for (let c = i + 1; c <= Math.min(lines.length - 1, i + contextLines); c++) {
            matches.push({
              path: file.path, language: file.language,
              lineNumber: c + 1, lineContent: lines[c],
              isMatch: false, matchGroup,
            });
          }

          if (matches.filter(m => m.isMatch).length >= limit) break;
        }
      }
      if (matches.filter(m => m.isMatch).length >= limit) break;
    }

    return matches;
  }

  // ===========================================
  // FILE READING
  // ===========================================

  async readFile(repoId: string, params: ReadFileParams): Promise<FileContent | null> {
    const { data } = await this.adminClient
      .from("file_summaries")
      .select("path, language, summary, code")
      .eq("repo_id", repoId)
      .eq("path", params.path)
      .single();

    if (!data) return null;

    let content = data.code || "";
    if (params.startLine || params.endLine) {
      const lines = content.split("\n");
      const start = (params.startLine || 1) - 1;
      const end = params.endLine || lines.length;
      content = lines.slice(start, end).join("\n");
    }

    return {
      path: data.path,
      content,
      sha: "",
      language: data.language,
      summary: data.summary,
    };
  }

  async listFiles(repoId: string, params: ListFilesParams): Promise<FileInfo[]> {
    let query = this.adminClient
      .from("file_summaries")
      .select("path, language, size")
      .eq("repo_id", repoId)
      .order("path");

    if (params.language) query = query.eq("language", params.language);
    if (params.pattern) query = query.ilike("path", `%${params.pattern}%`);
    query = query.limit(params.limit || 100);

    const { data } = await query;
    return (data || []).map((f: AnyClient) => ({
      path: f.path,
      language: f.language,
      size: f.size,
    }));
  }

  async listCodeDefinitions(repoId: string, params: ListCodeDefinitionsParams): Promise<CodeDefinition[]> {
    const { data } = await this.adminClient
      .from("file_summaries")
      .select("path, language, summary")
      .eq("repo_id", repoId)
      .ilike("path", `%${params.pattern}%`)
      .limit(params.limit || 20);

    return (data || []).map((f: AnyClient) => ({
      path: f.path,
      language: f.language,
      summary: f.summary,
    }));
  }

  // ===========================================
  // FILE WRITING (GitHub API)
  // ===========================================

  async readFileFromGitHub(repoId: string, path: string, branch: string): Promise<FileContent | null> {
    const octokit = await this.getOctokit();
    const fullName = await this.getRepoFullName(repoId);
    const { owner, repo } = this.splitRepo(fullName);

    try {
      const { data } = await octokit.repos.getContent({
        owner, repo, path, ref: branch,
      });

      if ("content" in data && data.type === "file") {
        return {
          path: data.path,
          content: Buffer.from(data.content, "base64").toString("utf-8"),
          sha: data.sha,
        };
      }
      return null;
    } catch (err: unknown) {
      if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) return null;
      throw err;
    }
  }

  async writeFile(repoId: string, params: WriteFileParams): Promise<void> {
    const octokit = await this.getOctokit();
    const fullName = await this.getRepoFullName(repoId);
    const { owner, repo } = this.splitRepo(fullName);

    await octokit.repos.createOrUpdateFileContents({
      owner, repo,
      path: params.path,
      message: params.message,
      content: Buffer.from(params.content).toString("base64"),
      branch: params.branch,
      ...(params.sha ? { sha: params.sha } : {}),
    });
  }

  async deleteFile(repoId: string, params: DeleteFileParams): Promise<void> {
    const file = await this.readFileFromGitHub(repoId, params.path, params.branch);
    if (!file) throw new Error(`File not found: ${params.path}`);

    const octokit = await this.getOctokit();
    const fullName = await this.getRepoFullName(repoId);
    const { owner, repo } = this.splitRepo(fullName);

    await octokit.repos.deleteFile({
      owner, repo,
      path: params.path,
      message: params.message,
      sha: file.sha,
      branch: params.branch,
    });
  }

  async commitFiles(repoId: string, params: CommitFilesParams): Promise<void> {
    const octokit = await this.getOctokit();
    const fullName = await this.getRepoFullName(repoId);
    const { owner, repo } = this.splitRepo(fullName);

    // Get the latest commit SHA on the branch
    const { data: ref } = await octokit.git.getRef({
      owner, repo, ref: `heads/${params.branch}`,
    });
    const latestCommitSha = ref.object.sha;

    // Get the tree of the latest commit
    const { data: commit } = await octokit.git.getCommit({
      owner, repo, commit_sha: latestCommitSha,
    });

    // Create tree entries
    const treeEntries = params.files.map(f => ({
      path: f.path,
      mode: "100644" as const,
      type: "blob" as const,
      ...(f.content !== null
        ? { content: f.content }
        : { sha: null }),
    }));

    // Create new tree
    const { data: newTree } = await octokit.git.createTree({
      owner, repo,
      base_tree: commit.tree.sha,
      tree: treeEntries,
    });

    // Create commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner, repo,
      message: params.message,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    // Update branch ref
    await octokit.git.updateRef({
      owner, repo,
      ref: `heads/${params.branch}`,
      sha: newCommit.sha,
    });
  }

  // ===========================================
  // BRANCHES
  // ===========================================

  async listBranches(repoId: string): Promise<BranchListResult> {
    const octokit = await this.getOctokit();
    const fullName = await this.getRepoFullName(repoId);
    const { owner, repo } = this.splitRepo(fullName);

    // Get branches and default branch from DB (avoid extra GitHub API call)
    const [branchesResult, repoResult] = await Promise.all([
      octokit.repos.listBranches({ owner, repo, per_page: 100 }),
      this.adminClient
        .from("repositories")
        .select("default_branch")
        .eq("id", repoId)
        .single(),
    ]);

    return {
      branches: branchesResult.data.map(b => ({
        name: b.name,
        sha: b.commit.sha,
        protected: b.protected,
      })),
      defaultBranch: repoResult.data?.default_branch || "main",
      protectedBranches: branchesResult.data.filter(b => b.protected).map(b => b.name),
    };
  }

  async createBranch(repoId: string, params: CreateBranchParams): Promise<BranchInfo> {
    const octokit = await this.getOctokit();
    const fullName = await this.getRepoFullName(repoId);
    const { owner, repo } = this.splitRepo(fullName);

    // Get base branch SHA
    const baseBranch = params.baseBranch || "main";
    const { data: ref } = await octokit.git.getRef({
      owner, repo, ref: `heads/${baseBranch}`,
    });

    // Create new branch
    await octokit.git.createRef({
      owner, repo,
      ref: `refs/heads/${params.name}`,
      sha: ref.object.sha,
    });

    return { name: params.name, sha: ref.object.sha, protected: false };
  }

  // ===========================================
  // PR
  // ===========================================

  async createPR(repoId: string, params: CreatePRParams): Promise<PRResult> {
    const octokit = await this.getOctokit();
    const fullName = await this.getRepoFullName(repoId);
    const { owner, repo } = this.splitRepo(fullName);

    const { data: pr } = await octokit.pulls.create({
      owner, repo,
      title: params.title,
      body: params.body,
      head: params.head,
      base: params.base,
    });

    return { url: pr.html_url, number: pr.number };
  }

  async listPRs(repoId: string, state: "open" | "closed" | "all" = "open"): Promise<PRSummary[]> {
    const octokit = await this.getOctokit();
    const fullName = await this.getRepoFullName(repoId);
    const { owner, repo } = this.splitRepo(fullName);

    const { data: prs } = await octokit.pulls.list({
      owner, repo, state, per_page: 20,
    });

    return prs.map(pr => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      user: pr.user?.login || "unknown",
      createdAt: pr.created_at,
      url: pr.html_url,
      additions: (pr as AnyClient).additions || 0,
      deletions: (pr as AnyClient).deletions || 0,
      changedFiles: (pr as AnyClient).changed_files || 0,
    }));
  }

  async getPRDiff(repoId: string, prNumber: number): Promise<PRDiff> {
    const octokit = await this.getOctokit();
    const fullName = await this.getRepoFullName(repoId);
    const { owner, repo } = this.splitRepo(fullName);

    const [prData, filesData, commentsData] = await Promise.all([
      octokit.pulls.get({ owner, repo, pull_number: prNumber }),
      octokit.pulls.listFiles({ owner, repo, pull_number: prNumber, per_page: 100 }),
      octokit.pulls.listReviewComments({ owner, repo, pull_number: prNumber, per_page: 50 }),
    ]);

    const files: PRDiffFile[] = filesData.data.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch || "",
    }));

    const comments: PRComment[] = commentsData.data.map(c => ({
      user: c.user?.login || "unknown",
      body: c.body,
      createdAt: c.created_at,
      path: c.path,
      line: c.line || undefined,
    }));

    return {
      number: prData.data.number,
      title: prData.data.title,
      body: prData.data.body || "",
      user: prData.data.user?.login || "unknown",
      url: prData.data.html_url,
      baseBranch: prData.data.base.ref,
      headBranch: prData.data.head.ref,
      files,
      comments,
    };
  }

  async listIssues(repoId: string, state: "open" | "closed" | "all" = "open"): Promise<IssueSummary[]> {
    const octokit = await this.getOctokit();
    const fullName = await this.getRepoFullName(repoId);
    const { owner, repo } = this.splitRepo(fullName);

    const { data: issues } = await octokit.issues.listForRepo({
      owner, repo, state, per_page: 20,
    });

    // Filter out PRs (GitHub API returns PRs as issues)
    return issues
      .filter(i => !i.pull_request)
      .map(i => ({
        number: i.number,
        title: i.title,
        state: i.state,
        user: i.user?.login || "unknown",
        labels: i.labels.map(l => (typeof l === "string" ? l : l.name || "")),
        createdAt: i.created_at,
        url: i.html_url,
        commentCount: i.comments,
      }));
  }

  async getIssue(repoId: string, issueNumber: number): Promise<IssueDetail> {
    const octokit = await this.getOctokit();
    const fullName = await this.getRepoFullName(repoId);
    const { owner, repo } = this.splitRepo(fullName);

    const [issueData, commentsData] = await Promise.all([
      octokit.issues.get({ owner, repo, issue_number: issueNumber }),
      octokit.issues.listComments({ owner, repo, issue_number: issueNumber, per_page: 20 }),
    ]);

    return {
      number: issueData.data.number,
      title: issueData.data.title,
      body: issueData.data.body || "",
      state: issueData.data.state,
      user: issueData.data.user?.login || "unknown",
      labels: issueData.data.labels.map(l => (typeof l === "string" ? l : l.name || "")),
      url: issueData.data.html_url,
      createdAt: issueData.data.created_at,
      comments: commentsData.data.map(c => ({
        user: c.user?.login || "unknown",
        body: c.body || "",
        createdAt: c.created_at,
      })),
    };
  }

  // ===========================================
  // CONVERSATIONS
  // ===========================================

  async createConversation(params: CreateConversationParams): Promise<string> {
    const { data, error } = await this.adminClient
      .from("conversations")
      .insert({
        repo_id: params.repoId,
        user_id: this.userId,
        title: params.title || "New conversation",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return data.id;
  }

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const { data } = await this.adminClient
      .from("messages")
      .select("id, role, content, metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    return (data || []).map((m: AnyClient) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      metadata: m.metadata,
      createdAt: m.created_at,
    }));
  }

  async saveMessage(params: SaveMessageParams): Promise<void> {
    await this.adminClient.from("messages").insert({
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      metadata: params.metadata || null,
    });
  }

  // ===========================================
  // CHAT SUMMARIES
  // ===========================================

  async getChatSummary(conversationId: string): Promise<ChatSummaryRecord | null> {
    const { data } = await this.adminClient
      .from("chat_summaries")
      .select("conversation_id, summary, last_message_id, tokens_compressed")
      .eq("conversation_id", conversationId)
      .single();

    if (!data) return null;
    return {
      conversationId: data.conversation_id,
      summary: data.summary,
      lastMessageId: data.last_message_id,
      tokensCompressed: data.tokens_compressed,
    };
  }

  async upsertChatSummary(summary: ChatSummaryRecord): Promise<void> {
    await this.adminClient
      .from("chat_summaries")
      .upsert({
        conversation_id: summary.conversationId,
        summary: summary.summary,
        last_message_id: summary.lastMessageId,
        tokens_compressed: summary.tokensCompressed,
      }, { onConflict: "conversation_id" });
  }

  // ===========================================
  // WEB SEARCH & FETCH
  // ===========================================

  async webSearch(query: string, limit?: number): Promise<{ title: string; url: string; snippet: string }[]> {
    return ddgSearch(query, limit);
  }

  async webFetch(url: string): Promise<{ url: string; title: string; content: string }> {
    return ddgFetch(url);
  }

  // ===========================================
  // CUSTOM INSTRUCTIONS
  // ===========================================

  async getCustomInstructions(repoId: string): Promise<string | null> {
    const [userResult, repoResult] = await Promise.all([
      this.adminClient
        .from("users")
        .select("custom_instructions")
        .eq("id", this.userId)
        .single(),
      this.adminClient
        .from("repositories")
        .select("instructions")
        .eq("id", repoId)
        .single(),
    ]);

    const parts: string[] = [];
    if (userResult.data?.custom_instructions) parts.push(userResult.data.custom_instructions);
    if (repoResult.data?.instructions) parts.push(repoResult.data.instructions);

    return parts.length > 0 ? parts.join("\n\n") : null;
  }
}
