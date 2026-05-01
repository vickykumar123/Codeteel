import { NextResponse } from "next/server";
import { authenticateRepoRequest, isAuthError } from "@/lib/api/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/repos/[id]/pr - List PRs or get PR diff
// ?state=open|closed|all (default: open)
// ?number=123 (get specific PR diff)
export async function GET(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;
  const auth = await authenticateRepoRequest(repoId);
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const prNumber = searchParams.get("number");
  const [owner, repo] = auth.repo.fullName.split("/");
  const headers = {
    Authorization: `Bearer ${auth.githubToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  // Get specific PR diff
  if (prNumber) {
    // Fetch PR details
    const prRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      { headers }
    );
    if (!prRes.ok) {
      return NextResponse.json({ error: `PR #${prNumber} not found` }, { status: 404 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pr: any = await prRes.json();

    // Fetch files (diff)
    const filesRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
      { headers }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const files: any[] = filesRes.ok ? await filesRes.json() : [];

    // Fetch comments (review comments + issue comments)
    const [reviewCommentsRes, issueCommentsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments?per_page=100`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`, { headers }),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviewComments: any[] = reviewCommentsRes.ok ? await reviewCommentsRes.json() : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const issueComments: any[] = issueCommentsRes.ok ? await issueCommentsRes.json() : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allComments = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...reviewComments.map((c: any) => ({
        user: c.user?.login || "unknown",
        body: c.body || "",
        createdAt: c.created_at,
        path: c.path,
        line: c.line || c.original_line,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...issueComments.map((c: any) => ({
        user: c.user?.login || "unknown",
        body: c.body || "",
        createdAt: c.created_at,
      })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return NextResponse.json({
      number: pr.number,
      title: pr.title,
      body: pr.body || "",
      user: pr.user?.login || "unknown",
      url: pr.html_url,
      baseBranch: pr.base?.ref || "main",
      headBranch: pr.head?.ref || "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      files: files.map((f: any) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || "",
      })),
      comments: allComments,
    });
  }

  // List PRs
  const state = searchParams.get("state") || "open";
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=30&sort=updated&direction=desc`,
    { headers }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Failed to list PRs: ${error}` }, { status: response.status });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prs: any[] = await response.json();

  return NextResponse.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prs: prs.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      user: pr.user?.login || "unknown",
      createdAt: pr.created_at,
      url: pr.html_url,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      changedFiles: pr.changed_files || 0,
    })),
  });
}

// POST /api/repos/[id]/pr - Create a pull request
export async function POST(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;
  const auth = await authenticateRepoRequest(repoId);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const { title, body: prBody, head, base } = body as {
    title: string;
    body: string;
    head: string;
    base: string;
  };

  if (!title || !head || !base) {
    return NextResponse.json({ error: "title, head, base required" }, { status: 400 });
  }

  const [owner, repo] = auth.repo.fullName.split("/");

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body: `${prBody || ""}\n\n---\n*Created by Codeteel*`,
        head,
        base,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Failed to create PR: ${error}` }, { status: response.status });
  }

  const pr = await response.json();
  return NextResponse.json({
    url: pr.html_url,
    number: pr.number,
  });
}
