// Shared Platform Handler
// Core logic for processing messages from any platform (Slack, Telegram, Discord)
// Platform-specific adapters handle message formatting — this handles the orchestrator pipeline.

import { createAdminClient } from "@/lib/db/client";
import { decrypt } from "@/lib/crypto";
import { runOrchestrator } from "@/lib/agents/orchestrator";
import { ServerToolExecutor } from "@/lib/agents/tools/server";
import { createChatFn } from "@/lib/llm";
import type { PlatformMessage, PlatformContext, PlatformAdapter } from "./interface";
import type {
  AgentContext,
  StreamEvent,
  PersistedExecutionState,
  SearchJournalEntry,
  Plan,
} from "@/lib/agents/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// ===========================================
// RESOLVE PLATFORM MESSAGE → CONTEXT
// ===========================================

export async function resolveContext(msg: PlatformMessage): Promise<PlatformContext | null> {
  const adminClient: AnyClient = createAdminClient();

  // Look up platform_connections by channel + platform
  const { data: connection } = await adminClient
    .from("platform_connections")
    .select("user_id, repo_id")
    .eq("platform", msg.platform)
    .eq("platform_channel_id", msg.channelId)
    .single();

  if (!connection) return null;

  // Get repo info
  const { data: repo } = await adminClient
    .from("repositories")
    .select("id, full_name, default_branch, index_status")
    .eq("id", connection.repo_id)
    .single();

  if (!repo) return null;

  // Find existing conversation for this channel
  let conversationId: string | undefined;
  let workingBranch: string | undefined;

  if (msg.threadId) {
    // Threaded mode: look for conversation linked to this thread
    const { data: conv } = await adminClient
      .from("conversations")
      .select("id, working_branch")
      .eq("repo_id", repo.id)
      .eq("user_id", connection.user_id)
      .eq("platform", msg.platform)
      .eq("platform_metadata->>thread_ts", msg.threadId)
      .single();

    if (conv) {
      conversationId = conv.id;
      workingBranch = conv.working_branch || undefined;
    }
  } else {
    // Non-threaded: find the latest conversation for this channel
    const { data: conv } = await adminClient
      .from("conversations")
      .select("id, working_branch")
      .eq("repo_id", repo.id)
      .eq("user_id", connection.user_id)
      .eq("platform", msg.platform)
      .eq("platform_metadata->>channel_id", msg.channelId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (conv) {
      conversationId = conv.id;
      workingBranch = conv.working_branch || undefined;
    }
  }

  return {
    codebotUserId: connection.user_id,
    repoId: repo.id,
    repoFullName: repo.full_name,
    defaultBranch: repo.default_branch || "main",
    conversationId,
    workingBranch,
  };
}

// ===========================================
// GET PLATFORM LLM CONFIG
// ===========================================

export async function getPlatformLLMConfig(userId: string): Promise<{ provider: string; baseUrl: string; model: string; apiKey: string } | null> {
  const adminClient: AnyClient = createAdminClient();

  const { data: provider } = await adminClient
    .from("platform_llm_providers")
    .select("provider, base_url, model, api_key")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!provider) return null;

  return {
    provider: provider.provider,
    baseUrl: provider.base_url,
    model: provider.model,
    apiKey: decrypt(provider.api_key),
  };
}

// ===========================================
// HANDLE PLATFORM MESSAGE (core pipeline)
// ===========================================

export interface HandleMessageResult {
  response: string;
  conversationId: string;
  executionState: PersistedExecutionState;
}

export async function handlePlatformMessage(
  msg: PlatformMessage,
  adapter: PlatformAdapter,
  opts?: { onEvent?: (event: StreamEvent) => void },
): Promise<HandleMessageResult | null> {
  const adminClient: AnyClient = createAdminClient();

  // 1. Resolve context
  const context = await resolveContext(msg);
  if (!context) {
    await adapter.sendText(
      msg.channelId,
      `This channel is not connected to a repository. Use \`/codeteel connect owner/repo\` to link one.`,
      msg.threadId,
    );
    return null;
  }

  // 2. Check platform LLM config
  const llmConfig = await getPlatformLLMConfig(context.codebotUserId);
  if (!llmConfig) {
    await adapter.sendText(
      msg.channelId,
      "Cloud LLM provider is not configured for platform use. Go to your Codeteel settings page and add a Platform LLM provider (OpenAI, Claude, Gemini, etc.).",
      msg.threadId,
    );
    return null;
  }

  // 3. Check if already processing (per-channel lock via DB)
  if (context.conversationId) {
    const { data: convCheck } = await adminClient
      .from("conversations")
      .select("is_processing, updated_at")
      .eq("id", context.conversationId)
      .single();

    if (convCheck?.is_processing) {
      // Stale lock check: if processing for > 5 minutes, it's stuck — clear and continue
      const lockAge = Date.now() - new Date(convCheck.updated_at).getTime();
      if (lockAge > 5 * 60 * 1000) {
        console.log(`[${msg.platform}] Stale processing lock (${Math.round(lockAge / 1000)}s) — clearing`);
        await adminClient
          .from("conversations")
          .update({ is_processing: false })
          .eq("id", context.conversationId);
      } else {
        await adapter.sendText(
          msg.channelId,
          "⏳ I'm still working on the previous request. Please wait for me to finish before sending a new message.",
          msg.threadId,
        );
        return null;
      }
    }
  }

  // 4. Create or get conversation
  let conversationId = msg.interactionData || context.conversationId;
  const threadTs = msg.threadId;

  // If we got a conversationId from button click but context didn't have working branch, load it
  if (conversationId && !context.workingBranch) {
    const { data: convCheck } = await adminClient
      .from("conversations")
      .select("working_branch")
      .eq("id", conversationId)
      .single();
    if (convCheck?.working_branch) {
      context.workingBranch = convCheck.working_branch;
    }
  }

  if (!conversationId) {
    const { data: conv } = await adminClient
      .from("conversations")
      .insert({
        repo_id: context.repoId,
        user_id: context.codebotUserId,
        title: msg.text.slice(0, 100),
        platform: msg.platform,
        platform_metadata: {
          team_id: msg.teamId,
          channel_id: msg.channelId,
          thread_ts: threadTs,
          user_id: msg.userId,
        },
      })
      .select("id")
      .single();

    conversationId = conv?.id;
  }

  if (!conversationId) {
    await adapter.sendError(msg.channelId, "Failed to create conversation", threadTs);
    return null;
  }

  // 4. Save user message
  await adminClient.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: msg.text,
  });

  // 5. Get user profile
  const { data: userProfile } = await adminClient
    .from("users")
    .select("github_access_token, embedding_provider, embedding_api_key, embedding_model, custom_instructions")
    .eq("id", context.codebotUserId)
    .single();

  if (!userProfile?.github_access_token) {
    await adapter.sendError(msg.channelId, "GitHub not connected. Go to your Codeteel settings to connect GitHub.", threadTs);
    return null;
  }

  // 5b. Load existing execution state
  let initialState: PersistedExecutionState | undefined;
  if (conversationId) {
    const { data: convData } = await adminClient
      .from("conversations")
      .select("execution_state")
      .eq("id", conversationId)
      .single();

    if (convData?.execution_state) {
      initialState = convData.execution_state as PersistedExecutionState;
      console.log(`[${msg.platform}] Loaded state for conv=${conversationId}: plan=${initialState.currentPlan?.title || "none"}, files=${initialState.filesChanged?.length || 0}`);
    }
  }

  // 6. Build agent context
  const executor = new ServerToolExecutor(context.codebotUserId);
  const customInstructions = await executor.getCustomInstructions(context.repoId);

  // Load conversation history (last 20 messages)
  const { data: historyMsgs } = await adminClient
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  const conversationHistory = (historyMsgs || [])
    .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
    .map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const agentContext: AgentContext = {
    repoId: context.repoId,
    userId: context.codebotUserId,
    conversationId,
    githubToken: userProfile.github_access_token,
    repoFullName: context.repoFullName,
    defaultBranch: context.defaultBranch,
    workingBranch: context.workingBranch,
    messages: conversationHistory,
    llmConfig: {
      provider: llmConfig.provider as AgentContext["llmConfig"]["provider"],
      baseUrl: llmConfig.baseUrl,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
    },
    embeddingConfig: {
      provider: (userProfile.embedding_provider || "openai") as AgentContext["embeddingConfig"]["provider"],
      apiKey: userProfile.embedding_api_key || "",
      model: userProfile.embedding_model || undefined,
    },
    customInstructions: customInstructions || undefined,
  };

  // 7. Create chat function
  const chatFn = createChatFn({
    provider: llmConfig.provider as import("@/lib/llm").LLMProvider,
    baseUrl: llmConfig.baseUrl,
    model: llmConfig.model,
    apiKey: llmConfig.apiKey,
  });

  // 8. Set processing lock
  if (conversationId) {
    await adminClient
      .from("conversations")
      .update({ is_processing: true })
      .eq("id", conversationId);
  }

  // 9. Run orchestrator
  console.log(`[${msg.platform}] Incoming message: "${msg.text}" | channel: ${msg.channelId} | user: ${msg.userId}`);

  // "Still processing" timer
  let lastActivityTime = Date.now();
  const STILL_PROCESSING_INTERVAL = 15_000;
  const stillProcessingTimer = setInterval(async () => {
    if (Date.now() - lastActivityTime > STILL_PROCESSING_INTERVAL) {
      await adapter.sendText(msg.channelId, "⏳ Still processing your request...", threadTs).catch(() => {});
      lastActivityTime = Date.now();
    }
  }, STILL_PROCESSING_INTERVAL);

  let planSentInThisRound = false;
  let branchSelectionSent = false;
  const pendingActions: { branchSelection?: { suggestedName: string } } = {};

  const onEvent = async (event: StreamEvent) => {
    lastActivityTime = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evtAny = event as any;
    const extra = event.type === "message" ? `content: "${(event.content as string)?.slice(0, 200)}"`
      : event.type === "tool_call" ? `${evtAny.tool}(${JSON.stringify(evtAny.args || {}).slice(0, 100)})`
      : event.type === "tool_result" ? `${evtAny.tool}: ${(evtAny.result || "").slice(0, 100)}`
      : event.type === "plan_pending" ? `"${evtAny.plan?.title}" (${evtAny.plan?.steps?.length} steps)`
      : "";
    console.log(`[${msg.platform}] Event: ${event.type} ${extra}`);

    // Plan pending — send with approval buttons
    if (event.type === "plan_pending") {
      planSentInThisRound = true;
      if (event.plan) {
        await adapter.sendPlanApproval(msg.channelId, event.plan as Plan, threadTs, conversationId);
      }
      return;
    }

    // Suppress duplicate text message after plan
    if (event.type === "message" && planSentInThisRound) {
      planSentInThisRound = false;
      return;
    }

    // Suppress orchestrator text about branch selection — the buttons handle it
    if (event.type === "message" && branchSelectionSent) {
      branchSelectionSent = false;
      return;
    }
    if (event.type === "message" && (event.content as string)?.includes("select or create a branch")) {
      return; // Always suppress — branch selection buttons or error already sent
    }

    // Branch selection — defer to after orchestrator returns (so we can await it)
    if (event.type === "branch_selection_required") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req = event.request as any;
      pendingActions.branchSelection = { suggestedName: req?.suggestedName || "feature/changes" };
      branchSelectionSent = true;
      return;
    }

    // Forward other events to platform adapter
    adapter.handleEvent(msg.channelId, event, threadTs).catch(console.error);

    // Call external onEvent if provided
    opts?.onEvent?.(event);
  };

  try {
    const result = await runOrchestrator(
      msg.text,
      agentContext,
      executor,
      chatFn,
      onEvent,
      initialState,
    );

    // Send deferred branch selection (now we can properly await)
    if (pendingActions.branchSelection) {
      const branchReq = pendingActions.branchSelection;
      try {
        const branchResult = await executor.listBranches(context.repoId);
        const branchNames = branchResult.branches
          .filter(b => !b.protected && b.name !== "main" && b.name !== "master")
          .map(b => b.name);
        console.log(`[${msg.platform}] Branches: ${branchResult.branches.length} total, ${branchNames.length} after filter`);
        await adapter.sendBranchSelection(
          msg.channelId,
          branchNames,
          branchReq.suggestedName,
          threadTs,
        );
      } catch (err) {
        console.error(`[${msg.platform}] Failed to fetch branches:`, err);
        await adapter.sendError(msg.channelId, "Failed to fetch branches. Use /branch feature/xyz to set a branch manually.", threadTs);
      }
    }

    // Clean up LLM artifacts
    const cleanResponse = result.response
      ?.replace(/\n*\s*CONFIRMED\.?\s*$/i, "")
      .replace(/\n*\s*END\.?\s*$/i, "")
      .replace(/\n+CONFIRMED\n*/gi, "\n")
      .trim();

    console.log(`[${msg.platform}] Response: "${cleanResponse?.slice(0, 300)}"`);

    // Save assistant response
    if (cleanResponse) {
      await adminClient.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: cleanResponse,
      });
    }

    // Save execution state
    console.log(`[${msg.platform}] Saving state for conv=${conversationId}: plan=${result.executionState?.currentPlan?.title || "none"}, files=${result.executionState?.filesChanged?.length || 0}`);
    await adminClient
      .from("conversations")
      .update({
        execution_state: result.executionState,
        ...(agentContext.workingBranch ? { working_branch: agentContext.workingBranch } : {}),
      })
      .eq("id", conversationId);

    return {
      response: cleanResponse || "",
      conversationId,
      executionState: result.executionState,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    await adapter.sendError(msg.channelId, errorMsg, threadTs);
    return null;
  } finally {
    clearInterval(stillProcessingTimer);
    // Release processing lock
    if (conversationId) {
      try {
        await adminClient
          .from("conversations")
          .update({ is_processing: false })
          .eq("id", conversationId);
      } catch { /* Don't fail if cleanup fails */ }
    }
  }
}
