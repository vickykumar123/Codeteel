import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub client ID not configured" },
      { status: 500 }
    );
  }

  // GitHub OAuth scopes we need
  const scopes = ["repo", "read:user"].join(" ");

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/github/callback`;

  const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
  githubAuthUrl.searchParams.set("client_id", clientId);
  githubAuthUrl.searchParams.set("redirect_uri", redirectUri);
  githubAuthUrl.searchParams.set("scope", scopes);

  return NextResponse.redirect(githubAuthUrl.toString());
}
