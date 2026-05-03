// Telegram Adapter
// Converts orchestrator events → Telegram messages with inline keyboards

import { splitMessage, type PlatformAdapter } from "../interface";
import type { Plan, StreamEvent } from "@/lib/agents/types";

const TELEGRAM_API = "https://api.telegram.org/bot";

export class TelegramAdapter implements PlatformAdapter {
  private botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  private async callAPI(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: Record<string, unknown>; description?: string }> {
    const response = await fetch(`${TELEGRAM_API}${this.botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;
    if (!data.ok) {
      console.error(`[Telegram] API error: ${method}`, data.description || data);
    }
    return data;
  }

  // Send with Markdown, fallback to plain text if it fails
  private async sendMarkdown(chatId: string, text: string, extra?: Record<string, unknown>): Promise<{ ok: boolean; result?: Record<string, unknown> }> {
    // Convert double asterisks to single (Telegram Markdown v1 uses *bold* not **bold**)
    const telegramText = text
      .replace(/\*\*(.+?)\*\*/g, "*$1*")  // **bold** → *bold*
      .replace(/__(.+?)__/g, "_$1_");      // __italic__ → _italic_

    const result = await this.callAPI("sendMessage", {
      chat_id: chatId,
      text: telegramText,
      parse_mode: "Markdown",
      ...extra,
    });

    // If Markdown failed, retry without parse_mode
    if (!result.ok) {
      console.log(`[Telegram] Markdown failed (${result.description}), retrying as plain text`);
      return await this.callAPI("sendMessage", {
        chat_id: chatId,
        text: text.replace(/[*_`\[\]\\]/g, ""), // Strip all markdown chars
        ...extra,
      });
    }

    return result;
  }

  async sendText(chatId: string, text: string, _threadId?: string): Promise<string | undefined> {
    const MAX_LENGTH = 4096;

    // Split long messages
    if (text.length > MAX_LENGTH) {
      const chunks = splitMessage(text, MAX_LENGTH);
      let lastMessageId: string | undefined;
      for (const chunk of chunks) {
        const result = await this.sendMarkdown(chatId, chunk);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lastMessageId = (result.result as any)?.message_id?.toString();
      }
      return lastMessageId;
    }

    const result = await this.sendMarkdown(chatId, text);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result.result as any)?.message_id?.toString();
  }

  async sendPlanApproval(chatId: string, plan: Plan, _threadId?: string, conversationId?: string): Promise<string | undefined> {
    // Escape Markdown special chars in descriptions to prevent parse errors
    const escapeMarkdown = (s: string) => s.replace(/([_*`\[\]])/g, "\\$1");

    const stepsText = plan.steps
      .map((step, i) => `${i + 1}. *${step.type.toUpperCase()}* \`${step.path}\`\n   ${escapeMarkdown(step.description)}`)
      .join("\n");

    // callback_data has 64-byte limit — use short format
    const shortConvId = conversationId ? conversationId.slice(0, 36) : "";

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `approve:${shortConvId}` },
          { text: "❌ Reject", callback_data: `reject:${shortConvId}` },
        ],
      ],
    };

    const result = await this.sendMarkdown(chatId, `📋 *${escapeMarkdown(plan.title)}*\n\n${escapeMarkdown(plan.summary)}\n\n${stepsText}`, {
      reply_markup: replyMarkup,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result.result as any)?.message_id?.toString();
  }

  async sendBranchSelection(chatId: string, branches: string[], suggestedName: string, _threadId?: string): Promise<string | undefined> {
    const buttons = branches.slice(0, 6).map(branch => ([
      { text: branch, callback_data: `branch:${branch}` },
    ]));

    // Add create new button
    buttons.push([
      { text: `➕ Create ${suggestedName}`, callback_data: `create_branch:${suggestedName}` },
    ]);

    let text = "🔀 *Select a working branch:*";
    if (branches.length === 0) {
      text += "\n_No feature branches found._";
    }
    text += `\n\nOr use the command:\n\`/branch ${suggestedName}\``;

    const result = await this.callAPI("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: buttons,
      },
    }) as { result?: { message_id: number } };
    return result.result?.message_id?.toString();
  }

  async sendProgress(chatId: string, step: number, total: number, description: string, _threadId?: string): Promise<void> {
    const progress = "█".repeat(step) + "░".repeat(total - step);
    await this.callAPI("sendMessage", {
      chat_id: chatId,
      text: `⚙️ Step ${step}/${total} | ${progress}\n${description}`,
    });
  }

  async sendExecutionComplete(chatId: string, filesChanged: string[], _threadId?: string): Promise<void> {
    const fileList = filesChanged.map(f => `• \`${f}\``).join("\n");
    await this.callAPI("sendMessage", {
      chat_id: chatId,
      text: `✅ *Execution complete!* Changed ${filesChanged.length} file(s):\n${fileList}\n\n_Send "create pr" to open a pull request._`,
      parse_mode: "Markdown",
    });
  }

  async sendError(chatId: string, error: string, _threadId?: string): Promise<void> {
    await this.callAPI("sendMessage", {
      chat_id: chatId,
      text: `⚠️ *Error:* ${error}`,
      parse_mode: "Markdown",
    });
  }

  async sendPRCreated(chatId: string, prUrl: string, prNumber: number, _threadId?: string): Promise<void> {
    await this.callAPI("sendMessage", {
      chat_id: chatId,
      text: `🎉 *PR #${prNumber} created!*\n[View Pull Request](${prUrl})`,
      parse_mode: "Markdown",
    });
  }

  async editMessage(chatId: string, messageId: string, text: string): Promise<void> {
    await this.callAPI("editMessageText", {
      chat_id: chatId,
      message_id: parseInt(messageId),
      text,
      parse_mode: "Markdown",
    });
  }

  async answerCallback(callbackQueryId: string, text?: string): Promise<void> {
    await this.callAPI("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text: text || "Processing...",
    });
  }

  async handleEvent(chatId: string, event: StreamEvent, _threadId?: string): Promise<void> {
    switch (event.type) {
      case "thinking":
        break; // Skip — too noisy for Telegram

      case "plan_pending":
        // Handled by the shared handler (calls sendPlanApproval)
        break;

      case "branch_selection_required":
        // Handled by the shared handler (calls sendBranchSelection)
        break;

      case "execution_start":
        await this.sendText(chatId, "⚙️ Executing plan...");
        break;

      case "step_complete":
        // Skip individual step progress — only show execution_start and execution_complete
        break;

      case "execution_complete":
        await this.sendExecutionComplete(chatId, (event.filesChanged as string[]) || []);
        break;

      case "pr_created":
        await this.sendPRCreated(chatId, event.url as string, event.number as number);
        break;

      case "message":
        if (event.content) {
          const cleanContent = (event.content as string)
            .replace(/\n*\s*CONFIRMED\.?\s*$/i, "")
            .replace(/\n*\s*END\.?\s*$/i, "")
            .replace(/\n+CONFIRMED\n*/gi, "\n")
            .trim();
          if (cleanContent) {
            await this.sendText(chatId, cleanContent);
          }
        }
        break;

      case "error":
        await this.sendError(chatId, (event.message as string) || "Unknown error");
        break;
    }
  }
}
