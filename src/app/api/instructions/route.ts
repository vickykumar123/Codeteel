// Custom Instructions API
//
// GET /api/instructions?repoId=...
//   Returns merged instructions (user + repo)
//
// POST /api/instructions
//   Save user or repo instructions

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/client";
import { createServerSupabaseClient } from "@/lib/db/server";

// GET: Fetch merged instructions
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");

  const adminClient = createAdminClient();

  // Fetch user instructions
  const { data: profile } = await adminClient
    .from("users")
    .select("custom_instructions")
    .eq("id", user.id)
    .single();

  // Fetch repo instructions
  let repoInstructions: string | null = null;
  if (repoId) {
    const { data: repo } = await adminClient
      .from("repositories")
      .select("instructions")
      .eq("id", repoId)
      .eq("user_id", user.id)
      .single();
    repoInstructions = repo?.instructions || null;
  }

  // Merge: repo + user
  const parts: string[] = [];
  if (repoInstructions) {
    parts.push(`## Repository Instructions:\n${repoInstructions}`);
  }
  if (profile?.custom_instructions) {
    parts.push(`## User Instructions:\n${profile.custom_instructions}`);
  }

  return NextResponse.json({
    instructions: parts.length > 0 ? parts.join("\n\n") : null,
    userInstructions: profile?.custom_instructions || null,
    repoInstructions,
  });
}

// POST: Save instructions
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, instructions, repoId } = body;

  if (!type || !["user", "repo"].includes(type)) {
    return NextResponse.json({ error: "type must be 'user' or 'repo'" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  if (type === "user") {
    const { error } = await adminClient
      .from("users")
      .update({ custom_instructions: instructions || null })
      .eq("id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (type === "repo") {
    if (!repoId) {
      return NextResponse.json({ error: "repoId is required" }, { status: 400 });
    }

    const { error } = await adminClient
      .from("repositories")
      .update({ instructions: instructions || null })
      .eq("id", repoId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
