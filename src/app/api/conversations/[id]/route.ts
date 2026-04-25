import { NextResponse } from "next/server";
import { authenticateRequest, isAuthError } from "@/lib/api/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/conversations/[id] - Update conversation fields
// Used by useOrchestrator to save execution_state and working_branch
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await authenticateRequest();
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const body = await request.json();

  // Only allow updating specific fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};

  if (body.execution_state !== undefined) {
    update.execution_state = body.execution_state;
  }
  if (body.working_branch !== undefined) {
    update.working_branch = body.working_branch;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await auth.adminClient
    .from("conversations")
    .update(update)
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
