// Slack Adapter
// Converts orchestrator events → Slack Block Kit messages

import { WebClient } from "@slack/web-api";
import type { PlatformAdapter } from "../interface";
import type { Plan, StreamEvent } from "@/lib/agents/types";

export class SlackAdapter implements PlatformAdapter {
  private client: WebClient;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async sendText(channelId: string, text: string, threadId?: string): Promise<string | undefined> {
    const result = await this.client.chat.postMessage({
      channel: channelId,
      text,
      ...(threadId ? { thread_ts: threadId } : {}),
    });
    return result.ts;
  }

  async sendPlanApproval(channelId: string, plan: Plan, threadId?: string, conversationId?: string): Promise<string | undefined> {
    const stepsText = plan.steps
      .map((step, i) => `${i + 1}. *${step.type.toUpperCase()}* \`${step.path}\`\n    ${step.description}`)
      .join("\n");

    const result = await this.client.chat.postMessage({
      channel: channelId,
      text: `Plan: ${plan.title}`,
      ...(threadId ? { thread_ts: threadId } : {}),
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `📋 ${plan.title}` },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: plan.summary },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: stepsText },
        },
        {
          type: "actions",
          block_id: "plan_approval",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "✅ Approve" },
              style: "primary",
              action_id: "approve_plan",
              value: JSON.stringify({ planId: plan.id, conversationId }),
            },
            {
              type: "button",
              text: { type: "plain_text", text: "❌ Reject" },
              style: "danger",
              action_id: "reject_plan",
              value: JSON.stringify({ planId: plan.id, conversationId }),
            },
          ],
        },
      ],
    });
    return result.ts;
  }

  async sendBranchSelection(channelId: string, branches: string[], suggestedName: string, threadId?: string): Promise<string | undefined> {
    // Show up to 4 existing branches as buttons
    const branchButtons = branches.slice(0, 4).map((branch) => ({
      type: "button" as const,
      text: { type: "plain_text" as const, text: branch },
      action_id: `select_branch_${branch}`,
      value: branch,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = [
      {
        type: "section",
        text: { type: "mrkdwn", text: "🔀 *Select a working branch:*" },
      },
    ];

    if (branchButtons.length > 0) {
      blocks.push({
        type: "actions",
        block_id: "branch_selection",
        elements: branchButtons,
      });
    } else {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: "_No feature branches found._" },
      });
    }

    // Add help text for creating branches or selecting unlisted ones
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: [
            `*Create a new branch:* \`/codeteel branch create ${suggestedName}\``,
            `*Use a branch not listed:* \`/codeteel branch your-branch-name\``,
          ].join("\n"),
        },
      ],
    });

    const result = await this.client.chat.postMessage({
      channel: channelId,
      text: "Select a branch",
      ...(threadId ? { thread_ts: threadId } : {}),
      blocks,
    });
    return result.ts;
  }

  async sendProgress(channelId: string, step: number, total: number, description: string, threadId?: string): Promise<void> {
    const progress = "█".repeat(step) + "░".repeat(total - step);
    await this.client.chat.postMessage({
      channel: channelId,
      text: `Step ${step}/${total}: ${description}`,
      ...(threadId ? { thread_ts: threadId } : {}),
      blocks: [
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `⚙️ Step ${step}/${total} | ${progress} | ${description}` },
          ],
        },
      ],
    });
  }

  async sendExecutionComplete(channelId: string, filesChanged: string[], threadId?: string): Promise<void> {
    const fileList = filesChanged.map(f => `• \`${f}\``).join("\n");
    await this.client.chat.postMessage({
      channel: channelId,
      text: `Done! Changed ${filesChanged.length} file(s)`,
      ...(threadId ? { thread_ts: threadId } : {}),
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `✅ *Execution complete!* Changed ${filesChanged.length} file(s):\n${fileList}` },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: '_Reply "create pr" to open a pull request._' },
        },
      ],
    });
  }

  async sendError(channelId: string, error: string, threadId?: string): Promise<void> {
    await this.client.chat.postMessage({
      channel: channelId,
      text: `Error: ${error}`,
      ...(threadId ? { thread_ts: threadId } : {}),
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `⚠️ *Error:* ${error}` },
        },
      ],
    });
  }

  async sendPRCreated(channelId: string, prUrl: string, prNumber: number, threadId?: string): Promise<void> {
    await this.client.chat.postMessage({
      channel: channelId,
      text: `PR #${prNumber} created: ${prUrl}`,
      ...(threadId ? { thread_ts: threadId } : {}),
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `🎉 *PR #${prNumber} created!*\n<${prUrl}|View Pull Request>` },
        },
      ],
    });
  }

  // Update a message (e.g., replace buttons with result after click)
  async updateMessage(channelId: string, ts: string, text: string): Promise<void> {
    await this.client.chat.update({
      channel: channelId,
      ts,
      text,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text },
        },
      ],
    });
  }

  async handleEvent(channelId: string, event: StreamEvent, threadId?: string): Promise<void> {
    switch (event.type) {
      case "thinking":
        // Skip thinking events in Slack — too noisy
        break;

      case "plan_pending":
        if (event.plan) {
          await this.sendPlanApproval(channelId, event.plan as Plan, threadId);
        }
        break;

      case "branch_selection_required":
        if (event.request) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const req = event.request as any;
          const branchNames = (req.availableBranches || []).map((b: { name?: string } | string) =>
            typeof b === "string" ? b : b.name || ""
          );
          await this.sendBranchSelection(channelId, branchNames, req.suggestedName || "feature/changes", threadId);
        }
        break;

      case "execution_start":
        await this.sendText(channelId, "⚙️ Executing plan...", threadId);
        break;

      case "step_complete": {
        // Only show progress for multi-step plans (skip single step)
        const stepEvent = event as { stepIndex?: number; totalSteps?: number; description?: string };
        if ((stepEvent.totalSteps || 1) <= 1) break;
        await this.sendProgress(
          channelId,
          (stepEvent.stepIndex || 0) + 1,
          stepEvent.totalSteps || 1,
          stepEvent.description || "Processing...",
          threadId
        );
        break;
      }

      case "execution_complete":
        await this.sendExecutionComplete(channelId, (event.filesChanged as string[]) || [], threadId);
        break;

      case "pr_created":
        await this.sendPRCreated(channelId, event.url as string, event.number as number, threadId);
        break;

      case "message":
        if (event.content) {
          // Clean up LLM artifacts (some models append "CONFIRMED", "END", etc.)
          const cleanContent = (event.content as string)
            .replace(/\n*\s*CONFIRMED\.?\s*$/i, "")
            .replace(/\n*\s*END\.?\s*$/i, "")
            .replace(/\n+CONFIRMED\n*/gi, "\n")
            .trim();
          if (cleanContent) {
            await this.sendText(channelId, cleanContent, threadId);
          }
        }
        break;

      case "error":
        await this.sendError(channelId, (event.message as string) || "Unknown error", threadId);
        break;
    }
  }
}
