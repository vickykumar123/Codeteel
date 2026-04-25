import { NextResponse } from "next/server";
import { authenticateRepoRequest, isAuthError } from "@/lib/api/auth";
import { getBranchHeadSha } from "@/lib/github";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/repos/[id]/index/complete
// Finalize an indexing job after all files are processed.
export async function POST(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;
  const auth = await authenticateRepoRequest(repoId);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const { jobId } = body as { jobId: string };

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const { adminClient } = auth;

  // Update job status
  await adminClient
    .from("index_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  // Get actual file count
  const { count: fileCount } = await adminClient
    .from("file_summaries")
    .select("*", { count: "exact", head: true })
    .eq("repo_id", repoId);

  // Get current HEAD SHA for change detection
  let headSha: string | null = null;
  try {
    const [owner, repoName] = auth.repo.fullName.split("/");
    headSha = await getBranchHeadSha(
      auth.githubToken,
      owner,
      repoName,
      auth.repo.defaultBranch
    );
  } catch (err) {
    console.warn("[complete] Failed to get HEAD SHA:", err);
  }

  // Update repository — save HEAD SHA and clear pending changes
  await adminClient
    .from("repositories")
    .update({
      index_status: "ready",
      indexed_at: new Date().toISOString(),
      file_count: fileCount || 0,
      ...(headSha ? { indexed_commit_sha: headSha } : {}),
      pending_changes: [],
    })
    .eq("id", repoId);

  return NextResponse.json({ status: "completed", fileCount: fileCount || 0 });
}
