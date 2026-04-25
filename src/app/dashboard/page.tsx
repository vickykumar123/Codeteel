import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/db/client";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireAuth();

  const supabase = createAdminClient();

  // Get user profile
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  // Get user's repositories
  const { data: repos } = await supabase
    .from("repositories")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Get recent tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const isGitHubConnected = !!profile?.github_access_token;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            CodeBot
          </h1>
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Settings
            </Link>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {profile?.email}
            </span>
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm text-red-600 hover:text-red-500"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome{profile?.name ? `, ${profile.name}` : ""}!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your repositories and coding tasks
          </p>
        </div>

        {/* GitHub Connection Banner */}
        {!isGitHubConnected && (
          <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  Connect GitHub
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Connect your GitHub account to start adding repositories
                </p>
              </div>
              <a
                href="/api/github/auth"
                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 text-sm font-medium"
              >
                Connect GitHub
              </a>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {repos?.length || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Repositories
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {tasks?.length || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Tasks
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isGitHubConnected ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              <span className="text-lg font-medium text-gray-900 dark:text-white">
                {isGitHubConnected ? "Connected" : "Not Connected"}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              GitHub
            </div>
          </div>
        </div>

        {/* Repositories Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Repositories
            </h3>
            {isGitHubConnected && (
              <Link
                href="/repos/connect"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Add Repository
              </Link>
            )}
          </div>
          <div className="p-6">
            {repos && repos.length > 0 ? (
              <ul className="space-y-4">
                {repos.map((repo) => (
                  <li
                    key={repo.id}
                    className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {repo.full_name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            repo.index_status === "ready"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                              : repo.index_status === "indexing"
                              ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                              : repo.index_status === "failed"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                              : "bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {repo.index_status}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {repo.file_count || 0} files
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/repos/${repo.id}`}
                      className="text-blue-600 hover:text-blue-500 text-sm"
                    >
                      View →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                {isGitHubConnected ? (
                  <>
                    No repositories connected yet.{" "}
                    <Link href="/repos/connect" className="text-blue-600">
                      Connect your first repo
                    </Link>
                  </>
                ) : (
                  "Connect GitHub to add repositories"
                )}
              </p>
            )}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Tasks
            </h3>
          </div>
          <div className="p-6">
            {tasks && tasks.length > 0 ? (
              <ul className="space-y-4">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {task.request_text.slice(0, 60)}
                        {task.request_text.length > 60 ? "..." : ""}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {task.execution_status} · {task.source}
                      </div>
                    </div>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-blue-600 hover:text-blue-500 text-sm"
                    >
                      View →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No tasks yet. Connect a repository and start making requests!
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
