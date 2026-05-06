import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/db/client";
import { notFound, redirect } from "next/navigation";
import { ChatInterface } from "./chat-interface";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NewChatPage({ params }: PageProps) {
  const { id } = await params;
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

  // Check if LLM provider is configured
  if (!activeProvider) {
    redirect(`/settings?error=no_llm&return=/repos/${id}/chat`);
  }

  // Get recent conversations
  const { data: recentConversations } = await adminClient
    .from("conversations")
    .select("id, title, updated_at, platform")
    .eq("repo_id", id)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(25);

  // Transform conversations to expected types
  const conversations = (recentConversations || []).map((c) => ({
    id: c.id,
    title: c.title || "Untitled",
    updated_at: c.updated_at || new Date().toISOString(),
    platform: (c as { platform?: string }).platform || "web",
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
      initialMessages={[]}
      conversations={conversations}
    />
  );
}
