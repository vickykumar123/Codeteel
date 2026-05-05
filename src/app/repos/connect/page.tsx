import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/db/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RepoList } from "./repo-list";
import { AppNavbar } from "../../components/app-navbar";

export default async function ConnectRepoPage() {
  const user = await requireAuth();

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("users")
    .select("github_access_token, email")
    .eq("id", user.id)
    .single();

  if (!profile?.github_access_token) {
    redirect("/api/github/auth");
  }

  const reposResponse = await fetch(
    "https://api.github.com/user/repos?per_page=100&sort=updated",
    {
      headers: {
        Authorization: `Bearer ${profile.github_access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
      next: { revalidate: 60 },
    }
  );

  if (!reposResponse.ok) {
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

  const { data: connectedRepos } = await adminClient
    .from("repositories")
    .select("github_id")
    .eq("user_id", user.id);

  const connectedIds = new Set(connectedRepos?.map((r) => r.github_id) || []);

  return (
    <div className="min-h-screen bg-[#0C0A09]">
      <AppNavbar email={profile.email} activePage="dashboard" />

      {/* Sub-header */}
      <div className="border-b border-[#1C1917]">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-xs text-[#44403C] hover:text-[#A8A29E] transition-colors">
              ← Dashboard
            </Link>
            <h1 className="text-lg font-semibold text-[#FAFAF9] mt-0.5">Add Repository</h1>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-5 sm:px-6 py-8">
        <div className="bg-[#1C1917] border border-[#292524] rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-[#292524]">
            <h2 className="text-base font-semibold text-[#FAFAF9]">Select Repositories</h2>
            <p className="text-sm text-[#A8A29E] mt-1">Choose which repositories Codeteel should have access to</p>
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
