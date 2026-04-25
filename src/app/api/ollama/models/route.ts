import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ollamaUrl = searchParams.get("url") || "http://localhost:11434";

  try {
    // Ollama API endpoint to list models
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Short timeout to quickly detect if Ollama isn't running
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const data = await response.json();

    // Transform the response to a cleaner format
    const models = (data.models || []).map((model: {
      name: string;
      size: number;
      modified_at: string;
      digest: string;
    }) => ({
      name: model.name,
      size: model.size,
      modified_at: model.modified_at,
    }));

    return NextResponse.json({ models });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "TimeoutError"
          ? "Connection timed out - is Ollama running?"
          : err.message
        : "Failed to connect to Ollama";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
