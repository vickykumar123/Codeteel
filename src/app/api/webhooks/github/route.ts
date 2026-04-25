import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/client";
import { shouldIndexFile } from "@/lib/github";

// POST /api/webhooks/github
// Receives push events from GitHub, computes changed files, updates DB.
// Supabase Realtime then notifies the UI.

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // Verify signature
  const signature = request.headers.get("x-hub-signature-256");
  const body = await request.text();

  if (!signature || !(await verifySignature(secret, body, signature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");

  // Only handle push events
  if (event !== "push") {
    return NextResponse.json({ ok: true, skipped: event });
  }

  const payload = JSON.parse(body);

  // Extract branch from ref (refs/heads/main → main)
  const branch = payload.ref?.replace("refs/heads/", "");
  if (!branch) {
    return NextResponse.json({ ok: true, skipped: "no branch" });
  }

  const repoFullName = payload.repository?.full_name;
  if (!repoFullName) {
    return NextResponse.json({ ok: true, skipped: "no repo" });
  }

  const adminClient = createAdminClient();

  // Find matching repository — check if push is to the tracked branch
  const { data: repo } = await adminClient
    .from("repositories")
    .select("id, default_branch, change_detection_branch, indexed_commit_sha")
    .eq("full_name", repoFullName)
    .single();

  if (!repo) {
    return NextResponse.json({ ok: true, skipped: "repo not found" });
  }

  // Only track pushes to the detection branch (default: main/default_branch)
  const trackedBranch = repo.change_detection_branch || repo.default_branch || "main";
  if (branch !== trackedBranch) {
    return NextResponse.json({ ok: true, skipped: `branch ${branch} != ${trackedBranch}` });
  }

  // Collect changed files from all commits in this push
  const changedFiles = new Map<string, string>(); // path → status

  for (const commit of payload.commits || []) {
    for (const path of commit.added || []) {
      changedFiles.set(path, "added");
    }
    for (const path of commit.modified || []) {
      // Don't downgrade "added" to "modified"
      if (changedFiles.get(path) !== "added") {
        changedFiles.set(path, "modified");
      }
    }
    for (const path of commit.removed || []) {
      changedFiles.set(path, "removed");
    }
  }

  // Filter to only indexable files
  const indexableChanges = Array.from(changedFiles.entries())
    .filter(([path, status]) => status === "removed" || shouldIndexFile(path))
    .map(([path, status]) => ({ path, status }));

  if (indexableChanges.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no indexable changes" });
  }

  // Atomically append to pending_changes (handles concurrent webhooks)
  const { error } = await adminClient.rpc("append_pending_changes", {
    p_repo_id: repo.id,
    p_changes: indexableChanges,
  });

  if (error) {
    // Fallback: direct update
    const { data: current } = await adminClient
      .from("repositories")
      .select("pending_changes")
      .eq("id", repo.id)
      .single();

    const existing = (current?.pending_changes as Array<{ path: string; status: string }>) || [];
    const existingPaths = new Set(existing.map((e) => e.path));
    const merged = [
      ...existing,
      ...indexableChanges.filter((c) => !existingPaths.has(c.path)),
    ];

    await adminClient
      .from("repositories")
      .update({ pending_changes: merged })
      .eq("id", repo.id);
  }

  return NextResponse.json({
    ok: true,
    branch,
    changedFiles: indexableChanges.length,
  });
}

// Verify GitHub webhook signature (HMAC-SHA256)
async function verifySignature(
  secret: string,
  payload: string,
  signatureHeader: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expected = `sha256=${hex}`;
  return expected === signatureHeader;
}
