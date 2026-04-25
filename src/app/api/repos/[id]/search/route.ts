import { NextResponse } from "next/server";
import { authenticateRepoRequest, isAuthError } from "@/lib/api/auth";
import { generateEmbedding } from "@/lib/embeddings";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/repos/[id]/search - Semantic or text search
export async function POST(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;
  const auth = await authenticateRepoRequest(repoId);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const { type, query, pattern, filePattern, isRegex, contextLines, limit = 10 } = body as {
    type: "semantic" | "text" | "grep";
    query?: string;
    pattern?: string;
    filePattern?: string;
    isRegex?: boolean;
    contextLines?: number;
    limit?: number;
  };

  if (!query && !pattern) {
    return NextResponse.json({ error: "Query or pattern is required" }, { status: 400 });
  }

  const cappedLimit = Math.min(limit, type === "grep" ? 50 : 20);

  try {
    if (type === "grep") {
      // Grep search — line-level matches with context
      // grep_files is a custom function not in generated types, so cast
      const { data, error } = await (auth.adminClient.rpc as Function)("grep_files", {
        p_repo_id: repoId,
        p_pattern: pattern || query,
        p_is_regex: isRegex || false,
        p_file_pattern: filePattern || null,
        p_context_lines: Math.min(contextLines || 2, 5),
        p_limit: cappedLimit,
      });

      if (error) {
        return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
      }

      // Transform DB column names to camelCase
      const rows = (data || []) as Array<{
        file_path: string;
        file_language: string | null;
        line_number: number;
        line_content: string;
        is_match: boolean;
        match_group: number;
      }>;

      const results = rows.map((row) => ({
        path: row.file_path,
        language: row.file_language,
        lineNumber: row.line_number,
        lineContent: row.line_content,
        isMatch: row.is_match,
        matchGroup: row.match_group,
      }));

      return NextResponse.json({ results });
    } else if (type === "semantic") {
      // Get user's embedding config
      const { data: userProfile } = await auth.adminClient
        .from("users")
        .select("embedding_provider, embedding_api_key, embedding_model")
        .eq("id", auth.userId)
        .single();

      if (!userProfile?.embedding_api_key) {
        return NextResponse.json({ error: "Embedding provider not configured" }, { status: 400 });
      }

      const embedding = await generateEmbedding(
        {
          provider: (userProfile.embedding_provider || "openai") as "openai" | "gemini" | "mistral" | "voyage" | "cohere",
          apiKey: userProfile.embedding_api_key,
          model: userProfile.embedding_model || undefined,
        },
        query!
      );

      const embeddingStr = `[${embedding.join(",")}]`;

      const { data, error } = await auth.adminClient.rpc("search_files_semantic", {
        p_repo_id: repoId,
        p_embedding: embeddingStr,
        p_limit: cappedLimit,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ results: data || [] });
    } else {
      // Text search
      const { data, error } = await auth.adminClient.rpc("search_files_text", {
        p_repo_id: repoId,
        p_query: query!,
        p_limit: cappedLimit,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      let results = data || [];

      // Apply file pattern filter
      if (filePattern) {
        results = results.filter((r: { path: string }) =>
          r.path.toLowerCase().includes(filePattern.toLowerCase())
        );
      }

      return NextResponse.json({ results });
    }
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
