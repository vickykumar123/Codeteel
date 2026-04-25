import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/client";
import { createServerSupabaseClient } from "@/lib/db/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/repos/[id]/index - Get indexing status
export async function GET(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Get latest job for this repo
  const { data: job } = await adminClient
    .from("index_jobs")
    .select("*")
    .eq("repo_id", repoId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Get repository status
  const { data: repo } = await adminClient
    .from("repositories")
    .select("index_status, indexed_at, file_count")
    .eq("id", repoId)
    .eq("user_id", user.id)
    .single();

  // Get actual file count from file_summaries
  const { count: fileCount } = await adminClient
    .from("file_summaries")
    .select("*", { count: "exact", head: true })
    .eq("repo_id", repoId);

  return NextResponse.json({
    repoStatus: repo?.index_status || "pending",
    indexedAt: repo?.indexed_at,
    fileCount: fileCount || 0,
    job: job
      ? {
          id: job.id,
          status: job.status,
          totalFiles: job.total_files,
          processedFiles: job.processed_files,
          failedFiles: job.failed_files,
          completedPaths: job.completed_paths,
          failedPaths: job.failed_paths,
          error: job.error_message,
          createdAt: job.created_at,
          completedAt: job.completed_at,
        }
      : null,
  });
}
