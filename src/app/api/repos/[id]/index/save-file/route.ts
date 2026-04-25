import { NextResponse } from "next/server";
import { authenticateRepoRequest, isAuthError } from "@/lib/api/auth";
import { generateEmbedding, type EmbeddingProvider } from "@/lib/embeddings";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/repos/[id]/index/save-file
// Save a single processed file: upsert file_summaries + generate embedding + update progress.
export async function POST(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;
  const auth = await authenticateRepoRequest(repoId);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const { jobId, path, code, summary, contentHash, language, size } = body as {
    jobId: string;
    path: string;
    code: string;
    summary: string;
    contentHash: string;
    language: string | null;
    size: number;
  };

  if (!jobId || !path || !code || !summary) {
    return NextResponse.json({ error: "jobId, path, code, summary required" }, { status: 400 });
  }

  const { adminClient } = auth;

  // Generate embedding server-side (keeps API key private)
  let embeddingStr: string | null = null;
  try {
    const { data: profile } = await adminClient
      .from("users")
      .select("embedding_provider, embedding_api_key, embedding_model")
      .eq("id", auth.userId)
      .single();

    if (profile?.embedding_api_key) {
      const embedding = await generateEmbedding(
        {
          provider: (profile.embedding_provider || "openai") as EmbeddingProvider,
          apiKey: profile.embedding_api_key,
          model: profile.embedding_model || undefined,
        },
        `File: ${path}\n\n${summary}`
      );
      embeddingStr = `[${embedding.join(",")}]`;
    }
  } catch (err) {
    console.warn(`[save-file] Embedding failed for ${path}:`, err);
    // Continue without embedding
  }

  // Upsert file_summaries
  const { error: upsertError } = await adminClient
    .from("file_summaries")
    .upsert(
      {
        repo_id: repoId,
        path,
        language,
        size,
        code,
        summary,
        summary_embedding: embeddingStr,
        content_hash: contentHash,
      },
      { onConflict: "repo_id,path" }
    );

  if (upsertError) {
    return NextResponse.json({ error: `Failed to save: ${upsertError.message}` }, { status: 500 });
  }

  // Update index_jobs: append to completed_paths, increment processed_files
  // Use raw SQL for atomic array append
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateError } = await (adminClient as any).rpc("increment_index_progress", {
    p_job_id: jobId,
    p_path: path,
  });

  // Fallback if RPC doesn't exist yet
  if (updateError) {
    const { data: job } = await adminClient
      .from("index_jobs")
      .select("processed_files, completed_paths")
      .eq("id", jobId)
      .single();

    const completedPaths = [...(job?.completed_paths || []), path];
    await adminClient
      .from("index_jobs")
      .update({
        processed_files: (job?.processed_files || 0) + 1,
        completed_paths: completedPaths,
      })
      .eq("id", jobId);

    return NextResponse.json({
      processedFiles: (job?.processed_files || 0) + 1,
    });
  }

  return NextResponse.json({
    processedFiles: updated,
  });
}
