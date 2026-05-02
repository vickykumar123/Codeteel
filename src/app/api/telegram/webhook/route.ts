// Telegram Webhook
// Receives updates from Telegram → pushes to SQS or handles directly

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { pushToQueue } from "@/lib/platforms/queue";
import { handleTelegramStart, handleTelegramCommand } from "@/lib/platforms/telegram/handler";

export async function POST(request: NextRequest) {
  const update = await request.json();
  console.log("[Telegram] Webhook update:", JSON.stringify(update).slice(0, 500));

  // Verify webhook secret (optional — set in setWebhook call)
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
  }

  // Handle callback queries (button clicks)
  if (update.callback_query) {
    const cb = update.callback_query;
    try {
      await pushToQueue({
        operation: "interactive",
        platform: "telegram",
        userId: String(cb.from?.id || ""),
        channelId: String(cb.message?.chat?.id || ""),
        teamId: undefined,
        text: "",
        action: {
          actionId: "callback",
          value: cb.data || "",
          messageTs: String(cb.message?.message_id || ""),
        },
      });
    } catch {
      // SQS not configured — handle directly
      const { handleTelegramCallback } = await import("@/lib/platforms/telegram/handler");
      await handleTelegramCallback(
        cb.id,
        String(cb.message?.chat?.id),
        String(cb.message?.message_id),
        cb.data || "",
        String(cb.from?.id),
        botToken,
      ).catch(console.error);
    }
    return NextResponse.json({ ok: true });
  }

  // Handle messages
  const message = update.message;
  if (!message?.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const userId = String(message.from?.id || "");
  const text = message.text.trim();

  // Handle /start TOKEN (connection flow)
  if (text.startsWith("/start ")) {
    const token = text.replace("/start ", "").trim();
    await handleTelegramStart(chatId, token, userId, botToken).catch(console.error);
    return NextResponse.json({ ok: true });
  }

  // Handle bot commands (fast, no LLM needed)
  if (text.startsWith("/")) {
    const [command, ...argParts] = text.split(" ");
    const args = argParts.join(" ");
    await handleTelegramCommand(chatId, command, args, userId, botToken).catch(console.error);
    return NextResponse.json({ ok: true });
  }

  // Regular message → push to SQS for Lambda processing
  try {
    await pushToQueue({
      operation: "event",
      platform: "telegram",
      userId,
      channelId: chatId,
      text,
    });
  } catch {
    // SQS not configured — handle directly
    const { handleTelegramMessage } = await import("@/lib/platforms/telegram/handler");
    await handleTelegramMessage(
      {
        platform: "telegram",
        userId,
        channelId: chatId,
        text,
      },
      botToken,
    ).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
