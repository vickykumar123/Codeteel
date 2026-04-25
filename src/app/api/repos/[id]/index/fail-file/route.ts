import { NextResponse } from "next/server";
import { authenticateRepoRequest, isAuthError } from "@/lib/api/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/repos/[id]/index/fail-file
// Record a file processing failure without stopping the job.
export async function POST(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;
  const auth = await authenticateRepoRequest(repoId);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const { jobId, path, error: errorMsg } = body as {
    jobId: string;
    path: string;
    error: string;
  };

  if (!jobId || !path) {
    return NextResponse.json({ error: "jobId, path required" }, { status: 400 });
  }

  const { adminClient } = auth;

  // Get current job state
  const { data: job } = await adminClient
    .from("index_jobs")
    .select("failed_files, failed_paths")
    .eq("id", jobId)
    .single();

  const failedPaths = [...((job?.failed_paths as Array<{ path: string; error: string }>) || []), { path, error: errorMsg || "Unknown error" }];

  await adminClient
    .from("index_jobs")
    .update({
      failed_files: (job?.failed_files || 0) + 1,
      failed_paths: failedPaths,
    })
    .eq("id", jobId);

  return NextResponse.json({
    failedFiles: (job?.failed_files || 0) + 1,
  });
}
