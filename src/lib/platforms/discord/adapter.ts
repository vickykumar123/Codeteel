// Discord Adapter
// Converts orchestrator events → Discord messages with action rows

import { splitMessage, type PlatformAdapter } from "../interface";
import type { Plan, StreamEvent } from "@/lib/agents/types";

const DISCORD_API = "https://discord.com/api/v10";

export class DiscordAdapter implements PlatformAdapter {
  private botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  private async callAPI(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${DISCORD_API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${this.botToken}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;
    if (!response.ok) {
      console.error(`[Discord] API error: ${method} ${path}`, data.message || data);
    }
    return data;
  }

  async sendText(channelId: string, text: string, _threadId?: string): Promise<string | undefined> {
    const MAX_LENGTH = 2000;

    if (text.length > MAX_LENGTH) {
      const chunks = splitMessage(text, MAX_LENGTH);
      let lastMessageId: string | undefined;
      for (const chunk of chunks) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await this.callAPI("POST", `/channels/${channelId}/messages`, { content: chunk }) as any;
        lastMessageId = result.id;
      }
      return lastMessageId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.callAPI("POST", `/channels/${channelId}/messages`, { content: text }) as any;
    return result.id;
  }

  async sendPlanApproval(channelId: string, plan: Plan, _threadId?: string, conversationId?: string): Promise<string | undefined> {
    const stepsText = plan.steps
      .map((step, i) => `${i + 1}. **${step.type.toUpperCase()}** \`${step.path}\`\n   ${step.description}`)
      .join("\n");

    const shortConvId = conversationId ? conversationId.slice(0, 36) : "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.callAPI("POST", `/channels/${channelId}/messages`, {
      embeds: [{
        title: `📋 ${plan.title}`,
        description: `${plan.summary}\n\n${stepsText}`.slice(0, 4096),
        color: 0x5865F2, // Discord blurple
      }],
      components: [{
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 3, // Success (green)
            label: "✅ Approve",
            custom_id: `approve:${shortConvId}`,
          },
          {
            type: 2,
            style: 4, // Danger (red)
            label: "❌ Reject",
            custom_id: `reject:${shortConvId}`,
          },
        ],
      }],
    }) as any;
    return result.id;
  }

  async sendBranchSelection(channelId: string, branches: string[], suggestedName: string, _threadId?: string): Promise<string | undefined> {
    // Discord buttons have 80-char label limit and max 5 per row, 5 rows max
    const buttons = branches.slice(0, 4).map(branch => ({
      type: 2,
      style: 2, // Secondary (gray)
      label: branch.slice(0, 80),
      custom_id: `branch:${branch}`,
    }));

    buttons.push({
      type: 2,
      style: 1, // Primary (blue)
      label: `➕ Create ${suggestedName}`.slice(0, 80),
      custom_id: `create_branch:${suggestedName}`,
    });

    let content = "🔀 **Select a working branch:**";
    if (branches.length === 0) {
      content += "\n_No feature branches found._";
    }
    content += `\n\nOr use the command:\n\`/branch ${suggestedName}\``;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.callAPI("POST", `/channels/${channelId}/messages`, {
      content,
      components: [{
        type: 1,
        components: buttons,
      }],
    }) as any;
    return result.id;
  }

  async sendProgress(channelId: string, step: number, total: number, description: string, _threadId?: string): Promise<void> {
    const progress = "█".repeat(step) + "░".repeat(total - step);
    await this.callAPI("POST", `/channels/${channelId}/messages`, {
      content: `⚙️ Step ${step}/${total} | ${progress} | ${description}`,
    });
  }

  async sendExecutionComplete(channelId: string, filesChanged: string[], _threadId?: string): Promise<void> {
    const fileList = filesChanged.map(f => `• \`${f}\``).join("\n");
    await this.callAPI("POST", `/channels/${channelId}/messages`, {
      embeds: [{
        title: "✅ Execution Complete",
        description: `Changed ${filesChanged.length} file(s):\n${fileList}`,
        color: 0x57F287, // Green
        footer: { text: 'Send "create pr" to open a pull request.' },
      }],
    });
  }

  async sendError(channelId: string, error: string, _threadId?: string): Promise<void> {
    await this.callAPI("POST", `/channels/${channelId}/messages`, {
      embeds: [{
        title: "⚠️ Error",
        description: error,
        color: 0xED4245, // Red
      }],
    });
  }

  async sendPRCreated(channelId: string, prUrl: string, prNumber: number, _threadId?: string): Promise<void> {
    await this.callAPI("POST", `/channels/${channelId}/messages`, {
      embeds: [{
        title: `🎉 PR #${prNumber} Created`,
        description: `[View Pull Request](${prUrl})`,
        color: 0x57F287,
      }],
    });
  }

  async sendTyping(channelId: string): Promise<void> {
    await this.callAPI("POST", `/channels/${channelId}/typing`, {});
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<void> {
    await this.callAPI("PATCH", `/channels/${channelId}/messages/${messageId}`, {
      content,
      components: [], // Remove buttons
    });
  }

  async handleEvent(channelId: string, event: StreamEvent, _threadId?: string): Promise<void> {
    switch (event.type) {
      case "thinking":
        break;

      case "execution_start":
        await this.sendText(channelId, "⚙️ Executing plan...");
        break;

      case "step_complete":
        break; // Skip — only show execution_complete

      case "execution_complete":
        await this.sendExecutionComplete(channelId, (event.filesChanged as string[]) || []);
        break;

      case "pr_created":
        await this.sendPRCreated(channelId, event.url as string, event.number as number);
        break;

      case "message":
        if (event.content) {
          const content = (event.content as string).trim();
          if (content) {
            await this.sendText(channelId, content);
          }
        }
        break;

      case "error":
        await this.sendError(channelId, (event.message as string) || "Unknown error");
        break;
    }
  }
}
