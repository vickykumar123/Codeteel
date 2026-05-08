// Discord Interactions Endpoint
// Receives slash commands, button clicks from Discord
// Verifies Ed25519 signature, defers response, pushes to SQS

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import nacl from "tweetnacl";
import { pushToQueue } from "@/lib/platforms/queue";

// Discord interaction types
const INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
};

const INTERACTION_RESPONSE_TYPE = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
};

function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string,
): boolean {
  try {
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, "hex"),
      Buffer.from(publicKey, "hex"),
    );
  } catch {
    return false;
  }
}

// Discord sometimes sends GET to verify the endpoint
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-signature-ed25519") || "";
  const timestamp = request.headers.get("x-signature-timestamp") || "";

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: "DISCORD_PUBLIC_KEY not configured" }, { status: 500 });
  }

  // Verify signature
  if (!verifyDiscordSignature(publicKey, signature, timestamp, body)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const interaction = JSON.parse(body);

  // Handle PING (Discord verification)
  if (interaction.type === INTERACTION_TYPE.PING) {
    return NextResponse.json({ type: INTERACTION_RESPONSE_TYPE.PONG });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "DISCORD_BOT_TOKEN not configured" }, { status: 500 });
  }

  const channelId = interaction.channel_id || interaction.channel?.id || "";
  const userId = interaction.member?.user?.id || interaction.user?.id || "";
  const guildId = interaction.guild_id || "";

  // Handle slash commands
  if (interaction.type === INTERACTION_TYPE.APPLICATION_COMMAND) {
    const commandName = interaction.data?.name || "";
    const options = interaction.data?.options || [];
    const args = options.map((o: { value: string }) => o.value).join(" ");

    // /ask — main interaction command, push to SQS for processing
    if (commandName === "ask") {
      try {
        await pushToQueue({
          operation: "event",
          platform: "discord",
          userId,
          channelId,
          teamId: guildId,
          text: args,
        });
      } catch {
        const { handleDiscordMessage } = await import("@/lib/platforms/discord/handler");
        handleDiscordMessage(
          { platform: "discord", userId, channelId, text: args },
          botToken,
        ).catch(console.error);
      }

      return NextResponse.json({
        type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `> ${args}\n\n⏳ Processing...` },
      });
    }

    // All other commands — push to SQS, respond immediately with "Processing..."
    // (Discord's 3s timeout is too tight for Vercel cold starts + DB queries)
    try {
      await pushToQueue({
        operation: "event",
        platform: "discord",
        userId,
        channelId,
        teamId: guildId,
        text: `/${commandName} ${args}`.trim(),
        action: {
          actionId: "command",
          value: commandName,
          messageTs: interaction.id,
        },
      });
    } catch {
      // SQS not available — handle directly
      const { handleDiscordCommand } = await import("@/lib/platforms/discord/handler");
      const response = await handleDiscordCommand(channelId, commandName, args, userId, botToken);
      return NextResponse.json({
        type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: response },
      });
    }

    return NextResponse.json({
      type: INTERACTION_RESPONSE_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `⏳ Processing \`/${commandName}\`...` },
    });
  }

  // Handle button clicks
  if (interaction.type === INTERACTION_TYPE.MESSAGE_COMPONENT) {
    const customId = interaction.data?.custom_id || "";
    const messageId = interaction.message?.id || "";

    // Push to SQS for Lambda processing
    try {
      await pushToQueue({
        operation: "interactive",
        platform: "discord",
        userId,
        channelId,
        teamId: guildId,
        text: "",
        action: {
          actionId: customId,
          value: customId,
          messageTs: messageId,
        },
      });
    } catch {
      // SQS not available — handle directly
      const { handleDiscordButton } = await import("@/lib/platforms/discord/handler");
      handleDiscordButton(channelId, messageId, customId, userId, botToken).catch(console.error);
    }

    // Acknowledge immediately (removes loading state from button)
    return NextResponse.json({
      type: INTERACTION_RESPONSE_TYPE.DEFERRED_UPDATE_MESSAGE,
    });
  }

  return NextResponse.json({ type: INTERACTION_RESPONSE_TYPE.PONG });
}
