// Chat Compression - compresses conversation history when token count exceeds threshold
//
// Pure module: no Supabase, no Next.js imports.
// All DB access goes through ToolExecutor.
// LLM calls go through injected ChatFn.

import { encode } from "gpt-tokenizer";
import type { ChatFn, LLMChatMessage, AgentMessage } from "./types";
import type { ToolExecutor, ConversationMessage } from "./tools/interface";
import { COMPRESSION_TOKEN_THRESHOLD, COMPRESSION_RATIO } from "./constants";

// ===========================================
// CHAT SUMMARY (mirrors DB table)
// ===========================================

export interface ChatSummary {
  conversationId: string;
  summary: string;
  lastMessageId: string;
  tokensCompressed: number;
}

// ===========================================
// TOKEN COUNTING
// ===========================================

/** Count tokens in a string using gpt-tokenizer */
export function countTokens(text: string): number {
  return encode(text).length;
}

/** Count tokens across an array of messages */
export function countMessagesTokens(messages: AgentMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += countTokens(msg.content || "");
    if (msg.tool_calls) {
      total += countTokens(JSON.stringify(msg.tool_calls));
    }
  }
  return total;
}

/** Count tokens across ConversationMessage array (from DB) */
function countConversationMessagesTokens(messages: ConversationMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += countTokens(msg.content || "");
    if (msg.toolCalls) {
      total += countTokens(JSON.stringify(msg.toolCalls));
    }
  }
  return total;
}

// ===========================================
// COMPRESSION PROMPT
// ===========================================

const COMPRESSION_SYSTEM_PROMPT = `You are a conversation compressor. Your job is to create a concise summary of a conversation between a user and a coding assistant (CodeBot).

RULES:
- Preserve ALL key information: decisions made, files discussed, code changes, plans created, errors encountered
- Preserve the user's original intent and any follow-up requests
- Preserve any file paths, function names, branch names, and technical details
- Preserve the outcome of any actions (what was searched, planned, executed, committed)
- Do NOT include redundant tool call details — summarize what was found, not every search query
- Do NOT include pleasantries or filler
- Write in third person past tense: "The user asked...", "CodeBot searched...", "A plan was created..."
- Keep it under 2000 tokens
- If a previous summary is provided, integrate it into the new summary (don't just append)`;

// ===========================================
// SHOULD COMPRESS
// ===========================================

/**
 * Check if compression is needed based on current token count.
 * Pass the summary token count + messages token count.
 * @param threshold - Override token threshold (for testing). Defaults to COMPRESSION_TOKEN_THRESHOLD.
 */
export function shouldCompress(
  summaryTokens: number,
  messagesTokens: number,
  threshold: number = COMPRESSION_TOKEN_THRESHOLD,
): boolean {
  return (summaryTokens + messagesTokens) >= threshold;
}

// ===========================================
// COMPRESS MESSAGES
// ===========================================

/**
 * Compress conversation messages into a summary.
 *
 * @param conversationId - The conversation to compress
 * @param executor - ToolExecutor for DB access
 * @param chatFn - LLM chat function for generating summary
 * @param existingSummary - Previous summary (if any) to integrate
 * @param threshold - Override token threshold (for testing). Defaults to COMPRESSION_TOKEN_THRESHOLD.
 * @returns Updated ChatSummary or null if compression not needed
 */
export async function compressConversation(
  conversationId: string,
  executor: ToolExecutor,
  chatFn: ChatFn,
  existingSummary?: ChatSummary | null,
  threshold: number = COMPRESSION_TOKEN_THRESHOLD,
): Promise<ChatSummary | null> {
  // Fetch all messages for this conversation
  const allMessages = await executor.getMessages(conversationId);
  if (allMessages.length === 0) return null;

  // Find messages after the last summarized message
  let messagesToConsider: ConversationMessage[];
  if (existingSummary) {
    const lastIdx = allMessages.findIndex(m => m.id === existingSummary.lastMessageId);
    if (lastIdx === -1) {
      // Last message not found (deleted?), consider all messages
      messagesToConsider = allMessages;
    } else {
      messagesToConsider = allMessages.slice(lastIdx + 1);
    }
  } else {
    messagesToConsider = allMessages;
  }

  if (messagesToConsider.length === 0) return existingSummary || null;

  // Check if we need compression
  const summaryTokens = existingSummary ? countTokens(existingSummary.summary) : 0;
  const messagesTokens = countConversationMessagesTokens(messagesToConsider);

  if (!shouldCompress(summaryTokens, messagesTokens, threshold)) {
    return existingSummary || null;
  }

  // Calculate how many messages to compress (60%)
  const compressCount = Math.ceil(messagesToConsider.length * COMPRESSION_RATIO);
  const toCompress = messagesToConsider.slice(0, compressCount);
  const lastCompressedMessage = toCompress[toCompress.length - 1];

  // Build the text to compress
  const conversationText = toCompress
    .map(m => {
      let line = `[${m.role.toUpperCase()}]: ${m.content}`;
      if (m.toolCalls) {
        line += `\n[TOOL_CALLS]: ${JSON.stringify(m.toolCalls)}`;
      }
      return line;
    })
    .join("\n\n");

  // Build LLM prompt
  let userPrompt = "";
  if (existingSummary) {
    userPrompt += `## Previous Summary:\n${existingSummary.summary}\n\n`;
  }
  userPrompt += `## New Messages to Compress:\n${conversationText}\n\n`;
  userPrompt += `Create a concise, integrated summary that covers everything above.`;

  const llmMessages: LLMChatMessage[] = [
    { role: "system", content: COMPRESSION_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const response = await chatFn(llmMessages);
  const summary = response.content.trim();

  const tokensCompressed = (existingSummary?.tokensCompressed || 0) +
    countConversationMessagesTokens(toCompress);

  const chatSummary: ChatSummary = {
    conversationId,
    summary,
    lastMessageId: lastCompressedMessage.id,
    tokensCompressed,
  };

  // Persist to DB
  await executor.upsertChatSummary(chatSummary);

  return chatSummary;
}

// ===========================================
// BUILD COMPRESSED MESSAGES
// ===========================================

/**
 * Build the message array for LLM calls, incorporating the summary
 * and only including messages after the last summarized point.
 *
 * @param systemPrompt - The system prompt to prepend
 * @param allMessages - All conversation messages (AgentMessage format)
 * @param summary - Existing chat summary (if any)
 * @param allDbMessages - All conversation messages from DB (to find the cutoff point)
 * @returns Messages array ready for LLM call
 */
export function buildCompressedMessages(
  systemPrompt: string,
  allMessages: AgentMessage[],
  summary: ChatSummary | null,
  allDbMessages: ConversationMessage[],
): AgentMessage[] {
  const result: AgentMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  if (summary) {
    // Inject summary as a system message
    result.push({
      role: "system",
      content: `## Conversation Summary (compressed from earlier messages):\n${summary.summary}`,
    });

    // Find the cutoff index in the DB messages
    const lastIdx = allDbMessages.findIndex(m => m.id === summary.lastMessageId);

    if (lastIdx !== -1) {
      // Only include messages after the last summarized one
      // Map DB message count to allMessages: skip system prompt (first), take from offset
      // allMessages = [system, ...context.messages, user_message]
      // context.messages come from DB, so we need to offset by (lastIdx + 1) from context.messages
      const messagesToKeep = allMessages.slice(lastIdx + 2); // +1 for 0-index, +1 for system prompt offset
      result.push(...messagesToKeep);
    } else {
      // Fallback: include all messages after system prompt
      result.push(...allMessages.slice(1));
    }
  } else {
    // No summary — include everything
    result.push(...allMessages.slice(1)); // skip system prompt (already added)
  }

  return result;
}
