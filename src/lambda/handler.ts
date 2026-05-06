// Lambda Handler for Slack/Platform Messages
// Triggered by SQS queue — runs the orchestrator pipeline
// Deployed separately from Vercel (no timeout limits)

import type { SQSEvent, SQSRecord } from "aws-lambda";

// Set env vars from Lambda environment (these match the Next.js .env names)
// Lambda environment variables are set in serverless.yml

// Re-use the same type from queue.ts
import type { QueueMessagePayload } from "../lib/platforms/queue";

type PlatformMessagePayload = QueueMessagePayload;

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  const payload: PlatformMessagePayload = JSON.parse(record.body);
  console.log(`[Lambda] Processing ${payload.platform} message: "${payload.text?.slice(0, 100)}"`);

  try {
    console.log(`[Lambda] Operation: ${payload.operation} | Platform: ${payload.platform}`);

    if (payload.platform === "slack") {
      await processSlackMessage(payload);
    } else if (payload.platform === "telegram") {
      await processTelegramMessage(payload);
    } else if (payload.platform === "discord") {
      await processDiscordMessage(payload);
    }
  } catch (err) {
    console.error(`[Lambda] Error processing message:`, err);
    // Don't throw — SQS would retry. Log and move on.
    // If we want retries, we can throw here and SQS will retry up to maxReceiveCount.
  }
}

async function processSlackMessage(payload: PlatformMessagePayload): Promise<void> {
  // Look up bot token from DB (never passed in SQS for security)
  const { createAdminClient } = await import("../lib/db/client");
  const { decrypt } = await import("../lib/crypto");

  if (!payload.teamId) {
    console.error("[Lambda] No teamId in payload — cannot look up bot token");
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any;
  const { data: installation } = await adminClient
    .from("slack_installations")
    .select("bot_token")
    .eq("team_id", payload.teamId)
    .single();

  if (!installation?.bot_token) {
    console.error("[Lambda] No Slack installation found for team:", payload.teamId);
    return;
  }

  const botToken = decrypt(installation.bot_token);

  // Dynamic imports
  const { handleSlackMessage, handleSlackInteraction } = await import("../lib/platforms/slack/handler");

  if (payload.operation === "interactive" && payload.action) {
    await handleSlackInteraction(
      {
        actionId: payload.action.actionId,
        value: payload.action.value,
        channelId: payload.channelId,
        threadTs: payload.threadId,
        userId: payload.userId,
        messageTs: payload.action.messageTs,
      },
      botToken,
    );
  } else {
    await handleSlackMessage(
      {
        platform: "slack",
        userId: payload.userId,
        channelId: payload.channelId,
        teamId: payload.teamId,
        threadId: payload.threadId,
        text: payload.text,
        interactionData: payload.interactionData,
      },
      botToken,
    );
  }
}

async function processTelegramMessage(payload: PlatformMessagePayload): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[Lambda] TELEGRAM_BOT_TOKEN not configured");
    return;
  }

  const { handleTelegramMessage, handleTelegramCallback } = await import("../lib/platforms/telegram/handler");

  if (payload.operation === "interactive" && payload.action) {
    await handleTelegramCallback(
      "", // callbackQueryId not available from SQS — already answered in webhook
      payload.channelId,
      payload.action.messageTs,
      payload.action.value,
      payload.userId,
      botToken,
    );
  } else {
    await handleTelegramMessage(
      {
        platform: "telegram",
        userId: payload.userId,
        channelId: payload.channelId,
        text: payload.text,
        interactionData: payload.interactionData,
      },
      botToken,
    );
  }
}

async function processDiscordMessage(payload: PlatformMessagePayload): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.error("[Lambda] DISCORD_BOT_TOKEN not configured");
    return;
  }

  const { handleDiscordMessage, handleDiscordButton, handleDiscordCommand } = await import("../lib/platforms/discord/handler");

  if (payload.operation === "interactive" && payload.action) {
    await handleDiscordButton(
      payload.channelId,
      payload.action.messageTs,
      payload.action.value,
      payload.userId,
      botToken,
    );
  } else if (payload.action?.actionId === "command") {
    const commandName = payload.action.value;
    const args = payload.text.replace(`/${commandName}`, "").trim();
    const response = await handleDiscordCommand(payload.channelId, commandName, args, payload.userId, botToken);

    const { DiscordAdapter } = await import("../lib/platforms/discord/adapter");
    const adapter = new DiscordAdapter(botToken);
    await adapter.sendText(payload.channelId, response);
  } else {
    await handleDiscordMessage(
      {
        platform: "discord",
        userId: payload.userId,
        channelId: payload.channelId,
        text: payload.text,
        interactionData: payload.interactionData,
      },
      botToken,
    );
  }
}
