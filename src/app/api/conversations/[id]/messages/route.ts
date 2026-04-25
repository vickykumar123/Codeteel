import { NextResponse } from "next/server";
import { authenticateRequest, isAuthError } from "@/lib/api/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/conversations/[id]/messages - Load message history
export async function GET(request: Request, { params }: RouteParams) {
  const { id: conversationId } = await params;
  const auth = await authenticateRequest();
  if (isAuthError(auth)) return auth;

  // Verify user owns this conversation
  const { data: conv } = await auth.adminClient
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", auth.userId)
    .single();

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data, error } = await auth.adminClient
    .from("messages")
    .select("id, role, content, tool_calls, tool_call_id, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data || [] });
}

// POST /api/conversations/[id]/messages - Save a message
export async function POST(request: Request, { params }: RouteParams) {
  const { id: conversationId } = await params;
  const auth = await authenticateRequest();
  if (isAuthError(auth)) return auth;

  // Verify user owns this conversation
  const { data: conv } = await auth.adminClient
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", auth.userId)
    .single();

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const body = await request.json();
  const { role, content, toolCalls, toolCallId, metadata } = body as {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    toolCalls?: unknown;
    toolCallId?: string;
    metadata?: Record<string, unknown>;
  };

  if (!role || content === undefined) {
    return NextResponse.json({ error: "role and content required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertData: any = {
    conversation_id: conversationId,
    role,
    content,
    tool_calls: toolCalls || null,
    tool_call_id: toolCallId || null,
    metadata: metadata || {},
  };

  const { error } = await auth.adminClient
    .from("messages")
    .insert(insertData);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
