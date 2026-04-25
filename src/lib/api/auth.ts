/**
 * API Route Auth Helper
 *
 * Shared authentication logic for all API proxy routes.
 * Verifies Supabase session and fetches user's GitHub token + repo info.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/client";

export interface AuthContext {
  userId: string;
  githubToken: string;
  repo: {
    id: string;
    fullName: string;
    defaultBranch: string;
  };
  adminClient: ReturnType<typeof createAdminClient>;
}

/**
 * Authenticate the request and get repo context.
 * Returns AuthContext on success, NextResponse (401/404) on failure.
 */
export async function authenticateRepoRequest(
  repoId: string
): Promise<AuthContext | NextResponse> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Get repo (owned by this user)
  const { data: repo, error: repoError } = await adminClient
    .from("repositories")
    .select("id, full_name, default_branch")
    .eq("id", repoId)
    .eq("user_id", user.id)
    .single();

  if (repoError || !repo) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  // Get GitHub token
  const { data: userProfile } = await adminClient
    .from("users")
    .select("github_access_token")
    .eq("id", user.id)
    .single();

  if (!userProfile?.github_access_token) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }

  return {
    userId: user.id,
    githubToken: userProfile.github_access_token,
    repo: {
      id: repo.id,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch || "main",
    },
    adminClient,
  };
}

/**
 * Authenticate a request without repo context (for conversations, etc.)
 */
export async function authenticateRequest(): Promise<
  { userId: string; adminClient: ReturnType<typeof createAdminClient> } | NextResponse
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { userId: user.id, adminClient: createAdminClient() };
}

/**
 * Type guard: check if auth result is an error response
 */
export function isAuthError(result: unknown): result is NextResponse {
  return result instanceof NextResponse;
}
