import { NextResponse } from "next/server";
import { authenticateRequest, isAuthError } from "@/lib/api/auth";

// POST /api/conversations - Create a new conversation
export async function POST(request: Request) {
  const auth = await authenticateRequest();
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const { repoId, title } = body as { repoId: string; title?: string };

  if (!repoId) {
    return NextResponse.json({ error: "repoId required" }, { status: 400 });
  }

  // Verify user owns this repo
  const { data: repo } = await auth.adminClient
    .from("repositories")
    .select("id")
    .eq("id", repoId)
    .eq("user_id", auth.userId)
    .single();

  if (!repo) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  const { data, error } = await auth.adminClient
    .from("conversations")
    .insert({
      user_id: auth.userId,
      repo_id: repoId,
      title: title || "New conversation",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversationId: data.id });
}

// GET /api/conversations?repoId=... - List conversations for a repo
export async function GET(request: Request) {
  const auth = await authenticateRequest();
  if (isAuthError(auth)) return auth;

  const url = new URL(request.url);
  const repoId = url.searchParams.get("repoId");
  const before = url.searchParams.get("before");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);

  if (!repoId) {
    return NextResponse.json({ error: "repoId required" }, { status: 400 });
  }

  let query = auth.adminClient
    .from("conversations")
    .select("id, title, created_at, updated_at, platform")
    .eq("user_id", auth.userId)
    .eq("repo_id", repoId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("updated_at", before);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: data || [] });
}
