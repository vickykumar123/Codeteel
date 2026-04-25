import { NextResponse } from "next/server";
import { authenticateRepoRequest, isAuthError } from "@/lib/api/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/repos/[id]/files?path=...&branch=... - Read file from GitHub
// GET /api/repos/[id]/files?list=true&language=...&pattern=... - List indexed files
// GET /api/repos/[id]/files?definitions=true&pattern=... - List code definitions
export async function GET(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;
  const auth = await authenticateRepoRequest(repoId);
  if (isAuthError(auth)) return auth;

  const url = new URL(request.url);

  // === List files ===
  if (url.searchParams.get("list") === "true") {
    const language = url.searchParams.get("language") || undefined;
    const pattern = url.searchParams.get("pattern") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    let query = auth.adminClient
      .from("file_summaries")
      .select("path, language, size")
      .eq("repo_id", repoId)
      .order("path");

    if (language) query = query.ilike("language", `%${language}%`);
    if (pattern) query = query.ilike("path", `%${pattern}%`);

    const { data, error } = await query.limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ files: data || [] });
  }

  // === List code definitions ===
  if (url.searchParams.get("definitions") === "true") {
    const pattern = url.searchParams.get("pattern") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    const { data, error } = await auth.adminClient
      .from("file_summaries")
      .select("path, language, summary")
      .eq("repo_id", repoId)
      .ilike("path", `%${pattern}%`)
      .not("summary", "is", null)
      .order("path")
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ definitions: data || [] });
  }

  // === Read file from indexed DB ===
  const path = url.searchParams.get("path");
  const branch = url.searchParams.get("branch");
  const startLine = parseInt(url.searchParams.get("startLine") || "0") || undefined;
  const endLine = parseInt(url.searchParams.get("endLine") || "0") || undefined;

  if (!path) {
    return NextResponse.json({ error: "path parameter required" }, { status: 400 });
  }

  // If branch specified, read from GitHub (live file)
  if (branch) {
    const [owner, repo] = auth.repo.fullName.split("/");
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${auth.githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: response.status === 404 ? "File not found" : "Failed to read file" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = Buffer.from(data.content, "base64").toString("utf-8");

    return NextResponse.json({
      path,
      content,
      sha: data.sha,
    });
  }

  // Read from indexed DB
  const { data, error } = await auth.adminClient
    .from("file_summaries")
    .select("path, language, code, summary")
    .eq("repo_id", repoId)
    .eq("path", path)
    .single();

  if (error || !data) {
    // Try fuzzy path match
    const { data: similar } = await auth.adminClient
      .from("file_summaries")
      .select("path")
      .eq("repo_id", repoId)
      .ilike("path", `%${path.split("/").pop()}%`)
      .limit(5);

    return NextResponse.json({
      error: "File not found",
      suggestions: similar?.map((f) => f.path) || [],
    }, { status: 404 });
  }

  let code = data.code || "";
  const allLines = code.split("\n");
  const totalLines = allLines.length;

  // Apply line range
  if (startLine || endLine) {
    const start = Math.max(1, startLine || 1);
    const end = Math.min(totalLines, endLine || start + 499);
    code = allLines.slice(start - 1, end).join("\n");
  }

  return NextResponse.json({
    path: data.path,
    content: code,
    language: data.language,
    summary: data.summary,
    totalLines,
  });
}

// PUT /api/repos/[id]/files - Write file to GitHub
export async function PUT(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;
  const auth = await authenticateRepoRequest(repoId);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const { path, content, message, branch, sha } = body as {
    path: string;
    content: string;
    message: string;
    branch: string;
    sha?: string;
  };

  if (!path || content === undefined || !message || !branch) {
    return NextResponse.json({ error: "path, content, message, branch required" }, { status: 400 });
  }

  const [owner, repo] = auth.repo.fullName.split("/");

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${auth.githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString("base64"),
        branch,
        ...(sha ? { sha } : {}),
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Failed to write file: ${error}` }, { status: response.status });
  }

  const result = await response.json();
  return NextResponse.json({ sha: result.content.sha });
}

// DELETE /api/repos/[id]/files - Delete file on GitHub
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;
  const auth = await authenticateRepoRequest(repoId);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const { path, message, branch, sha } = body as {
    path: string;
    message: string;
    branch: string;
    sha: string;
  };

  if (!path || !message || !branch || !sha) {
    return NextResponse.json({ error: "path, message, branch, sha required" }, { status: 400 });
  }

  const [owner, repo] = auth.repo.fullName.split("/");

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${auth.githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, sha, branch }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Failed to delete: ${error}` }, { status: response.status });
  }

  return NextResponse.json({ success: true });
}
