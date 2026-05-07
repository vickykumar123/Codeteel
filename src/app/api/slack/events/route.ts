// Slack Events API Webhook
// Receives messages from Slack → pushes to SQS → Lambda processes

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/db/client";
import { pushToQueue } from "@/lib/platforms/queue";
import { decrypt } from "@/lib/crypto";

// Verify Slack request signature
function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", signingSecret);
  hmac.update(sigBasestring);
  const mySignature = `v0=${hmac.digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const event = JSON.parse(body);

  // Handle URL verification challenge FIRST
  if (event.type === "url_verification") {
    return NextResponse.json({ challenge: event.challenge });
  }

  const timestamp = request.headers.get("x-slack-request-timestamp") || "";
  const signature = request.headers.get("x-slack-signature") || "";

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: "SLACK_SIGNING_SECRET not configured" }, { status: 500 });
  }

  if (!verifySlackSignature(signingSecret, timestamp, body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const requestTime = parseInt(timestamp, 10);
  if (Math.abs(Date.now() / 1000 - requestTime) > 300) {
    return NextResponse.json({ error: "Request too old" }, { status: 401 });
  }

  // Handle events
  if (event.type === "event_callback") {
    const slackEvent = event.event;

    // Only handle messages (not bot messages, not edits, not slash commands)
    if (
      slackEvent.type === "message" &&
      !slackEvent.bot_id &&
      !slackEvent.subtype &&
      !(slackEvent.text || "").startsWith("/")
    ) {
      // Check installation exists and skip bot's own messages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adminClient = createAdminClient() as any;
      const { data: installation } = await adminClient
        .from("slack_installations")
        .select("bot_user_id")
        .eq("team_id", event.team_id)
        .single();

      if (!installation) {
        console.error("No Slack installation found for team:", event.team_id);
        return NextResponse.json({ ok: true });
      }

      // Skip bot's own messages
      if (installation.bot_user_id && slackEvent.user === installation.bot_user_id) {
        return NextResponse.json({ ok: true });
      }

      // Send immediate "Processing..." feedback
      const { data: tokenData } = await adminClient
        .from("slack_installations")
        .select("bot_token")
        .eq("team_id", event.team_id)
        .single();

      if (tokenData?.bot_token) {
        try {
          const botToken = decrypt(tokenData.bot_token);
          fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${botToken}` },
            body: JSON.stringify({
              channel: slackEvent.channel,
              text: "⏳ Processing...",
              ...(slackEvent.thread_ts ? { thread_ts: slackEvent.thread_ts } : {}),
            }),
          }).catch(() => {});
        } catch { /* decrypt/send failed — continue without feedback */ }
      }

      // Push to SQS → Lambda processes
      try {
        await pushToQueue({
          operation: "event",
          platform: "slack",
          userId: slackEvent.user,
          channelId: slackEvent.channel,
          teamId: event.team_id,
          threadId: slackEvent.thread_ts,
          text: slackEvent.text || "",
        });
      } catch (err) {
        console.error("Failed to push to SQS:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
