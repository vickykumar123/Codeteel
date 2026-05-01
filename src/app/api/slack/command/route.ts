// Slack Slash Command Handler
// Handles /codeteel commands (connect, disconnect, status)

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/db/client";
import { ServerToolExecutor } from "@/lib/agents/tools/server";
import { WebClient } from "@slack/web-api";
import { decrypt } from "@/lib/crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", signingSecret);
  hmac.update(sigBasestring);
  const mySignature = `v0=${hmac.digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") || "";
  const signature = request.headers.get("x-slack-signature") || "";

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: "SLACK_SIGNING_SECRET not configured" }, { status: 500 });
  }

  if (!verifySlackSignature(signingSecret, timestamp, body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const params = new URLSearchParams(body);
  const command = params.get("command") || "";
  const text = (params.get("text") || "").trim();
  const channelId = params.get("channel_id") || "";
  const teamId = params.get("team_id") || "";
  const slackUserId = params.get("user_id") || "";
  const responseUrl = params.get("response_url") || "";

  if (command !== "/codeteel") {
    return NextResponse.json({ text: "Unknown command" });
  }

  const adminClient: AnyClient = createAdminClient();

  // Parse subcommand — strip backticks (Slack formatting) from args
  const cleanText = text.replace(/`/g, "").trim();
  const [subcommand, ...args] = cleanText.split(" ");

  switch (subcommand.toLowerCase()) {
    case "connect": {
      // Find the Slack installation to get the Codeteel user
      const { data: installation } = await adminClient
        .from("slack_installations")
        .select("user_id, bot_token")
        .eq("team_id", teamId)
        .single();

      if (!installation) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "Slack is not connected to Codeteel. Go to your Codeteel settings and click 'Add to Slack' first.",
        });
      }

      // /codeteel connect (no repo) → list available repos
      const repoFullName = args[0];
      if (!repoFullName || !repoFullName.includes("/")) {
        const { data: repos } = await adminClient
          .from("repositories")
          .select("full_name, index_status")
          .eq("user_id", installation.user_id)
          .order("full_name");

        if (!repos || repos.length === 0) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9999";
          return NextResponse.json({
            response_type: "ephemeral",
            text: `No repositories found. Connect a repo at ${appUrl}/repos/connect first.`,
          });
        }

        const repoList = repos.map((r: { full_name: string; index_status: string }) => {
          const status = r.index_status === "ready" ? "✅" : "⏳";
          return `${status} \`${r.full_name}\` (${r.index_status})`;
        }).join("\n");

        return NextResponse.json({
          response_type: "ephemeral",
          text: `*Available repositories:*\n${repoList}\n\nUse \`/codeteel connect owner/repo\` to link one to this channel.`,
        });
      }

      // /codeteel connect owner/repo → link specific repo
      const { data: repo } = await adminClient
        .from("repositories")
        .select("id, full_name, index_status")
        .eq("user_id", installation.user_id)
        .eq("full_name", repoFullName)
        .single();

      if (!repo) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: `Repository \`${repoFullName}\` not found. Type \`/codeteel connect\` to see available repos.`,
        });
      }

      if (repo.index_status !== "ready") {
        return NextResponse.json({
          response_type: "ephemeral",
          text: `Repository \`${repoFullName}\` is not indexed yet. Index it on the Codeteel web interface first.`,
        });
      }

      // Check platform LLM provider
      const { data: platformProvider } = await adminClient
        .from("platform_llm_providers")
        .select("id")
        .eq("user_id", installation.user_id)
        .eq("is_active", true)
        .single();

      if (!platformProvider) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9999";
        return NextResponse.json({
          response_type: "ephemeral",
          text: `Cloud LLM provider is not configured for platform use. Go to ${appUrl}/settings and add a Platform LLM provider.`,
        });
      }

      // One channel = one repo — remove any existing connection for this channel
      await adminClient
        .from("platform_connections")
        .delete()
        .eq("platform", "slack")
        .eq("platform_channel_id", channelId);

      // Create new connection
      await adminClient
        .from("platform_connections")
        .insert({
          user_id: installation.user_id,
          platform: "slack",
          platform_team_id: teamId,
          platform_channel_id: channelId,
          platform_user_id: slackUserId,
          repo_id: repo.id,
        });

      // Auto-join bot to the channel
      try {
        const botToken = decrypt(installation.bot_token);
        const slackClient = new WebClient(botToken);
        await slackClient.conversations.join({ channel: channelId });
        console.log(`[Slack] Bot joined channel ${channelId}`);
      } catch (joinErr) {
        console.log(`[Slack] Could not auto-join channel ${channelId}:`, joinErr instanceof Error ? joinErr.message : joinErr);
        // For private channels, bot needs manual invite
      }

      return NextResponse.json({
        response_type: "in_channel",
        text: `✅ Connected to \`${repoFullName}\`! You can now send messages in this channel to interact with the codebase.`,
      });
    }

    case "disconnect": {
      // /codeteel disconnect
      await adminClient
        .from("platform_connections")
        .delete()
        .eq("platform", "slack")
        .eq("platform_channel_id", channelId);

      return NextResponse.json({
        response_type: "in_channel",
        text: "🔌 Disconnected. This channel is no longer linked to a repository.",
      });
    }

    case "status": {
      // /codeteel status
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "slack")
        .eq("platform_channel_id", channelId)
        .single();

      if (!connection) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "This channel is not connected to any repository. Use `/codeteel connect owner/repo` to link one.",
        });
      }

      const { data: repo } = await adminClient
        .from("repositories")
        .select("full_name, index_status, file_count")
        .eq("id", connection.repo_id)
        .single();

      // Find latest conversation with working_branch
      const { data: conv } = await adminClient
        .from("conversations")
        .select("working_branch")
        .eq("repo_id", connection.repo_id)
        .eq("user_id", connection.user_id)
        .eq("platform", "slack")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        response_type: "ephemeral",
        text: [
          `📊 *Status*`,
          `Repository: \`${repo?.full_name}\``,
          `Index: ${repo?.index_status}`,
          `Files: ${repo?.file_count || 0}`,
          `Branch: ${conv?.working_branch ? `\`${conv.working_branch}\`` : "_not set_"}`,
        ].join("\n"),
      });
    }

    case "branch": {
      // /codeteel branch — show current branch
      // /codeteel branch feature/xyz — switch branch
      // /codeteel branch create feature/xyz — create and switch
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "slack")
        .eq("platform_channel_id", channelId)
        .single();

      if (!connection) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "This channel is not connected to any repository. Use `/codeteel connect owner/repo` first.",
        });
      }

      // Find latest conversation, or create one if none exists
      let conv = (await adminClient
        .from("conversations")
        .select("id, working_branch")
        .eq("repo_id", connection.repo_id)
        .eq("user_id", connection.user_id)
        .eq("platform", "slack")
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
            title: "Slack conversation",
            platform: "slack",
            platform_metadata: { team_id: teamId, channel_id: channelId, user_id: slackUserId },
          })
          .select("id, working_branch")
          .single();
        conv = newConv;
      }

      // /codeteel branch (no args) — show current
      if (args.length === 0) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: conv?.working_branch
            ? `🔀 Current branch: \`${conv.working_branch}\``
            : "No working branch set. Use `/codeteel branch feature/xyz` to set one.",
        });
      }

      // /codeteel branch create feature/xyz
      if (args[0] === "create" && args[1]) {
        const branchName = args[1];
        if (["main", "master"].includes(branchName.toLowerCase())) {
          return NextResponse.json({
            response_type: "ephemeral",
            text: "🔒 Cannot create a branch named `main` or `master`.",
          });
        }

        // Respond immediately, create branch in background
        const bgUserId = connection.user_id;
        const bgRepoId = connection.repo_id;
        const bgConvId = conv?.id;

        // Fire-and-forget
        (async () => {
          try {
            const executor = new ServerToolExecutor(bgUserId);
            const { data: repo } = await adminClient
              .from("repositories")
              .select("default_branch")
              .eq("id", bgRepoId)
              .single();

            await executor.createBranch(bgRepoId, {
              name: branchName,
              baseBranch: repo?.default_branch || "main",
            });

            if (bgConvId) {
              await adminClient
                .from("conversations")
                .update({ working_branch: branchName })
                .eq("id", bgConvId);
            }

            // Send result via response_url
            if (responseUrl) {
              await fetch(responseUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  response_type: "in_channel",
                  text: `🔀 Branch \`${branchName}\` created and set as working branch.`,
                }),
              });
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Unknown error";
            if (responseUrl) {
              await fetch(responseUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  response_type: "ephemeral",
                  text: `Failed to create branch: ${errMsg}`,
                }),
              }).catch(() => {});
            }
          }
        })();

        return NextResponse.json({
          response_type: "ephemeral",
          text: `⏳ Creating branch \`${branchName}\`...`,
        });
      }

      // /codeteel branch feature/xyz — switch to existing branch
      const branchName = args[0];
      if (["main", "master"].includes(branchName.toLowerCase())) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "🔒 `main` and `master` are protected branches. Use a feature branch instead.",
        });
      }
      if (conv?.id) {
        await adminClient
          .from("conversations")
          .update({ working_branch: branchName })
          .eq("id", conv.id);
      }

      return NextResponse.json({
        response_type: "in_channel",
        text: `🔀 Switched to branch \`${branchName}\`.`,
      });
    }

    case "branches": {
      // /codeteel branches — list all branches
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "slack")
        .eq("platform_channel_id", channelId)
        .single();

      if (!connection) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "This channel is not connected to any repository.",
        });
      }

      // Fire-and-forget — respond via response_url
      const bgData = { userId: connection.user_id, repoId: connection.repo_id };
      (async () => {
        try {
          const executor = new ServerToolExecutor(bgData.userId);
          const result = await executor.listBranches(bgData.repoId);
          const branchList = result.branches
            .map(b => {
              const icon = b.protected ? "🔒" : "🔀";
              const isDefault = b.name === result.defaultBranch ? " _(default)_" : "";
              return `${icon} \`${b.name}\`${isDefault}`;
            })
            .join("\n");

          if (responseUrl) {
            await fetch(responseUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ response_type: "ephemeral", text: `*Branches:*\n${branchList}` }),
            });
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          if (responseUrl) {
            await fetch(responseUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ response_type: "ephemeral", text: `Failed to list branches: ${errMsg}` }),
            }).catch(() => {});
          }
        }
      })();

      return NextResponse.json({
        response_type: "ephemeral",
        text: "⏳ Fetching branches...",
      });
    }

    case "clear": {
      // /codeteel clear — clear conversation history + branch, start fresh
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "slack")
        .eq("platform_channel_id", channelId)
        .single();

      if (!connection) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "This channel is not connected to any repository.",
        });
      }

      // Find all Slack conversations for this channel
      const { data: convs } = await adminClient
        .from("conversations")
        .select("id")
        .eq("repo_id", connection.repo_id)
        .eq("user_id", connection.user_id)
        .eq("platform", "slack")
        .eq("platform_metadata->>channel_id", channelId);

      if (convs && convs.length > 0) {
        const convIds = convs.map((c: { id: string }) => c.id);

        // Delete messages for these conversations
        for (const convId of convIds) {
          await adminClient
            .from("messages")
            .delete()
            .eq("conversation_id", convId);
        }

        // Delete the conversations
        await adminClient
          .from("conversations")
          .delete()
          .in("id", convIds);
      }

      return NextResponse.json({
        response_type: "in_channel",
        text: "🧹 Conversation cleared. Starting fresh — send a new message to begin.",
      });
    }

    case "reset": {
      // /codeteel reset — clear working branch
      const { data: connection } = await adminClient
        .from("platform_connections")
        .select("repo_id, user_id")
        .eq("platform", "slack")
        .eq("platform_channel_id", channelId)
        .single();

      if (!connection) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "This channel is not connected to any repository.",
        });
      }

      // Clear working_branch on all slack conversations for this repo
      await adminClient
        .from("conversations")
        .update({ working_branch: null })
        .eq("repo_id", connection.repo_id)
        .eq("user_id", connection.user_id)
        .eq("platform", "slack");

      return NextResponse.json({
        response_type: "in_channel",
        text: "🔄 Working branch cleared. The next code change request will ask you to select a branch.",
      });
    }

    case "help":
    default: {
      return NextResponse.json({
        response_type: "ephemeral",
        text: [
          "*Codeteel Commands:*",
          "",
          "*Connection:*",
          "• `/codeteel connect` — List available repos",
          "• `/codeteel connect owner/repo` — Link this channel to a repository",
          "• `/codeteel disconnect` — Unlink this channel",
          "• `/codeteel status` — Show connection info",
          "",
          "*Branches:*",
          "• `/codeteel branch` — Show current working branch",
          "• `/codeteel branch feature/xyz` — Switch to a branch",
          "• `/codeteel branch create feature/xyz` — Create and switch to a new branch",
          "• `/codeteel branches` — List all branches",
          "• `/codeteel reset` — Clear working branch",
          "• `/codeteel clear` — Clear conversation history and start fresh",
          "",
          "*Usage:*",
          "Once connected, type your questions or change requests directly in the channel.",
          "• Ask questions: _\"What does the webhook handler do?\"_",
          "• Request changes: _\"Add a /health endpoint to app.py\"_",
          "• Create PR: _\"Create a PR\"_",
          "• Review: _\"Review the open PRs\"_",
        ].join("\n"),
      });
    }
  }
}
