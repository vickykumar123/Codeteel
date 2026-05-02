// Generate a one-time token for linking Telegram chat to a repo
// POST: create token → returns link
// Called from web UI (repo page)

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/client";
import crypto from "crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const TOKEN_EXPIRY_MINUTES = 5;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoId } = await request.json();
  if (!repoId) {
    return NextResponse.json({ error: "repoId required" }, { status: 400 });
  }

  // Verify user owns the repo
  const adminClient: AnyClient = createAdminClient();
  const { data: repo } = await adminClient
    .from("repositories")
    .select("id, full_name")
    .eq("id", repoId)
    .eq("user_id", user.id)
    .single();

  if (!repo) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  // Generate one-time token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();

  await adminClient
    .from("platform_connect_tokens")
    .insert({
      user_id: user.id,
      repo_id: repoId,
      token,
      platform: "telegram",
      expires_at: expiresAt,
    });

  // Build Telegram deep link
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "CodeteeBot";
  const link = `https://t.me/${botUsername}?start=${token}`;

  return NextResponse.json({
    link,
    token,
    expiresAt,
    expiresInMinutes: TOKEN_EXPIRY_MINUTES,
  });
}
