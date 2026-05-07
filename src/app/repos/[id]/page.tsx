import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/db/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { IndexButton } from "./index-button";
import { FileList } from "./file-list";
import { ChangeBanner } from "./change-banner";
import { BranchSelector } from "./branch-selector";
import { RepoInstructions } from "./repo-instructions";
import { PlatformConnect } from "./platform-connect";
import { AppNavbar } from "../../components/app-navbar";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RepoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAuth();

  const adminClient = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyClient = adminClient as any;

  // ALL queries in parallel — single round trip
  const [repoResult, providerResult, embeddingResult, connectionResult, slackResult, fileCountResult, filesResult] = await Promise.all([
    adminClient.from("repositories").select("*").eq("id", id).eq("user_id", user.id).single(),
    anyClient.from("llm_providers").select("provider, base_url, model").eq("user_id", user.id).eq("is_active", true).single(),
    adminClient.from("users").select("email, embedding_provider, embedding_api_key").eq("id", user.id).single(),
    anyClient.from("platform_connections").select("id, platform, platform_channel_id, platform_team_id").eq("repo_id", id).eq("user_id", user.id),
    anyClient.from("slack_installations").select("team_id, team_name, bot_token").eq("user_id", user.id),
    adminClient.from("file_summaries").select("*", { count: "exact", head: true }).eq("repo_id", id),
    adminClient.from("file_summaries").select("id, path, language, size, summary, code").eq("repo_id", id).order("path").limit(1000),
  ]);

  const { data: repo, error } = repoResult;
  const { data: activeProvider } = providerResult;
  const embeddingConfigured = !!(embeddingResult.data?.embedding_provider && embeddingResult.data?.embedding_api_key);

  if (error || !repo) notFound();

  const platformConnections = connectionResult.data || [];
  const slackInstalled = (slackResult.data || []).length > 0;
  const fileCount = fileCountResult.count;
  const files = filesResult.data;

  const statusStyle: Record<string, string> = {
    ready: "bg-green-500/10 text-green-400 border-green-500/20",
    indexing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    pending: "bg-[#292524] text-[#A8A29E] border-[#3F3F46]",
  };

  return (
    <div className="min-h-screen bg-[#0C0A09]">
      <AppNavbar email={embeddingResult.data?.email} activePage="repo" />

      {/* Sub-header */}
      <div className="border-b border-[#1C1917]">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <Link href="/dashboard" className="text-xs text-[#44403C] hover:text-[#A8A29E] transition-colors">← Dashboard</Link>
            <h1 className="text-lg font-semibold text-[#FAFAF9] mt-0.5">{repo.full_name}</h1>
          </div>
          <div className="flex items-center gap-3">
            {repo.index_status === "ready" && (
              <Link
                href={`/repos/${id}/chat`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <ChatIcon />
                Chat with Code
              </Link>
            )}
            <a href={`https://github.com/${repo.full_name}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#A8A29E] hover:text-[#FAFAF9] transition-colors">
              GitHub →
            </a>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-5 sm:px-6 py-8">
        {/* Top section: Status + Info cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Index status — spans 2 cols on desktop */}
          <div className="lg:col-span-2 bg-[#1C1917] border border-[#292524] rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${statusStyle[repo.index_status || "pending"]}`}>
                    {repo.index_status || "pending"}
                  </span>
                  <span className="text-sm text-[#A8A29E]">{fileCount || 0} files indexed</span>
                  {activeProvider?.model && (
                    <span className="px-2 py-0.5 rounded-lg bg-[#292524] border border-[#3F3F46] text-[#E8A87C] text-xs font-mono">
                      {activeProvider.provider} / {activeProvider.model}
                    </span>
                  )}
                </div>
                {repo.indexed_at && (
                  <div className="text-xs text-[#44403C] mt-2">
                    Last indexed: {new Date(repo.indexed_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
              <IndexButton
                repoId={repo.id}
                currentStatus={repo.index_status || "pending"}
                defaultBranch={repo.default_branch || "main"}
                llmProvider={activeProvider?.provider || "ollama"}
                llmModel={activeProvider?.model || undefined}
                llmBaseUrl={activeProvider?.base_url || undefined}
                hasLlmProvider={!!activeProvider}
                hasEmbeddingProvider={embeddingConfigured}
              />
            </div>
          </div>

          {/* Quick info */}
          <div className="bg-[#1C1917] border border-[#292524] rounded-2xl p-6 space-y-4">
            <div>
              <div className="text-[10px] text-[#44403C] uppercase tracking-wider mb-1">Visibility</div>
              <div className="text-sm text-[#FAFAF9] flex items-center gap-1.5">
                {repo.private ? <LockIcon /> : <GlobeIcon />}
                {repo.private ? "Private" : "Public"}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#44403C] uppercase tracking-wider mb-1.5">Languages</div>
              <div className="flex flex-wrap gap-1.5">
                {Array.isArray(repo.languages) && repo.languages.length > 0
                  ? (repo.languages as string[]).map((lang: string) => (
                      <span key={lang} className="px-2 py-0.5 bg-[#292524] border border-[#3F3F46] rounded-md text-xs text-[#A8A29E]">{lang}</span>
                    ))
                  : <span className="text-xs text-[#44403C]">—</span>
                }
              </div>
            </div>
            <div>
              <BranchSelector repoId={repo.id} currentBranch={repo.change_detection_branch || repo.default_branch || "main"} />
            </div>
          </div>
        </div>

        {/* Change Detection Banner */}
        <ChangeBanner repoId={repo.id} initialChanges={(repo.pending_changes as Array<{ path: string; status: string }>) || []} />

        {/* Chat CTA — when indexed */}
        {repo.index_status === "ready" && (
          <div className="relative bg-gradient-to-r from-[#E8A87C]/10 to-[#C9A96E]/5 border border-[#E8A87C]/20 rounded-2xl p-6 mb-6 overflow-hidden">
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#E8A87C] opacity-[0.03] blur-[80px] rounded-full pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[#FAFAF9]">Chat with your codebase</h2>
                <p className="text-sm text-[#A8A29E] mt-1">Ask questions, search code, or request implementations</p>
              </div>
              <Link
                href={`/repos/${id}/chat`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-[#E8A87C]/10 flex-shrink-0"
              >
                <ChatIcon />
                Start Chat
              </Link>
            </div>
          </div>
        )}

        {/* Two-column: Instructions + Platforms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <RepoInstructions repoId={repo.id} initialInstructions={repo.instructions || ""} />
          <PlatformConnect repoId={repo.id} repoFullName={repo.full_name} connections={platformConnections} slackInstalled={slackInstalled} />
        </div>

        {/* Indexed Files */}
        <div className="bg-[#1C1917] border border-[#292524] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#292524] flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#FAFAF9]">Indexed Files</h3>
              <p className="text-xs text-[#44403C] mt-0.5">Browse your codebase with AI-generated summaries</p>
            </div>
            <span className="text-xs text-[#44403C]">{fileCount || 0} files</span>
          </div>

          {files && files.length > 0 ? (
            <FileList files={files} totalCount={fileCount || 0} />
          ) : (
            <div className="px-6 py-12 text-center">
              {repo.index_status === "indexing" ? (
                <div>
                  <div className="w-8 h-8 border-2 border-[#E8A87C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-[#A8A29E]">Indexing in progress...</p>
                  <p className="text-xs text-[#44403C] mt-1">This may take a few minutes depending on repository size.</p>
                </div>
              ) : (
                <p className="text-sm text-[#44403C]">No files indexed yet. Click &quot;Start Indexing&quot; to begin.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ===========================================
// ICONS
// ===========================================

function ChatIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-[#A8A29E]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-[#A8A29E]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}
