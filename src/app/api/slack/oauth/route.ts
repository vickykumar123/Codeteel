// Slack OAuth
// Initiates OAuth and handles callback from Slack

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/client";
import { encrypt } from "@/lib/crypto";

// Sign the state parameter to prevent tampering
function signState(userId: string): string {
  const secret = process.env.ENCRYPTION_KEY || "dev-secret";
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(userId);
  const sig = hmac.digest("hex").slice(0, 16);
  return `${userId}:${sig}`;
}

function verifyState(state: string): string | null {
  const [userId, sig] = state.split(":");
  if (!userId || !sig) return null;
  const secret = process.env.ENCRYPTION_KEY || "dev-secret";
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(userId);
  const expectedSig = hmac.digest("hex").slice(0, 16);
  if (sig !== expectedSig) return null;
  return userId;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9999";

  // ===========================================
  // STEP 1: Initiate OAuth (no code yet)
  // ===========================================
  if (!code) {
    // Get current user from session
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${appUrl}/login?error=not_authenticated`);
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: "SLACK_CLIENT_ID not configured" }, { status: 500 });
    }

    const redirectUri = `${appUrl}/api/slack/oauth`;
    const scopes = [
      "channels:history",
      "channels:join",
      "channels:read",
      "chat:write",
      "commands",
      "groups:history",
      "groups:read",
      "im:history",
      "im:read",
      "users:read",
    ].join(",");

    // Pass signed user ID in state so we can identify the user on callback
    const signedState = signState(user.id);
    const url = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${signedState}`;
    return NextResponse.redirect(url);
  }

  // ===========================================
  // STEP 2: Handle callback (code + state)
  // ===========================================

  // Verify state to get user ID (no cookie needed)
  const userId = state ? verifyState(state) : null;
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/settings?error=invalid_state`);
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = `${appUrl}/api/slack/oauth`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/settings?error=slack_not_configured`);
  }

  try {
    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error("Slack OAuth error:", tokenData.error);
      return NextResponse.redirect(`${appUrl}/settings?error=slack_oauth_failed`);
    }

    // Store the workspace connection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = createAdminClient() as any;

    await adminClient
      .from("slack_installations")
      .upsert({
        user_id: userId,
        team_id: tokenData.team?.id,
        team_name: tokenData.team?.name,
        bot_token: encrypt(tokenData.access_token),
        bot_user_id: tokenData.bot_user_id,
        installed_at: new Date().toISOString(),
      }, { onConflict: "user_id,team_id" });

    return NextResponse.redirect(`${appUrl}/settings?slack=connected`);
  } catch (err) {
    console.error("Slack OAuth error:", err);
    return NextResponse.redirect(`${appUrl}/settings?error=slack_oauth_error`);
  }
}
