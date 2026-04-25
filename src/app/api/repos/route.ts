import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/client";
import { createServerSupabaseClient } from "@/lib/db/server";
import { registerWebhook, deleteWebhook } from "@/lib/github";

// GET /api/repos - List user's connected repos
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data: repos, error } = await adminClient
    .from("repositories")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ repos });
}

// POST /api/repos - Connect a new repository
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { github_id, name, full_name, default_branch, private: isPrivate, languages } = body;

  if (!github_id || !name || !full_name) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  // Check if already connected
  const { data: existing } = await adminClient
    .from("repositories")
    .select("id")
    .eq("user_id", user.id)
    .eq("github_id", github_id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Repository already connected" },
      { status: 400 }
    );
  }

  // Insert new repository
  const { data: repo, error } = await adminClient
    .from("repositories")
    .insert({
      user_id: user.id,
      github_id,
      name,
      full_name,
      default_branch: default_branch || "main",
      private: isPrivate || false,
      languages: languages || [],
      index_status: "pending",
      change_detection_branch: default_branch || "main",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Register GitHub webhook for change detection
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (webhookSecret && appUrl) {
    try {
      const { data: profile } = await adminClient
        .from("users")
        .select("github_access_token")
        .eq("id", user.id)
        .single();

      if (profile?.github_access_token) {
        const [owner, repoName] = full_name.split("/");
        const webhookId = await registerWebhook(
          profile.github_access_token,
          owner,
          repoName,
          `${appUrl}/api/webhooks/github`,
          webhookSecret
        );

        await adminClient
          .from("repositories")
          .update({ webhook_id: webhookId })
          .eq("id", repo.id);
      }
    } catch (err) {
      console.warn("[repos] Failed to register webhook:", err);
      // Non-fatal — user can still manually re-index
    }
  }

  return NextResponse.json({ repo });
}

// PATCH /api/repos - Update repository settings
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { repo_id, change_detection_branch } = body;

  if (!repo_id) {
    return NextResponse.json({ error: "Missing repo_id" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (typeof change_detection_branch === "string") {
    updates.change_detection_branch = change_detection_branch;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: repo, error } = await adminClient
    .from("repositories")
    .update(updates)
    .eq("id", repo_id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ repo });
}

// DELETE /api/repos - Disconnect a repository
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const githubId = searchParams.get("github_id");

  if (!githubId) {
    return NextResponse.json(
      { error: "Missing github_id parameter" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  // Get repo info for webhook cleanup
  const { data: repoToDelete } = await adminClient
    .from("repositories")
    .select("id, full_name, webhook_id")
    .eq("user_id", user.id)
    .eq("github_id", githubId)
    .single();

  // Delete GitHub webhook if registered
  if (repoToDelete?.webhook_id) {
    try {
      const { data: profile } = await adminClient
        .from("users")
        .select("github_access_token")
        .eq("id", user.id)
        .single();

      if (profile?.github_access_token && repoToDelete.full_name) {
        const [owner, repoName] = repoToDelete.full_name.split("/");
        await deleteWebhook(
          profile.github_access_token,
          owner,
          repoName,
          repoToDelete.webhook_id
        );
      }
    } catch (err) {
      console.warn("[repos] Failed to delete webhook:", err);
    }
  }

  // Delete repository (cascades to file_summaries, tasks)
  const { error } = await adminClient
    .from("repositories")
    .delete()
    .eq("user_id", user.id)
    .eq("github_id", githubId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
