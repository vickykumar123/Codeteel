import { NextResponse } from "next/server";
import { authenticateRepoRequest, isAuthError } from "@/lib/api/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/repos/[id]/index/pause
// Pause an in-progress indexing job. Progress is preserved for resume.
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

  await adminClient
    .from("index_jobs")
    .update({ status: "paused" })
    .eq("id", jobId);

  return NextResponse.json({ status: "paused" });
}
