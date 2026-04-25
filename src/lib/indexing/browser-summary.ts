// Browser-side file summary generation
// Routes LLM calls: Ollama → direct fetch, Cloud → /api/llm/chat proxy

import { shouldChunk, getCodeChunks } from "@/lib/llm";

export interface BrowserLLMConfig {
  provider: string; // "ollama" | "openai" | "claude" | "gemini" | "grok" etc.
  baseUrl?: string;
  model?: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Send a chat request to the appropriate LLM endpoint
async function chatRequest(
  config: BrowserLLMConfig,
  messages: ChatMessage[]
): Promise<string> {
  if (config.provider === "ollama") {
    const baseUrl = config.baseUrl || "http://localhost:11434/v1";
    const model = config.model || "llama3";

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error?.message || data.error || `Ollama request failed (${response.status})`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  // Cloud providers → proxy
  const response = await fetch("/api/llm/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `LLM request failed (${response.status})`);
  }

  const data = await response.json();
  return data.content || "";
}

// Summarize a single chunk
async function summarizeChunk(
  config: BrowserLLMConfig,
  filePath: string,
  chunk: string,
  chunkIndex: number,
  totalChunks: number
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are a code analyzer. Generate a concise summary of this code chunk.
This is chunk ${chunkIndex + 1} of ${totalChunks} from the file.
Focus on:
- Functions/classes defined in this chunk
- Key logic and algorithms
- Important variables and data structures

Keep the summary under 200 words. Be specific and technical.`,
    },
    {
      role: "user",
      content: `File: ${filePath} (chunk ${chunkIndex + 1}/${totalChunks})\n\n\`\`\`\n${chunk}\n\`\`\``,
    },
  ];

  return chatRequest(config, messages);
}

// Combine multiple chunk summaries into one
async function combineSummaries(
  config: BrowserLLMConfig,
  filePath: string,
  chunkSummaries: string[]
): Promise<string> {
  const summariesText = chunkSummaries
    .map((summary, i) => `## Chunk ${i + 1}\n${summary}`)
    .join("\n\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are a code analyzer. Combine these chunk summaries into one cohesive summary of the entire file.
Create a unified summary that:
- Describes the overall purpose of the file
- Lists all main functions/classes and what they do
- Identifies key exports and dependencies
- Removes redundancy from chunk summaries

Keep the final summary under 400 words. Be specific and technical.`,
    },
    {
      role: "user",
      content: `File: ${filePath}\n\nChunk summaries:\n\n${summariesText}`,
    },
  ];

  return chatRequest(config, messages);
}

// Generate a file summary in the browser
// Small files: single LLM call
// Large files: chunk → summarize each → combine
export async function generateFileSummaryBrowser(
  config: BrowserLLMConfig,
  filePath: string,
  code: string
): Promise<string> {
  if (!shouldChunk(code)) {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are a code analyzer. Generate a concise summary of the given code file.
Include:
- Purpose of the file
- Main functions/classes and what they do
- Key exports
- Dependencies/imports used

Keep the summary under 300 words. Be specific and technical.`,
      },
      {
        role: "user",
        content: `File: ${filePath}\n\n\`\`\`\n${code}\n\`\`\``,
      },
    ];

    return chatRequest(config, messages);
  }

  // Large file → chunk and combine
  const chunks = getCodeChunks(code);

  const chunkSummaries: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const summary = await summarizeChunk(config, filePath, chunks[i], i, chunks.length);
    chunkSummaries.push(summary);
  }

  return combineSummaries(config, filePath, chunkSummaries);
}
