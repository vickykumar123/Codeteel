// Web Search & Fetch API
//
// POST /api/web
// Body: { action: "search", query: "..." } or { action: "fetch", url: "..." }
// Returns: { results: [...] } or { page: { title, content, url } }

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/server";
import { webSearch, webFetch } from "@/lib/web";

export async function POST(request: Request) {
  // Authenticate
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  try {
    if (action === "search") {
      const { query, limit } = body;
      if (!query) {
        return NextResponse.json({ error: "query is required" }, { status: 400 });
      }
      const results = await webSearch(query, limit || 5);
      return NextResponse.json({ results });
    }

    if (action === "fetch") {
      const { url } = body;
      if (!url) {
        return NextResponse.json({ error: "url is required" }, { status: 400 });
      }
      const page = await webFetch(url);
      return NextResponse.json({ page });
    }

    return NextResponse.json({ error: "Invalid action. Use 'search' or 'fetch'." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
