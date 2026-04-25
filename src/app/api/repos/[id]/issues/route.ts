import { NextResponse } from "next/server";
import { authenticateRepoRequest, isAuthError } from "@/lib/api/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/repos/[id]/issues - List issues or get issue details
// ?state=open|closed|all (default: open)
// ?number=123 (get specific issue)
export async function GET(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;
  const auth = await authenticateRepoRequest(repoId);
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const issueNumber = searchParams.get("number");
  const [owner, repo] = auth.repo.fullName.split("/");
  const headers = {
    Authorization: `Bearer ${auth.githubToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  // Get specific issue
  if (issueNumber) {
    const issueRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      { headers }
    );
    if (!issueRes.ok) {
      return NextResponse.json({ error: `Issue #${issueNumber} not found` }, { status: 404 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const issue: any = await issueRes.json();

    // PRs show up as issues too — filter them out
    if (issue.pull_request) {
      return NextResponse.json({ error: `#${issueNumber} is a pull request, not an issue` }, { status: 400 });
    }

    // Fetch comments
    const commentsRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
      { headers }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comments: any[] = commentsRes.ok ? await commentsRes.json() : [];

    return NextResponse.json({
      number: issue.number,
      title: issue.title,
      body: issue.body || "",
      state: issue.state,
      user: issue.user?.login || "unknown",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      labels: (issue.labels || []).map((l: any) => l.name),
      url: issue.html_url,
      createdAt: issue.created_at,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      comments: comments.map((c: any) => ({
        user: c.user?.login || "unknown",
        body: c.body || "",
        createdAt: c.created_at,
      })),
    });
  }

  // List issues (exclude PRs)
  const state = searchParams.get("state") || "open";
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=30&sort=updated&direction=desc`,
    { headers }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Failed to list issues: ${error}` }, { status: response.status });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issues: any[] = await response.json();

  // Filter out PRs (GitHub API returns PRs as issues)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realIssues = issues.filter((i: any) => !i.pull_request);

  return NextResponse.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    issues: realIssues.map((i: any) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      user: i.user?.login || "unknown",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      labels: (i.labels || []).map((l: any) => l.name),
      createdAt: i.created_at,
      url: i.html_url,
      commentCount: i.comments || 0,
    })),
  });
}
