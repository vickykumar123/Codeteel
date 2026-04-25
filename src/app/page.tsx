import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";

export default async function Home() {
  const user = await getCurrentUser();

  // If logged in, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
          CodeBot
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
          AI coding agent that understands your codebase, takes requests via Slack/Telegram, and creates PRs with plan approval.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 font-medium"
          >
            Create Account
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Connect Repos
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Link your GitHub repositories. CodeBot indexes and understands your codebase.
            </p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Request via Chat
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Send coding requests through Slack or Telegram. Get a plan for approval.
            </p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Get PRs
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Approve the plan, CodeBot writes the code and creates a pull request.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
