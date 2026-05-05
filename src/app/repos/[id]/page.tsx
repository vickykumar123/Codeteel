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

  // Get repository + user's active LLM provider + embedding config in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyClient = adminClient as any;
  const [repoResult, providerResult, embeddingResult] = await Promise.all([
    adminClient
      .from("repositories")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    anyClient
      .from("llm_providers")
      .select("provider, base_url, model")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single(),
    adminClient
      .from("users")
      .select("embedding_provider, embedding_api_key")
      .eq("id", user.id)
      .single(),
  ]);

  const { data: repo, error } = repoResult;
  const { data: activeProvider } = providerResult;
  const embeddingConfigured = !!(embeddingResult.data?.embedding_provider && embeddingResult.data?.embedding_api_key);

  if (error || !repo) {
    notFound();
  }

  // Fetch platform connections and Slack installation for this repo
  const [connectionResult, slackResult] = await Promise.all([
    anyClient
      .from("platform_connections")
      .select("id, platform, platform_channel_id, platform_team_id")
      .eq("repo_id", id)
      .eq("user_id", user.id),
    anyClient
      .from("slack_installations")
      .select("team_id, team_name, bot_token")
      .eq("user_id", user.id),
  ]);

  const platformConnections = connectionResult.data || [];
  const slackInstalled = (slackResult.data || []).length > 0;

  // Get indexed files count
  const { count: fileCount } = await adminClient
    .from("file_summaries")
    .select("*", { count: "exact", head: true })
    .eq("repo_id", id);

  // Get sample of indexed files
  const { data: files } = await adminClient
    .from("file_summaries")
    .select("id, path, language, size, summary")
    .eq("repo_id", id)
    .order("path")
    .limit(20);

  return (
    <div className="min-h-screen bg-[#0C0A09]">
      <AppNavbar activePage="repo" />

      {/* Repo sub-header */}
      <div className="border-b border-[#1C1917]">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <Link href="/dashboard" className="text-xs text-[#44403C] hover:text-[#A8A29E] transition-colors">
              ← Dashboard
            </Link>
            <h1 className="text-lg font-semibold text-[#FAFAF9] mt-0.5">{repo.full_name}</h1>
          </div>
          <div className="flex items-center gap-3">
            {repo.index_status === "ready" && (
              <Link
                href={`/repos/${id}/chat`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Chat with Code
              </Link>
            )}
            <a
              href={`https://github.com/${repo.full_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#A8A29E] hover:text-[#FAFAF9] transition-colors"
            >
              GitHub →
            </a>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Index Status
              </h2>
              <div className="flex items-center gap-3 mt-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    repo.index_status === "ready"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : repo.index_status === "indexing"
                      ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                      : repo.index_status === "failed"
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {repo.index_status}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {fileCount || 0} files indexed
                </span>
                {activeProvider?.model && (
                  <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-mono">
                    {activeProvider.model}
                  </span>
                )}
                {repo.indexed_at && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Last indexed:{" "}
                    {new Date(repo.indexed_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
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

        {/* Change Detection Banner */}
        <ChangeBanner
          repoId={repo.id}
          initialChanges={(repo.pending_changes as Array<{ path: string; status: string }>) || []}
        />

        {/* Repo Instructions */}
        <RepoInstructions
          repoId={repo.id}
          initialInstructions={repo.instructions || ""}
        />

        {/* Chat Card - Show when indexed */}
        {repo.index_status === "ready" && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <h2 className="text-lg font-semibold">
                  Chat with your codebase
                </h2>
                <p className="text-blue-100 mt-1">
                  Ask questions, search code, or request implementations
                </p>
              </div>
              <Link
                href={`/repos/${id}/chat`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                Start Chat
              </Link>
            </div>
          </div>
        )}

        {/* Platform Connections */}
        <PlatformConnect
          repoId={repo.id}
          repoFullName={repo.full_name}
          connections={platformConnections}
          slackInstalled={slackInstalled}
        />

        {/* Repository Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <BranchSelector
              repoId={repo.id}
              currentBranch={repo.change_detection_branch || repo.default_branch || "main"}
            />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Visibility
            </div>
            <div className="text-lg font-medium text-gray-900 dark:text-white mt-1">
              {repo.private ? "Private" : "Public"}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Languages
            </div>
            <div className="text-lg font-medium text-gray-900 dark:text-white mt-1">
              {Array.isArray(repo.languages) && repo.languages.length > 0
                ? repo.languages.join(", ")
                : "—"}
            </div>
          </div>
        </div>

        {/* Indexed Files */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Indexed Files
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Files analyzed and ready for semantic search
            </p>
          </div>

          {files && files.length > 0 ? (
            <FileList files={files} totalCount={fileCount || 0} />
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {repo.index_status === "indexing" ? (
                <div>
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p>Indexing in progress...</p>
                  <p className="text-sm mt-2">
                    This may take a few minutes depending on repository size.
                  </p>
                </div>
              ) : (
                <p>
                  No files indexed yet. Click "Start Indexing" to begin.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
