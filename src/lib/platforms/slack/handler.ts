// Slack-specific Handler
// Thin wrapper around shared platform handler + Slack interactive actions

import { createAdminClient } from "@/lib/db/client";
import { SlackAdapter } from "./adapter";
import { ServerToolExecutor } from "@/lib/agents/tools/server";
import { handlePlatformMessage, resolveContext } from "../handler";
import type { PlatformMessage } from "../interface";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// ===========================================
// HANDLE SLACK MESSAGE
// ===========================================

export async function handleSlackMessage(
  msg: PlatformMessage,
  slackBotToken: string,
): Promise<void> {
  const adapter = new SlackAdapter(slackBotToken);
  await handlePlatformMessage(msg, adapter);
}

// ===========================================
// HANDLE SLACK INTERACTIVE (button clicks)
// ===========================================

export async function handleSlackInteraction(
  action: { actionId: string; value: string; channelId: string; threadTs?: string; userId: string; messageTs: string },
  slackBotToken: string,
): Promise<void> {
  const adapter = new SlackAdapter(slackBotToken);

  // Parse conversation ID from button value
  let buttonConversationId: string | undefined;
  try {
    const parsed = JSON.parse(action.value);
    buttonConversationId = parsed.conversationId;
  } catch { /* value is not JSON, ignore */ }

  if (action.actionId === "approve_plan") {
    await adapter.updateMessage(action.channelId, action.messageTs, "✅ Plan approved! Executing...");

    await handleSlackMessage(
      {
        platform: "slack",
        userId: action.userId,
        channelId: action.channelId,
        text: "yes",
        interactionData: buttonConversationId,
      },
      slackBotToken,
    );
  } else if (action.actionId === "reject_plan") {
    await adapter.updateMessage(action.channelId, action.messageTs, "❌ Plan rejected.");

    await handleSlackMessage(
      {
        platform: "slack",
        userId: action.userId,
        channelId: action.channelId,
        text: "no",
        interactionData: buttonConversationId,
      },
      slackBotToken,
    );
  } else if (action.actionId === "create_branch") {
    const branchName = action.value;
    await adapter.updateMessage(action.channelId, action.messageTs, `🔀 Creating branch \`${branchName}\`...`);

    const adminClient: AnyClient = createAdminClient();
    const context = await resolveContext({
      platform: "slack",
      userId: action.userId,
      channelId: action.channelId,
      text: "",
    });

    if (context) {
      try {
        const executor = new ServerToolExecutor(context.codebotUserId);
        await executor.createBranch(context.repoId, { name: branchName, baseBranch: context.defaultBranch });

        if (context.conversationId) {
          await adminClient
            .from("conversations")
            .update({ working_branch: branchName })
            .eq("id", context.conversationId);
        }

        await adapter.sendText(action.channelId, `Branch \`${branchName}\` created and set as working branch. You can now request code changes.`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        await adapter.sendError(action.channelId, `Failed to create branch: ${errMsg}`);
      }
    }
  } else if (action.actionId.startsWith("select_branch_")) {
    const branch = action.value;
    await adapter.updateMessage(action.channelId, action.messageTs, `🔀 Branch selected: \`${branch}\``);

    const adminClient: AnyClient = createAdminClient();
    const context = await resolveContext({
      platform: "slack",
      userId: action.userId,
      channelId: action.channelId,
      text: "",
    });

    if (context?.conversationId) {
      await adminClient
        .from("conversations")
        .update({ working_branch: branch })
        .eq("id", context.conversationId);
    }

    await adapter.sendText(action.channelId, `Branch set to \`${branch}\`. You can now request code changes.`);
  }
}
