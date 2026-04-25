import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/client";
import { createServerSupabaseClient } from "@/lib/db/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9999";

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=${encodeURIComponent("No code provided")}`
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return NextResponse.redirect(
        `${appUrl}/dashboard?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`
      );
    }

    const accessToken = tokenData.access_token;

    // Get GitHub user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const githubUser = await userResponse.json();

    // Get current logged-in user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${appUrl}/login`);
    }

    // Store GitHub token in users table
    const adminClient = createAdminClient();
    await adminClient
      .from("users")
      .update({
        github_id: String(githubUser.id),
        github_access_token: accessToken, // TODO: encrypt this
      })
      .eq("id", user.id);

    // Redirect to repo selection page
    return NextResponse.redirect(`${appUrl}/repos/connect`);
  } catch (err) {
    console.error("GitHub OAuth error:", err);
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=${encodeURIComponent("Failed to connect GitHub")}`
    );
  }
}
