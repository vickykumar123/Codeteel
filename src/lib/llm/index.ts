// LLM client using OpenAI SDK (works with both OpenAI and Ollama)

import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

export type LLMProvider = "ollama" | "openai" | "claude" | "gemini" | "grok" | "qwen" | "fireworks" | "together";

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string;   // OpenAI-compatible endpoint
  model: string;
  apiKey?: string;    // not needed for Ollama
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatResponse {
  content: string;
  tool_calls?: ToolCall[];
}

// Chunking thresholds
const MAX_LINES = 2000;
const MAX_CHARS = 8000;
const CHUNK_LINES = 500;
const CHUNK_LINES_OVERLAP = 50;
const CHUNK_CHARS = 6000;
const CHUNK_CHARS_OVERLAP = 500;

// Create OpenAI-compatible client for any provider
function createClient(config: LLMConfig): OpenAI {
  const isLocal = config.provider === "ollama";

  if (!isLocal && !config.apiKey) {
    throw new Error(`API key not configured for ${config.provider}`);
  }

  return new OpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey || "ollama", // Ollama doesn't need a real key
    timeout: isLocal ? 300_000 : 120_000, // 5 min local, 2 min cloud
  });
}

// Convert our message format to OpenAI format
function toOpenAIMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        content: m.content || "",
        tool_call_id: m.tool_call_id || "",
      };
    }
    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      return {
        role: "assistant" as const,
        content: m.content,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      };
    }
    return {
      role: m.role as "system" | "user" | "assistant",
      content: m.content || "",
    };
  });
}

// Convert our tool format to OpenAI format
function toOpenAITools(tools: Tool[]): ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    },
  }));
}

export async function chat(
  config: LLMConfig,
  messages: ChatMessage[],
  tools?: Tool[]
): Promise<ChatResponse> {
  const client = createClient(config);
  const model = config.model;

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: toOpenAIMessages(messages),
      tools: tools && tools.length > 0 ? toOpenAITools(tools) : undefined,
      tool_choice: tools && tools.length > 0 ? "auto" : undefined,
      temperature: undefined,
    });

    const choice = completion.choices[0];
    const message = choice?.message;

    // Convert tool_calls to our format
    const toolCalls: ToolCall[] | undefined = message?.tool_calls
      ?.filter((tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & { type: "function" } =>
        tc.type === "function"
      )
      .map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

    return {
      content: message?.content || "",
      tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    };
  } catch (error) {
    console.error("[LLM] Error:", error);
    throw error;
  }
}

/**
 * Streaming chat - returns a ReadableStream of SSE events.
 * Used by /api/llm/chat to keep Vercel connections alive past 15s timeout.
 */
export function chatStream(
  config: LLMConfig,
  messages: ChatMessage[],
  tools?: Tool[]
): ReadableStream<Uint8Array> {
  const client = createClient(config);
  const model = config.model;

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      // Send heartbeat immediately to open the stream (browser receives response instantly)
      controller.enqueue(encoder.encode(`: connected\n\n`));

      try {
        const stream = await client.chat.completions.create({
          model,
          messages: toOpenAIMessages(messages),
          tools: tools && tools.length > 0 ? toOpenAITools(tools) : undefined,
          tool_choice: tools && tools.length > 0 ? "auto" : undefined,
          temperature: undefined,
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          // Forward content deltas
          if (delta.content) {
            const event = `data: ${JSON.stringify({ type: "content", text: delta.content })}\n\n`;
            controller.enqueue(encoder.encode(event));
          }

          // Forward tool call deltas
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const event = `data: ${JSON.stringify({ type: "tool_call", index: tc.index, id: tc.id, function: tc.function })}\n\n`;
              controller.enqueue(encoder.encode(event));
            }
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "LLM stream failed";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`));
        controller.close();
      }
    },
  });
}

// ===========================================
// SHARED CHAT FUNCTION FACTORY
// ===========================================
// Creates a ChatFn compatible with the agent system.
// Used by: web (useOrchestrator), Slack handler, Telegram handler, test scripts.
// Single source of truth — no duplicated chat logic per platform.

import type {
  ChatFn,
  LLMChatMessage,
  LLMToolDef,
  LLMChatResponse,
  LLMToolCall,
} from "@/lib/agents/types";

export function createChatFn(config: LLMConfig): ChatFn {
  const client = createClient(config);

  return async (
    messages: LLMChatMessage[],
    tools?: LLMToolDef[],
  ): Promise<LLMChatResponse> => {
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: messages as ChatCompletionMessageParam[],
      tools: tools && tools.length > 0 ? tools as ChatCompletionTool[] : undefined,
      tool_choice: tools && tools.length > 0 ? "auto" : undefined,
    });

    const choice = completion.choices[0];
    const message = choice?.message;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolCalls: LLMToolCall[] | undefined = message?.tool_calls
      ?.filter((tc: { type: string }) => tc.type === "function")
      .map((tc: any) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

    return {
      content: message?.content || "",
      tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    };
  };
}

// Simple chat without tools (for backward compatibility)
export async function chatSimple(
  config: LLMConfig,
  messages: ChatMessage[]
): Promise<string> {
  // Filter out tool messages
  const simpleMessages = messages
    .filter((m) => m.role !== "tool")
    .map((m) => ({
      ...m,
      content: m.content || "",
      tool_calls: undefined,
    }));
  const response = await chat(config, simpleMessages);
  return response.content;
}

// ================================================
// FILE SUMMARY GENERATION (with chunking)
// ================================================

export function shouldChunk(code: string): boolean {
  const lineCount = code.split("\n").length;
  return lineCount > MAX_LINES || code.length > MAX_CHARS;
}

export function chunkByLines(code: string, chunkSize: number, overlap: number): string[] {
  const lines = code.split("\n");
  const chunks: string[] = [];

  for (let i = 0; i < lines.length; i += chunkSize - overlap) {
    const chunk = lines.slice(i, i + chunkSize).join("\n");
    chunks.push(chunk);
    if (i + chunkSize >= lines.length) break;
  }

  return chunks;
}

export function chunkByChars(code: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];

  for (let i = 0; i < code.length; i += chunkSize - overlap) {
    const chunk = code.slice(i, i + chunkSize);
    chunks.push(chunk);
    if (i + chunkSize >= code.length) break;
  }

  return chunks;
}

export function getCodeChunks(code: string): string[] {
  const lineCount = code.split("\n").length;

  if (lineCount > MAX_LINES) {
    return chunkByLines(code, CHUNK_LINES, CHUNK_LINES_OVERLAP);
  } else {
    return chunkByChars(code, CHUNK_CHARS, CHUNK_CHARS_OVERLAP);
  }
}

async function summarizeChunk(
  config: LLMConfig,
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
- Any CRITICAL/HIGH security or performance issues (only if present)

Keep the summary under 200 words. Be specific and technical.`,
    },
    {
      role: "user",
      content: `File: ${filePath} (chunk ${chunkIndex + 1}/${totalChunks})\n\n\`\`\`\n${chunk}\n\`\`\``,
    },
  ];

  return chatSimple(config, messages);
}

async function combineSummaries(
  config: LLMConfig,
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
- Consolidates any CRITICAL/HIGH security or performance issues found across chunks (if any)

Keep the final summary under 450 words. Be specific and technical.`,
    },
    {
      role: "user",
      content: `File: ${filePath}\n\nChunk summaries:\n\n${summariesText}`,
    },
  ];

  return chatSimple(config, messages);
}

export async function generateFileSummary(
  config: LLMConfig,
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
- **Security issues** (CRITICAL/HIGH only): injection, XSS, auth bypass, exposed secrets, SSRF, insecure crypto. Skip if none found.
- **Performance issues** (CRITICAL/HIGH only): N+1 queries, unbounded loops, memory leaks, missing pagination, blocking I/O. Skip if none found.

Keep the summary under 350 words. Be specific and technical.`,
      },
      {
        role: "user",
        content: `File: ${filePath}\n\n\`\`\`\n${code}\n\`\`\``,
      },
    ];

    return chatSimple(config, messages);
  }

  // Large file - chunk and combine
  const chunks = getCodeChunks(code);
  console.log(`Chunking ${filePath}: ${chunks.length} chunks (${code.split("\n").length} lines, ${code.length} chars)`);

  const chunkSummaries: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const summary = await summarizeChunk(config, filePath, chunks[i], i, chunks.length);
    chunkSummaries.push(summary);
  }

  const finalSummary = await combineSummaries(config, filePath, chunkSummaries);
  return finalSummary;
}
