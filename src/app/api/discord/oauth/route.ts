// Discord OAuth
// Handles bot installation to a Discord server

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "DISCORD_CLIENT_ID not configured" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9999";

  // Discord bot permissions needed
  const permissions = 2048 + 16384 + 32768; // Send Messages + Read Message History + Manage Messages
  const scopes = "bot applications.commands";

  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(`${appUrl}/api/discord/oauth`)}&response_type=code`;

  // If code is present, exchange for token
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    // Discord bot token is set during app creation — no code exchange needed for bots
    // Just redirect back to settings
    return NextResponse.redirect(`${appUrl}/settings?discord=connected`);
  }

  return NextResponse.redirect(url);
}
