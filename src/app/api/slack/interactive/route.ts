// Slack Interactive Components Webhook
// Handles button clicks (plan approval, branch selection)
// Pushes to SQS → Lambda processes

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { pushToQueue } from "@/lib/platforms/queue";

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
  const timestamp = request.headers.get("x-slack-request-timestamp") || "";
  const signature = request.headers.get("x-slack-signature") || "";

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: "SLACK_SIGNING_SECRET not configured" }, { status: 500 });
  }

  if (!verifySlackSignature(signingSecret, timestamp, body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const params = new URLSearchParams(body);
  const payloadStr = params.get("payload");
  if (!payloadStr) {
    return NextResponse.json({ error: "No payload" }, { status: 400 });
  }

  const payload = JSON.parse(payloadStr);

  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];
    if (!action) {
      return NextResponse.json({ ok: true });
    }

    // Look up bot token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // Push to SQS → Lambda processes (Lambda looks up bot token from DB)
    try {
      await pushToQueue({
        operation: "interactive",
        platform: "slack",
        userId: payload.user?.id || "",
        channelId: payload.channel?.id || "",
        teamId: payload.team?.id || "",
        threadId: payload.message?.thread_ts,
        text: "",
        action: {
          actionId: action.action_id,
          value: action.value || "",
          messageTs: payload.message?.ts || "",
        },
      });
    } catch (err) {
      console.error("Failed to push interaction to SQS:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
