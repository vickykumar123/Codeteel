// Platform connection management for a repo
// DELETE — disconnect a platform from this repo

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/client";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: repoId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { connectionId } = await request.json();
  if (!connectionId) {
    return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Verify ownership
  const { error } = await adminClient
    .from("platform_connections")
    .delete()
    .eq("id", connectionId)
    .eq("repo_id", repoId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
