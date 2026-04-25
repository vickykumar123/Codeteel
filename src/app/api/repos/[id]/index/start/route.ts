import { NextResponse } from "next/server";
import { authenticateRepoRequest, isAuthError } from "@/lib/api/auth";
import { getRepoTree, shouldIndexFile } from "@/lib/github";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/repos/[id]/index/start
// Initialize or resume browser-side indexing.
// Returns file list (skipping unchanged files via content_hash).
export async function POST(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;
  const auth = await authenticateRepoRequest(repoId);
  if (isAuthError(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const fresh = body.fresh === true;

  const { adminClient, githubToken, repo } = auth;
  const [owner, repoName] = repo.fullName.split("/");

  // Fetch GitHub tree
  const tree = await getRepoTree(githubToken, owner, repoName, repo.defaultBranch);
  const allFiles = tree.tree
    .filter((item) => item.type === "blob" && shouldIndexFile(item.path, item.size))
    .map((item) => ({ path: item.path, sha: item.sha, size: item.size || 0 }));

  if (allFiles.length === 0) {
    return NextResponse.json({ error: "No indexable files found" }, { status: 400 });
  }

  // Get existing file_summaries for content_hash comparison
  const { data: existing } = await adminClient
    .from("file_summaries")
    .select("path, content_hash")
    .eq("repo_id", repoId);

  const existingMap = new Map<string, string>();
  for (const f of existing || []) {
    if (f.content_hash) existingMap.set(f.path, f.content_hash);
  }

  // Clean up deleted files (in DB but not in tree)
  const treePaths = new Set(allFiles.map((f) => f.path));
  const deletedPaths = (existing || [])
    .filter((f) => !treePaths.has(f.path))
    .map((f) => f.path);

  if (deletedPaths.length > 0) {
    await adminClient
      .from("file_summaries")
      .delete()
      .eq("repo_id", repoId)
      .in("path", deletedPaths);
  }

  // Check for existing paused/processing job
  const { data: existingJob } = await adminClient
    .from("index_jobs")
    .select("id, status, file_list, completed_paths, failed_paths, total_files, processed_files, failed_files")
    .eq("repo_id", repoId)
    .in("status", ["paused", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  let jobId: string;
  let filesToProcess: typeof allFiles;

  if (existingJob && !fresh) {
    // Resume existing job
    jobId = existingJob.id;
    const completedSet = new Set(existingJob.completed_paths || []);

    // Use stored file_list, subtract completed
    const storedFiles = (existingJob.file_list as typeof allFiles) || allFiles;
    filesToProcess = storedFiles.filter((f) => !completedSet.has(f.path));

    await adminClient
      .from("index_jobs")
      .update({ status: "processing" })
      .eq("id", jobId);
  } else {
    // Cancel any existing jobs
    if (existingJob) {
      await adminClient
        .from("index_jobs")
        .update({ status: "failed", error_message: "Superseded by new index" })
        .eq("id", existingJob.id);
    }

    // Filter unchanged files (content_hash skip)
    filesToProcess = allFiles.filter((f) => existingMap.get(f.path) !== f.sha);

    // Create new job
    const { data: job, error: jobError } = await adminClient
      .from("index_jobs")
      .insert({
        repo_id: repoId,
        user_id: auth.userId,
        status: "processing",
        total_files: filesToProcess.length,
        processed_files: 0,
        failed_files: 0,
        file_list: filesToProcess,
        completed_paths: [],
        failed_paths: [],
      })
      .select("id")
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Failed to create index job" }, { status: 500 });
    }

    jobId = job.id;
  }

  // Update repository status
  await adminClient
    .from("repositories")
    .update({ index_status: "indexing" })
    .eq("id", repoId);

  return NextResponse.json({
    jobId,
    files: filesToProcess,
    totalFiles: filesToProcess.length,
    skippedUnchanged: allFiles.length - filesToProcess.length,
    deletedStale: deletedPaths.length,
  });
}
