// Platform Adapter Interface
// Shared by Slack, Telegram, Discord adapters
// Converts orchestrator events ↔ platform-specific messages

import type { Plan, StreamEvent } from "@/lib/agents/types";

// Parsed incoming message from any platform
export interface PlatformMessage {
  platform: "slack" | "telegram" | "discord";
  userId: string;           // Platform user ID
  channelId: string;        // Channel/chat ID
  teamId?: string;          // Workspace/guild ID
  threadId?: string;        // Thread ID (for threaded replies)
  text: string;             // Message text
  interactionId?: string;   // Button click / action ID
  interactionData?: string; // Button value / callback data
}

// Resolved context after looking up platform_connections
export interface PlatformContext {
  codebotUserId: string;    // Codeteel user ID (from platform_connections)
  repoId: string;           // Linked repository ID
  repoFullName: string;     // e.g. "owner/repo"
  defaultBranch: string;
  conversationId?: string;  // Existing conversation (from thread)
  workingBranch?: string;   // If set on conversation
}

// Platform adapter — each platform implements this
export interface PlatformAdapter {
  // Send a text message
  sendText(channelId: string, text: string, threadId?: string): Promise<string | undefined>;

  // Send plan for approval (with Approve/Reject buttons)
  sendPlanApproval(channelId: string, plan: Plan, threadId?: string, conversationId?: string): Promise<string | undefined>;

  // Send branch selection (with branch buttons)
  sendBranchSelection(channelId: string, branches: string[], suggestedName: string, threadId?: string): Promise<string | undefined>;

  // Send progress update (step N/M)
  sendProgress(channelId: string, step: number, total: number, description: string, threadId?: string): Promise<void>;

  // Send execution complete summary
  sendExecutionComplete(channelId: string, filesChanged: string[], threadId?: string): Promise<void>;

  // Send error message
  sendError(channelId: string, error: string, threadId?: string): Promise<void>;

  // Send PR created notification
  sendPRCreated(channelId: string, prUrl: string, prNumber: number, threadId?: string): Promise<void>;

  // Show typing indicator (platform-specific)
  sendTyping?(channelId: string): Promise<void>;

  // Route a stream event to the appropriate send method
  handleEvent(channelId: string, event: StreamEvent, threadId?: string): Promise<void>;
}

// ===========================================
// SHARED UTILITIES
// ===========================================

/**
 * Split a long message into chunks that respect the platform's character limit.
 * Splits at newlines when possible to keep formatting intact.
 */
export function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline near the limit
    let splitIndex = remaining.lastIndexOf("\n", maxLength);
    if (splitIndex < maxLength * 0.5) {
      // No good newline found — split at space
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex < maxLength * 0.3) {
      // No good space found — hard split
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).replace(/^\n/, ""); // Remove leading newline
  }

  return chunks;
}
