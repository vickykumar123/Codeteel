import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/db/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RepoList } from "./repo-list";

export default async function ConnectRepoPage() {
  const user = await requireAuth();

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("users")
    .select("github_access_token")
    .eq("id", user.id)
    .single();

  // If no GitHub token, redirect to connect
  if (!profile?.github_access_token) {
    redirect("/api/github/auth");
  }

  // Fetch repos from GitHub
  const reposResponse = await fetch(
    "https://api.github.com/user/repos?per_page=100&sort=updated",
    {
      headers: {
        Authorization: `Bearer ${profile.github_access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
      next: { revalidate: 60 }, // Cache for 1 minute
    }
  );

  if (!reposResponse.ok) {
    // Token might be invalid, clear it
    if (reposResponse.status === 401) {
      await adminClient
        .from("users")
        .update({ github_access_token: null, github_id: null })
        .eq("id", user.id);
      redirect("/api/github/auth");
    }
    throw new Error("Failed to fetch repositories");
  }

  const repos = await reposResponse.json();

  // Get already connected repos
  const { data: connectedRepos } = await adminClient
    .from("repositories")
    .select("github_id")
    .eq("user_id", user.id);

  const connectedIds = new Set(connectedRepos?.map((r) => r.github_id) || []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Connect Repository
          </h1>
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Select Repositories
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Choose which repositories CodeBot should have access to
            </p>
          </div>

          <RepoList
            repos={repos}
            connectedIds={Array.from(connectedIds)}
            userId={user.id}
          />
        </div>
      </main>
    </div>
  );
}
