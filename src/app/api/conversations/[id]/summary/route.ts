import { NextResponse } from "next/server";
import { authenticateRequest, isAuthError } from "@/lib/api/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// chat_summaries table is not yet in auto-generated Supabase types.
// Use adminClient with explicit type casting until types are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// GET /api/conversations/[id]/summary - Get chat summary
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await authenticateRequest();
  if (isAuthError(auth)) return auth;

  const { id } = await params;

  // Verify conversation belongs to user
  const { data: conv, error: convError } = await auth.adminClient
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .single();

  if (convError || !conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const client: AnyClient = auth.adminClient;
  const { data, error } = await client
    .from("chat_summaries")
    .select("*")
    .eq("conversation_id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "No summary found" }, { status: 404 });
  }

  return NextResponse.json({
    conversationId: data.conversation_id,
    summary: data.summary,
    lastMessageId: data.last_message_id,
    tokensCompressed: data.tokens_compressed,
  });
}

// PUT /api/conversations/[id]/summary - Upsert chat summary
export async function PUT(request: Request, { params }: RouteParams) {
  const auth = await authenticateRequest();
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const body = await request.json();

  // Verify conversation belongs to user
  const { data: conv, error: convError } = await auth.adminClient
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .single();

  if (convError || !conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const client: AnyClient = auth.adminClient;
  const { error } = await client
    .from("chat_summaries")
    .upsert(
      {
        conversation_id: id,
        summary: body.summary,
        last_message_id: body.lastMessageId,
        tokens_compressed: body.tokensCompressed,
      },
      { onConflict: "conversation_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
