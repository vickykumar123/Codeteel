import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/db/client";
import Link from "next/link";
import { LLMSettings } from "./llm-settings";
import { CustomInstructions } from "./custom-instructions";

export default async function SettingsPage() {
  const user = await requireAuth();

  const adminClient = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyClient = adminClient as any;

  // Fetch LLM providers and embedding settings in parallel
  const [providersResult, profileResult] = await Promise.all([
    anyClient
      .from("llm_providers")
      .select("id, provider, api_key, base_url, model, is_active")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    adminClient
      .from("users")
      .select("embedding_provider, embedding_api_key, embedding_model, custom_instructions")
      .eq("id", user.id)
      .single(),
  ]);

  const providers = (providersResult.data || []).map((p: Record<string, unknown>) => ({
    ...p,
    api_key: p.api_key ? String(p.api_key).slice(0, 7) + "..." : "",
  }));
  const profile = profileResult.data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Settings
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
              LLM Configuration
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure which AI model to use for code analysis and generation
            </p>
          </div>

          <LLMSettings
            initialProviders={providers}
            initialEmbeddingProvider={profile?.embedding_provider || "openai"}
            initialEmbeddingApiKey={profile?.embedding_api_key || ""}
            initialEmbeddingModel={profile?.embedding_model || ""}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mt-8">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Custom Instructions
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Define your coding style and preferences. These are injected into every agent prompt.
            </p>
          </div>

          <CustomInstructions
            initialInstructions={profile?.custom_instructions || ""}
          />
        </div>
      </main>
    </div>
  );
}
