import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/db/client";
import { notFound, redirect } from "next/navigation";
import { ChatInterface } from "../chat-interface";

interface PageProps {
  params: Promise<{ id: string; chatId: string }>;
}

export default async function ChatWithIdPage({ params }: PageProps) {
  const { id, chatId } = await params;
  const user = await requireAuth();

  const adminClient = createAdminClient();

  // Get repository + user's active LLM provider in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyClient = adminClient as any;
  const [repoResult, providerResult] = await Promise.all([
    adminClient
      .from("repositories")
      .select("id, full_name, default_branch, index_status, file_count")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    anyClient
      .from("llm_providers")
      .select("provider, base_url, model")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single(),
  ]);

  const { data: repo, error } = repoResult;
  const { data: activeProvider } = providerResult;

  if (error || !repo) {
    notFound();
  }

  // Check if repository is indexed
  if (repo.index_status !== "ready") {
    redirect(`/repos/${id}?error=not_indexed`);
  }

  // Get conversation
  const { data: conversation } = await adminClient
    .from("conversations")
    .select("id, title, created_at, working_branch, execution_state")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .single();

  if (!conversation) {
    // Conversation not found, redirect to new chat
    redirect(`/repos/${id}/chat`);
  }

  // Get messages
  const { data: msgs } = await adminClient
    .from("messages")
    .select("id, role, content, metadata, created_at")
    .eq("conversation_id", chatId)
    .order("created_at", { ascending: true });

  // Transform messages to expected types
  const rawMessages = (msgs || []).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant" | "system" | "tool",
    content: m.content,
    metadata: (m.metadata as Record<string, unknown>) || null,
    created_at: m.created_at || new Date().toISOString(),
  }));

  // Post-process: infer plan approval state from subsequent messages.
  // If an execution message follows a plan message, the plan was approved.
  // If a rejection user message follows, the plan was rejected.
  const hasExecution = rawMessages.some((m) => m.metadata?.type === "execution" && m.metadata?.isComplete);
  const messages = rawMessages.map((m) => {
    if (m.metadata?.type === "plan" && m.metadata?.approved === undefined) {
      if (hasExecution) {
        return { ...m, metadata: { ...m.metadata, approved: true } };
      }
      // Check if user rejected after this plan
      const planIdx = rawMessages.indexOf(m);
      const hasRejection = rawMessages.slice(planIdx + 1).some(
        (rm) => rm.role === "user" && rm.content.toLowerCase().includes("reject")
      );
      if (hasRejection) {
        return { ...m, metadata: { ...m.metadata, approved: false } };
      }
    }
    return m;
  });

  // Get recent conversations
  const { data: recentConversations } = await adminClient
    .from("conversations")
    .select("id, title, updated_at")
    .eq("repo_id", id)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(10);

  // Transform conversations to expected types
  const conversations = (recentConversations || []).map((c) => ({
    id: c.id,
    title: c.title || "Untitled",
    updated_at: c.updated_at || new Date().toISOString(),
  }));

  return (
    <ChatInterface
      repoId={repo.id}
      repoName={repo.full_name}
      defaultBranch={repo.default_branch || "main"}
      fileCount={repo.file_count || 0}
      llmProvider={activeProvider?.provider || "ollama"}
      llmModel={activeProvider?.model || undefined}
      llmBaseUrl={activeProvider?.base_url || undefined}
      conversationId={conversation.id}
      conversationTitle={conversation.title || undefined}
      initialMessages={messages}
      conversations={conversations}
      initialWorkingBranch={conversation.working_branch || undefined}
      initialExecutionState={conversation.execution_state as Record<string, unknown> | undefined}
    />
  );
}
