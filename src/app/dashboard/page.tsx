import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/db/client";
import Link from "next/link";
import { AppNavbar } from "../components/app-navbar";
import { CustomInstructions } from "../settings/custom-instructions";

export default async function DashboardPage() {
  const user = await requireAuth();

  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyClient = supabase as any;
  const [{ data: profile }, { data: repos }, { data: llmProvider }, { data: embeddingCheck }] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase.from("repositories").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    anyClient.from("llm_providers").select("id").eq("user_id", user.id).eq("is_active", true).limit(1),
    supabase.from("users").select("embedding_provider, embedding_api_key").eq("id", user.id).single(),
  ]);

  const isGitHubConnected = !!profile?.github_access_token;
  const hasLlmProvider = (llmProvider || []).length > 0;
  const hasEmbedding = !!(embeddingCheck?.embedding_provider && embeddingCheck?.embedding_api_key);
  const repoCount = repos?.length || 0;
  const totalFiles = repos?.reduce((sum, r) => sum + (r.file_count || 0), 0) || 0;
  const indexedCount = repos?.filter(r => r.index_status === "ready").length || 0;

  return (
    <div className="min-h-screen bg-[#0C0A09]">
      <AppNavbar email={profile?.email} activePage="dashboard" />

      <main className="max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#FAFAF9]">
            {profile?.name ? `Welcome, ${profile.name}` : "Welcome"}
          </h1>
          <p className="text-sm text-[#A8A29E] mt-1">Manage your repositories and start coding with AI</p>
        </div>

        {/* GitHub Connection Banner */}
        {!isGitHubConnected && (
          <div className="mb-8 bg-[#E8A87C]/5 border border-[#E8A87C]/20 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-[#FAFAF9]">Connect GitHub to get started</h3>
                <p className="text-sm text-[#A8A29E] mt-1">Link your GitHub account to add repositories and start building</p>
              </div>
              <a
                href="/api/github/auth"
                className="px-5 py-2.5 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity flex-shrink-0"
              >
                Connect GitHub
              </a>
            </div>
          </div>
        )}

        {/* LLM Provider Warning */}
        {!hasLlmProvider && isGitHubConnected && (
          <div className="mb-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-[#FAFAF9] text-sm">Configure an LLM Provider</h3>
                <p className="text-xs text-[#A8A29E] mt-1">Add an AI model to enable code chat and code generation. Use Ollama for free local models or a cloud provider.</p>
              </div>
              <Link
                href="/settings"
                className="px-4 py-2 bg-[#292524] text-[#FAFAF9] border border-[#3F3F46] font-medium rounded-xl text-xs hover:bg-[#3F3F46] transition-colors flex-shrink-0"
              >
                Go to Settings
              </Link>
            </div>
          </div>
        )}

        {/* Embedding Warning */}
        {!hasEmbedding && isGitHubConnected && hasLlmProvider && (
          <div className="mb-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-[#FAFAF9] text-sm">Configure Embedding Provider</h3>
                <p className="text-xs text-[#A8A29E] mt-1">Required for code indexing and semantic search. Add an embedding API key in Settings.</p>
              </div>
              <Link
                href="/settings"
                className="px-4 py-2 bg-[#292524] text-[#FAFAF9] border border-[#3F3F46] font-medium rounded-xl text-xs hover:bg-[#3F3F46] transition-colors flex-shrink-0"
              >
                Go to Settings
              </Link>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Repositories" value={repoCount} />
          <StatCard label="Indexed" value={indexedCount} accent />
          <StatCard label="Files" value={totalFiles} />
          <StatCard
            label="GitHub"
            value={isGitHubConnected ? "Connected" : "—"}
            dot={isGitHubConnected ? "green" : undefined}
          />
        </div>

        {/* Repositories */}
        <div>
            <div className="bg-[#1C1917] border border-[#292524] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#292524] flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#FAFAF9]">Repositories</h2>
                {isGitHubConnected && (
                  <Link
                    href="/repos/connect"
                    className="px-4 py-1.5 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] font-semibold rounded-lg text-xs hover:opacity-90 transition-opacity"
                  >
                    Add Repo
                  </Link>
                )}
              </div>
              <div className="divide-y divide-[#292524]">
                {repos && repos.length > 0 ? (
                  repos.map((repo) => (
                    <Link
                      key={repo.id}
                      href={`/repos/${repo.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-[#292524]/50 transition-colors group"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#FAFAF9] truncate group-hover:text-[#E8A87C] transition-colors">
                          {repo.full_name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={repo.index_status || "pending"} />
                          <span className="text-xs text-[#44403C]">{repo.file_count || 0} files</span>
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-[#44403C] group-hover:text-[#A8A29E] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  ))
                ) : (
                  <div className="px-6 py-12 text-center">
                    <p className="text-sm text-[#44403C]">
                      {isGitHubConnected ? (
                        <>No repositories yet. <Link href="/repos/connect" className="text-[#E8A87C] hover:text-[#F5D5C3]">Add your first repo</Link></>
                      ) : (
                        "Connect GitHub to add repositories"
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* Custom Instructions — quick access */}
        <div className="mt-6 bg-[#1C1917] border border-[#292524] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#292524] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#292524] rounded-lg flex items-center justify-center text-[#E8A87C]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-[#FAFAF9]">Custom Instructions</h2>
            </div>
            <Link href="/docs/instructions" className="text-xs text-[#44403C] hover:text-[#A8A29E] transition-colors">
              Learn more
            </Link>
          </div>
          <CustomInstructions initialInstructions={profile?.custom_instructions || ""} />
        </div>
      </main>
    </div>
  );
}

// ===========================================
// COMPONENTS
// ===========================================

function StatCard({ label, value, accent, dot }: { label: string; value: string | number; accent?: boolean; dot?: "green" }) {
  return (
    <div className="bg-[#1C1917] border border-[#292524] rounded-2xl p-5">
      {dot ? (
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-2 h-2 rounded-full ${dot === "green" ? "bg-green-500" : "bg-[#44403C]"}`} />
          <span className="text-lg font-bold text-[#FAFAF9]">{value}</span>
        </div>
      ) : (
        <div className={`text-2xl font-bold ${accent ? "bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] bg-clip-text text-transparent" : "text-[#FAFAF9]"}`}>
          {value}
        </div>
      )}
      <div className="text-xs text-[#A8A29E] mt-0.5">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ready: "bg-green-500/10 text-green-400 border-green-500/20",
    indexing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    pending: "bg-[#292524] text-[#A8A29E] border-[#3F3F46]",
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-md border ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}
