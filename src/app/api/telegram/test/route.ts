// Telegram test endpoint — calls handler directly (no SQS/Lambda)
// Usage: POST /api/telegram/test { "chatId": "123", "text": "hello" }
// REMOVE THIS IN PRODUCTION

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleTelegramMessage, handleTelegramCommand } from "@/lib/platforms/telegram/handler";

export async function POST(request: NextRequest) {
  const { chatId, text } = await request.json();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
  }

  if (!chatId || !text) {
    return NextResponse.json({ error: "chatId and text required" }, { status: 400 });
  }

  console.log(`[Telegram Test] chatId=${chatId} text="${text}"`);

  try {
    // Handle commands
    if (text.startsWith("/")) {
      const [command, ...argParts] = text.split(" ");
      await handleTelegramCommand(chatId, command, argParts.join(" "), "test_user", botToken);
    } else {
      // Regular message
      await handleTelegramMessage(
        {
          platform: "telegram",
          userId: "test_user",
          channelId: chatId,
          text,
        },
        botToken,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Telegram Test] Error:`, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
