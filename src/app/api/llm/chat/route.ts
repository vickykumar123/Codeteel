// LLM Chat Proxy - keeps API keys server-side
//
// POST /api/llm/chat
// Body: { messages: LLMChatMessage[], tools?: LLMToolDef[] }
// Returns: SSE stream (content + tool_call chunks)
//
// Streaming keeps the Vercel connection alive past the 15s timeout.
// The browser accumulates chunks into a final LLMChatResponse.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/client";
import { createServerSupabaseClient } from "@/lib/db/server";
import { chatStream } from "@/lib/llm";
import type { LLMChatMessage, LLMToolDef } from "@/lib/agents/types";

interface RequestBody {
  messages: LLMChatMessage[];
  tools?: LLMToolDef[];
}

export async function POST(request: Request) {
  // Authenticate
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  const body: RequestBody = await request.json();
  const { messages, tools } = body;

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: "messages array is required" },
      { status: 400 }
    );
  }

  // Get user's active LLM provider from DB
  const adminClient = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeProvider, error: providerError } = await (adminClient as any)
    .from("llm_providers")
    .select("provider, api_key, base_url, model")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (providerError || !activeProvider) {
    return NextResponse.json(
      { error: "No active LLM provider configured. Go to Settings to add one." },
      { status: 400 }
    );
  }

  // Decrypt API key if present
  let apiKey = activeProvider.api_key || undefined;
  if (apiKey) {
    const { decrypt } = await import("@/lib/crypto");
    try {
      apiKey = decrypt(apiKey);
    } catch {
      // Key might not be encrypted (legacy) — use as-is
    }
  }

  const llmConfig = {
    provider: activeProvider.provider,
    baseUrl: activeProvider.base_url,
    model: activeProvider.model,
    apiKey,
  };

  try {
    const stream = chatStream(llmConfig, messages, tools);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM call failed";
    console.error("[LLM Proxy] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
