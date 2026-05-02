// Telegram-specific Handler
// Thin wrapper around shared platform handler + Telegram callback handling

import { createAdminClient } from "@/lib/db/client";
import { TelegramAdapter } from "./adapter";
import { ServerToolExecutor } from "@/lib/agents/tools/server";
import { handlePlatformMessage, resolveContext } from "../handler";
import type { PlatformMessage } from "../interface";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// ===========================================
// HANDLE /start TOKEN (connect flow)
// ===========================================

export async function handleTelegramStart(
  chatId: string,
  token: string,
  telegramUserId: string,
  botToken: string,
): Promise<void> {
  const adapter = new TelegramAdapter(botToken);
  const adminClient: AnyClient = createAdminClient();

  // Look up the token
  const { data: connectToken } = await adminClient
    .from("platform_connect_tokens")
    .select("id, user_id, repo_id, expires_at, used, platform")
    .eq("token", token)
    .eq("platform", "telegram")
    .single();

  if (!connectToken) {
    await adapter.sendText(chatId, "❌ Invalid connection link. Generate a new one from the Codeteel web interface.");
    return;
  }

  if (connectToken.used) {
    await adapter.sendText(chatId, "❌ This connection link has already been used. Generate a new one from Settings.");
    return;
  }

  if (new Date(connectToken.expires_at) < new Date()) {
    await adapter.sendText(chatId, "❌ This connection link has *expired*. Links are valid for 5 minutes.\n\nGo to the Codeteel web interface and generate a new one.");
    // Mark as used to prevent retry
    await adminClient
      .from("platform_connect_tokens")
      .update({ used: true })
      .eq("id", connectToken.id);
    return;
  }

  // Get repo info
  const { data: repo } = await adminClient
    .from("repositories")
    .select("full_name, index_status")
    .eq("id", connectToken.repo_id)
    .single();

  if (!repo) {
    await adapter.sendText(chatId, "❌ Repository not found.");
    return;
  }

  if (repo.index_status !== "ready") {
    await adapter.sendText(chatId, `❌ Repository \`${repo.full_name}\` is not indexed yet. Index it on the web interface first.`);
    return;
  }

  // Check platform LLM
  const { data: platformProvider } = await adminClient
    .from("platform_llm_providers")
    .select("id")
    .eq("user_id", connectToken.user_id)
    .eq("is_active", true)
    .single();

  if (!platformProvider) {
    await adapter.sendText(chatId, "❌ No Platform LLM configured. Go to Codeteel Settings and add a Platform LLM provider first.");
    return;
  }

  // One chat = one repo — remove existing connection for this chat
  await adminClient
    .from("platform_connections")
    .delete()
    .eq("platform", "telegram")
    .eq("platform_channel_id", String(chatId));

  // Create connection
  await adminClient
    .from("platform_connections")
    .insert({
      user_id: connectToken.user_id,
      platform: "telegram",
      platform_channel_id: String(chatId),
      platform_user_id: String(telegramUserId),
      repo_id: connectToken.repo_id,
    });

  // Mark token as used
  await adminClient
    .from("platform_connect_tokens")
    .update({ used: true })
    .eq("id", connectToken.id);

  await adapter.sendText(
    chatId,
    `✅ *Connected to \`${repo.full_name}\`!*\n\nYou can now send messages here to interact with your codebase.\n\nCommands:\n/branch feature/xyz — set working branch\n/status — show connection info\n/disconnect — unlink this chat\n/help — show all commands`,
  );
}

// ===========================================
// HANDLE REGULAR MESSAGE
// ===========================================

export async function handleTelegramMessage(
  msg: PlatformMessage,
  botToken: string,
): Promise<void> {
  const adapter = new TelegramAdapter(botToken);
  await handlePlatformMessage(msg, adapter);
}

// ===========================================
// HANDLE BOT COMMANDS
// ===========================================

export async function handleTelegramCommand(
  chatId: string,
  command: string,
  args: string,
  telegramUserId: string,
  botToken: string,
): Promise<void> {
  const adapter = new TelegramAdapter(botToken);
  const adminClient: AnyClient = createAdminClient();

  switch (command) {
    case "/status": {
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "telegram")
        .eq("platform_channel_id", String(chatId))
        .single();

      if (!connection) {
        await adapter.sendText(chatId, "Not connected to any repository. Use the web interface to generate a connect link.");
        return;
      }

      const { data: repo } = await adminClient
        .from("repositories")
        .select("full_name, index_status, file_count")
        .eq("id", connection.repo_id)
        .single();

      const { data: conv } = await adminClient
        .from("conversations")
        .select("working_branch")
        .eq("repo_id", connection.repo_id)
        .eq("user_id", connection.user_id)
        .eq("platform", "telegram")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      await adapter.sendText(
        chatId,
        `📊 *Status*\nRepository: \`${repo?.full_name}\`\nIndex: ${repo?.index_status}\nFiles: ${repo?.file_count || 0}\nBranch: ${conv?.working_branch ? `\`${conv.working_branch}\`` : "_not set_"}`,
      );
      return;
    }

    case "/connect": {
      // List available repos
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("user_id")
        .eq("platform", "telegram")
        .eq("platform_channel_id", String(chatId))
        .single();

      if (!connection) {
        await adapter.sendText(chatId, "Use the web interface to connect. Go to a repo page and click *Connect Telegram*.");
        return;
      }

      const { data: repos } = await adminClient
        .from("repositories")
        .select("full_name, index_status")
        .eq("user_id", connection.user_id)
        .order("full_name");

      if (!repos || repos.length === 0) {
        await adapter.sendText(chatId, "No repositories found. Connect a repo on the web first.");
        return;
      }

      const repoList = repos.map((r: { full_name: string; index_status: string }) => {
        const status = r.index_status === "ready" ? "✅" : "⏳";
        return `${status} \`${r.full_name}\` (${r.index_status})`;
      }).join("\n");

      await adapter.sendText(chatId, `*Available repositories:*\n${repoList}\n\nTo switch repos, use the web interface → repo page → *Connect Telegram*.`);
      return;
    }

    case "/branch": {
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "telegram")
        .eq("platform_channel_id", String(chatId))
        .single();

      if (!connection) {
        await adapter.sendText(chatId, "Not connected. Use the web interface to connect first.");
        return;
      }

      // Find or create conversation
      let conv = (await adminClient
        .from("conversations")
        .select("id, working_branch")
        .eq("repo_id", connection.repo_id)
        .eq("user_id", connection.user_id)
        .eq("platform", "telegram")
        .eq("platform_metadata->>channel_id", String(chatId))
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()).data;

      if (!conv) {
        const { data: newConv } = await adminClient
          .from("conversations")
          .insert({
            repo_id: connection.repo_id,
            user_id: connection.user_id,
            title: "Telegram conversation",
            platform: "telegram",
            platform_metadata: { channel_id: String(chatId), user_id: String(telegramUserId) },
          })
          .select("id, working_branch")
          .single();
        conv = newConv;
      }

      // /branch (no args) — show current
      if (!args) {
        await adapter.sendText(
          chatId,
          conv?.working_branch
            ? `🔀 Current branch: \`${conv.working_branch}\``
            : "No working branch set. Use `/branch feature/xyz` to set one.",
        );
        return;
      }

      const cleanArgs = args.replace(/`/g, "").trim();

      // /branch create feature/xyz
      if (cleanArgs.startsWith("create ")) {
        const branchName = cleanArgs.replace("create ", "").trim();
        if (["main", "master"].includes(branchName.toLowerCase())) {
          await adapter.sendText(chatId, "🔒 Cannot create a branch named `main` or `master`.");
          return;
        }

        try {
          const executor = new ServerToolExecutor(connection.user_id);
          const { data: repo } = await adminClient
            .from("repositories")
            .select("default_branch")
            .eq("id", connection.repo_id)
            .single();

          await executor.createBranch(connection.repo_id, {
            name: branchName,
            baseBranch: repo?.default_branch || "main",
          });

          if (conv?.id) {
            await adminClient.from("conversations").update({ working_branch: branchName }).eq("id", conv.id);
          }

          await adapter.sendText(chatId, `🔀 Branch \`${branchName}\` created and set as working branch.`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          await adapter.sendText(chatId, `❌ Failed to create branch: ${errMsg}`);
        }
        return;
      }

      // /branch feature/xyz — switch
      const branchName = cleanArgs;
      if (["main", "master"].includes(branchName.toLowerCase())) {
        await adapter.sendText(chatId, "🔒 `main` and `master` are protected branches.");
        return;
      }

      if (conv?.id) {
        await adminClient.from("conversations").update({ working_branch: branchName }).eq("id", conv.id);
      }

      await adapter.sendText(chatId, `🔀 Switched to branch \`${branchName}\`.`);
      return;
    }

    case "/branches": {
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "telegram")
        .eq("platform_channel_id", String(chatId))
        .single();

      if (!connection) {
        await adapter.sendText(chatId, "Not connected.");
        return;
      }

      try {
        const executor = new ServerToolExecutor(connection.user_id);
        const result = await executor.listBranches(connection.repo_id);
        const branchList = result.branches
          .map(b => {
            const icon = b.protected ? "🔒" : "🔀";
            const isDefault = b.name === result.defaultBranch ? " _(default)_" : "";
            return `${icon} \`${b.name}\`${isDefault}`;
          })
          .join("\n");

        await adapter.sendText(chatId, `*Branches:*\n${branchList}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        await adapter.sendText(chatId, `❌ Failed to list branches: ${errMsg}`);
      }
      return;
    }

    case "/reset": {
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "telegram")
        .eq("platform_channel_id", String(chatId))
        .single();

      if (!connection) {
        await adapter.sendText(chatId, "Not connected.");
        return;
      }

      await adminClient
        .from("conversations")
        .update({ working_branch: null })
        .eq("repo_id", connection.repo_id)
        .eq("user_id", connection.user_id)
        .eq("platform", "telegram");

      await adapter.sendText(chatId, "🔄 Working branch cleared. The next code change request will ask you to select a branch.");
      return;
    }

    case "/disconnect": {
      await adminClient
        .from("platform_connections")
        .delete()
        .eq("platform", "telegram")
        .eq("platform_channel_id", String(chatId));

      await adapter.sendText(chatId, "🔌 Disconnected. This chat is no longer linked to a repository.");
      return;
    }

    case "/clear": {
      const { data: convs } = await adminClient
        .from("conversations")
        .select("id")
        .eq("platform", "telegram")
        .eq("platform_metadata->>channel_id", String(chatId));

      if (convs && convs.length > 0) {
        for (const conv of convs) {
          await adminClient.from("messages").delete().eq("conversation_id", conv.id);
        }
        await adminClient
          .from("conversations")
          .delete()
          .in("id", convs.map((c: { id: string }) => c.id));
      }

      await adapter.sendText(chatId, "🧹 Conversation cleared. Send a new message to begin.");
      return;
    }

    case "/help":
    default: {
      await adapter.sendText(
        chatId,
        [
          "*Codeteel Commands:*",
          "",
          "📌 *Connection:*",
          "/connect — List available repos",
          "/disconnect — Unlink this chat",
          "/status — Show connection info",
          "",
          "🔀 *Branches:*",
          "/branch — Show current branch",
          "/branch feature/xyz — Switch to a branch",
          "/branch create feature/xyz — Create and switch",
          "/branches — List all branches",
          "/reset — Clear working branch",
          "",
          "🧹 *Other:*",
          "/clear — Clear conversation history",
          "/help — Show this menu",
          "",
          "Just type your questions or change requests directly in the chat.",
        ].join("\n"),
      );
      return;
    }
  }
}

// ===========================================
// HANDLE CALLBACK QUERY (button clicks)
// ===========================================

export async function handleTelegramCallback(
  callbackQueryId: string,
  chatId: string,
  messageId: string,
  data: string,
  telegramUserId: string,
  botToken: string,
): Promise<void> {
  const adapter = new TelegramAdapter(botToken);
  const adminClient: AnyClient = createAdminClient();

  await adapter.answerCallback(callbackQueryId, "Processing...");

  if (data.startsWith("approve:")) {
    const conversationId = data.replace("approve:", "");
    await adapter.editMessage(chatId, messageId, "✅ Plan approved! Executing...");

    await handleTelegramMessage(
      {
        platform: "telegram",
        userId: String(telegramUserId),
        channelId: String(chatId),
        text: "yes",
        interactionData: conversationId || undefined,
      },
      botToken,
    );
  } else if (data.startsWith("reject:")) {
    const conversationId = data.replace("reject:", "");
    await adapter.editMessage(chatId, messageId, "❌ Plan rejected.");

    await handleTelegramMessage(
      {
        platform: "telegram",
        userId: String(telegramUserId),
        channelId: String(chatId),
        text: "no",
        interactionData: conversationId || undefined,
      },
      botToken,
    );
  } else if (data.startsWith("branch:")) {
    const branch = data.replace("branch:", "");
    await adapter.editMessage(chatId, messageId, `🔀 Branch selected: \`${branch}\``);

    const context = await resolveContext({
      platform: "telegram",
      userId: String(telegramUserId),
      channelId: String(chatId),
      text: "",
    });

    if (context?.conversationId) {
      await adminClient.from("conversations").update({ working_branch: branch }).eq("id", context.conversationId);
    }

    await adapter.sendText(chatId, `Branch set to \`${branch}\`. You can now request code changes.`);
  } else if (data.startsWith("create_branch:")) {
    const branchName = data.replace("create_branch:", "");
    await adapter.editMessage(chatId, messageId, `🔀 Creating branch \`${branchName}\`...`);

    const context = await resolveContext({
      platform: "telegram",
      userId: String(telegramUserId),
      channelId: String(chatId),
      text: "",
    });

    if (context) {
      try {
        const executor = new ServerToolExecutor(context.codebotUserId);
        await executor.createBranch(context.repoId, { name: branchName, baseBranch: context.defaultBranch });

        if (context.conversationId) {
          await adminClient.from("conversations").update({ working_branch: branchName }).eq("id", context.conversationId);
        }

        await adapter.sendText(chatId, `Branch \`${branchName}\` created and set as working branch.`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        await adapter.sendError(chatId, `Failed to create branch: ${errMsg}`);
      }
    }
  }
}
