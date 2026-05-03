// Discord-specific Handler
// Thin wrapper around shared platform handler + Discord interaction handling

import { createAdminClient } from "@/lib/db/client";
import { DiscordAdapter } from "./adapter";
import { ServerToolExecutor } from "@/lib/agents/tools/server";
import { handlePlatformMessage, resolveContext } from "../handler";
import type { PlatformMessage } from "../interface";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// ===========================================
// HANDLE /connect TOKEN (connect flow — same as Telegram)
// ===========================================

export async function handleDiscordStart(
  channelId: string,
  token: string,
  discordUserId: string,
  botToken: string,
): Promise<string> {
  const adminClient: AnyClient = createAdminClient();

  const { data: connectToken } = await adminClient
    .from("platform_connect_tokens")
    .select("id, user_id, repo_id, expires_at, used, platform")
    .eq("token", token)
    .eq("platform", "discord")
    .single();

  if (!connectToken) {
    return "❌ Invalid connection link. Generate a new one from the Codeteel web interface.";
  }

  if (connectToken.used) {
    return "❌ This link has already been used. Generate a new one from Settings.";
  }

  if (new Date(connectToken.expires_at) < new Date()) {
    await adminClient.from("platform_connect_tokens").update({ used: true }).eq("id", connectToken.id);
    return "❌ This link has **expired**. Links are valid for 5 minutes.\n\nGo to the Codeteel web interface and generate a new one.";
  }

  const { data: repo } = await adminClient
    .from("repositories")
    .select("full_name, index_status")
    .eq("id", connectToken.repo_id)
    .single();

  if (!repo) {
    return "❌ Repository not found.";
  }

  if (repo.index_status !== "ready") {
    return `❌ Repository \`${repo.full_name}\` is not indexed yet. Index it on the web interface first.`;
  }

  const { data: platformProvider } = await adminClient
    .from("platform_llm_providers")
    .select("id")
    .eq("user_id", connectToken.user_id)
    .eq("is_active", true)
    .single();

  if (!platformProvider) {
    return "❌ No Platform LLM configured. Go to Codeteel Settings and add a Platform LLM provider first.";
  }

  // One channel = one repo
  await adminClient
    .from("platform_connections")
    .delete()
    .eq("platform", "discord")
    .eq("platform_channel_id", channelId);

  await adminClient
    .from("platform_connections")
    .insert({
      user_id: connectToken.user_id,
      platform: "discord",
      platform_channel_id: channelId,
      platform_user_id: discordUserId,
      repo_id: connectToken.repo_id,
    });

  await adminClient.from("platform_connect_tokens").update({ used: true }).eq("id", connectToken.id);

  return `✅ **Connected to \`${repo.full_name}\`!**\n\nYou can now send messages here to interact with your codebase.\n\nCommands: /branch, /status, /disconnect, /help`;
}

// ===========================================
// HANDLE REGULAR MESSAGE
// ===========================================

export async function handleDiscordMessage(
  msg: PlatformMessage,
  botToken: string,
): Promise<void> {
  const adapter = new DiscordAdapter(botToken);
  await handlePlatformMessage(msg, adapter);
}

// ===========================================
// HANDLE COMMANDS
// ===========================================

export async function handleDiscordCommand(
  channelId: string,
  command: string,
  args: string,
  discordUserId: string,
  botToken: string,
): Promise<string> {
  const adapter = new DiscordAdapter(botToken);
  const adminClient: AnyClient = createAdminClient();

  switch (command) {
    case "connect": {
      if (args) {
        // /connect TOKEN
        return await handleDiscordStart(channelId, args.trim(), discordUserId, botToken);
      }

      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("user_id")
        .eq("platform", "discord")
        .eq("platform_channel_id", channelId)
        .single();

      if (!connection) {
        return "Use the web interface to connect. Go to a repo page and click **Connect Discord**.";
      }

      const { data: repos } = await adminClient
        .from("repositories")
        .select("full_name, index_status")
        .eq("user_id", connection.user_id)
        .order("full_name");

      if (!repos || repos.length === 0) {
        return "No repositories found. Connect a repo on the web first.";
      }

      const repoList = repos.map((r: { full_name: string; index_status: string }) => {
        const status = r.index_status === "ready" ? "✅" : "⏳";
        return `${status} \`${r.full_name}\` (${r.index_status})`;
      }).join("\n");

      return `**Available repositories:**\n${repoList}\n\nTo switch repos, use the web interface → repo page → **Connect Discord**.`;
    }

    case "status": {
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "discord")
        .eq("platform_channel_id", channelId)
        .single();

      if (!connection) return "Not connected. Use the web interface to connect.";

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
        .eq("platform", "discord")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      return `📊 **Status**\nRepository: \`${repo?.full_name}\`\nIndex: ${repo?.index_status}\nFiles: ${repo?.file_count || 0}\nBranch: ${conv?.working_branch ? `\`${conv.working_branch}\`` : "_not set_"}`;
    }

    case "branch": {
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "discord")
        .eq("platform_channel_id", channelId)
        .single();

      if (!connection) return "Not connected.";

      let conv = (await adminClient
        .from("conversations")
        .select("id, working_branch")
        .eq("repo_id", connection.repo_id)
        .eq("user_id", connection.user_id)
        .eq("platform", "discord")
        .eq("platform_metadata->>channel_id", channelId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()).data;

      if (!conv) {
        const { data: newConv } = await adminClient
          .from("conversations")
          .insert({
            repo_id: connection.repo_id,
            user_id: connection.user_id,
            title: "Discord conversation",
            platform: "discord",
            platform_metadata: { channel_id: channelId, user_id: discordUserId },
          })
          .select("id, working_branch")
          .single();
        conv = newConv;
      }

      if (!args) {
        return conv?.working_branch
          ? `🔀 Current branch: \`${conv.working_branch}\``
          : "No working branch set. Use `/branch feature/xyz` to set one.";
      }

      const cleanArgs = args.replace(/`/g, "").trim();

      if (cleanArgs.startsWith("create ")) {
        const branchName = cleanArgs.replace("create ", "").trim();
        if (["main", "master"].includes(branchName.toLowerCase())) {
          return "🔒 Cannot create a branch named `main` or `master`.";
        }
        try {
          const executor = new ServerToolExecutor(connection.user_id);
          const { data: repo } = await adminClient
            .from("repositories")
            .select("default_branch")
            .eq("id", connection.repo_id)
            .single();
          await executor.createBranch(connection.repo_id, { name: branchName, baseBranch: repo?.default_branch || "main" });
          if (conv?.id) await adminClient.from("conversations").update({ working_branch: branchName }).eq("id", conv.id);
          return `🔀 Branch \`${branchName}\` created and set as working branch.`;
        } catch (err) {
          return `❌ Failed to create branch: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      }

      const branchName = cleanArgs;
      if (["main", "master"].includes(branchName.toLowerCase())) {
        return "🔒 `main` and `master` are protected branches.";
      }
      if (conv?.id) await adminClient.from("conversations").update({ working_branch: branchName }).eq("id", conv.id);
      return `🔀 Switched to branch \`${branchName}\`.`;
    }

    case "branches": {
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "discord")
        .eq("platform_channel_id", channelId)
        .single();

      if (!connection) return "Not connected.";

      try {
        const executor = new ServerToolExecutor(connection.user_id);
        const result = await executor.listBranches(connection.repo_id);
        const branchList = result.branches
          .map(b => `${b.protected ? "🔒" : "🔀"} \`${b.name}\`${b.name === result.defaultBranch ? " _(default)_" : ""}`)
          .join("\n");
        return `**Branches:**\n${branchList}`;
      } catch (err) {
        return `❌ Failed to list branches: ${err instanceof Error ? err.message : "Unknown error"}`;
      }
    }

    case "reset": {
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "discord")
        .eq("platform_channel_id", channelId)
        .single();

      if (!connection) return "Not connected.";

      await adminClient
        .from("conversations")
        .update({ working_branch: null })
        .eq("repo_id", connection.repo_id)
        .eq("user_id", connection.user_id)
        .eq("platform", "discord");

      return "🔄 Working branch cleared.";
    }

    case "disconnect": {
      await adminClient
        .from("platform_connections")
        .delete()
        .eq("platform", "discord")
        .eq("platform_channel_id", channelId);

      return "🔌 Disconnected. This channel is no longer linked to a repository.";
    }

    case "clear": {
      const { data: convs } = await adminClient
        .from("conversations")
        .select("id")
        .eq("platform", "discord")
        .eq("platform_metadata->>channel_id", channelId);

      if (convs && convs.length > 0) {
        for (const conv of convs) {
          await adminClient.from("messages").delete().eq("conversation_id", conv.id);
        }
        await adminClient
          .from("conversations")
          .delete()
          .in("id", convs.map((c: { id: string }) => c.id));
      }

      return "🧹 Conversation cleared. Send a new message to begin.";
    }

    case "help":
    default:
      return [
        "**Codeteel Commands:**",
        "",
        "💬 **Chat:**",
        "`/ask <message>` — Ask a question or request code changes",
        "",
        "📌 **Connection:**",
        "`/connect` — List available repos",
        "`/disconnect` — Unlink this channel",
        "`/status` — Show connection info",
        "",
        "🔀 **Branches:**",
        "`/branch` — Show current branch",
        "`/branch feature/xyz` — Switch branch",
        "`/branch create feature/xyz` — Create and switch",
        "`/branches` — List all branches",
        "`/reset` — Clear working branch",
        "",
        "🧹 **Other:**",
        "`/clear` — Clear conversation history",
        "`/help` — Show this menu",
        "",
        "Use `/ask` for all questions and code change requests.",
      ].join("\n");
  }
}

// ===========================================
// HANDLE BUTTON CLICKS
// ===========================================

export async function handleDiscordButton(
  channelId: string,
  messageId: string,
  customId: string,
  discordUserId: string,
  botToken: string,
): Promise<void> {
  const adapter = new DiscordAdapter(botToken);
  const adminClient: AnyClient = createAdminClient();

  if (customId.startsWith("approve:")) {
    const conversationId = customId.replace("approve:", "");
    await adapter.editMessage(channelId, messageId, "✅ Plan approved! Executing...");

    await handleDiscordMessage(
      {
        platform: "discord",
        userId: discordUserId,
        channelId,
        text: "yes",
        interactionData: conversationId || undefined,
      },
      botToken,
    );
  } else if (customId.startsWith("reject:")) {
    const conversationId = customId.replace("reject:", "");
    await adapter.editMessage(channelId, messageId, "❌ Plan rejected.");

    await handleDiscordMessage(
      {
        platform: "discord",
        userId: discordUserId,
        channelId,
        text: "no",
        interactionData: conversationId || undefined,
      },
      botToken,
    );
  } else if (customId.startsWith("branch:")) {
    const branch = customId.replace("branch:", "");
    await adapter.editMessage(channelId, messageId, `🔀 Branch selected: \`${branch}\``);

    const context = await resolveContext({
      platform: "discord",
      userId: discordUserId,
      channelId,
      text: "",
    });

    if (context?.conversationId) {
      await adminClient.from("conversations").update({ working_branch: branch }).eq("id", context.conversationId);
    }

    await adapter.sendText(channelId, `Branch set to \`${branch}\`. You can now request code changes.`);
  } else if (customId.startsWith("create_branch:")) {
    const branchName = customId.replace("create_branch:", "");
    await adapter.editMessage(channelId, messageId, `🔀 Creating branch \`${branchName}\`...`);

    const context = await resolveContext({
      platform: "discord",
      userId: discordUserId,
      channelId,
      text: "",
    });

    if (context) {
      try {
        const executor = new ServerToolExecutor(context.codebotUserId);
        await executor.createBranch(context.repoId, { name: branchName, baseBranch: context.defaultBranch });
        if (context.conversationId) {
          await adminClient.from("conversations").update({ working_branch: branchName }).eq("id", context.conversationId);
        }
        await adapter.sendText(channelId, `Branch \`${branchName}\` created and set as working branch.`);
      } catch (err) {
        await adapter.sendError(channelId, `Failed to create branch: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  }
}
