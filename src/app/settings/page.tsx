import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/db/client";
import { LLMSettings } from "./llm-settings";
import { CustomInstructions } from "./custom-instructions";
import { Integrations } from "./integrations";
import { AppNavbar } from "../components/app-navbar";
import { SettingsLayout } from "./settings-layout";

export default async function SettingsPage() {
  const user = await requireAuth();

  const adminClient = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyClient = adminClient as any;

  const [providersResult, platformProvidersResult, profileResult, slackResult] = await Promise.all([
    anyClient
      .from("llm_providers")
      .select("id, provider, api_key, base_url, model, is_active")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    anyClient
      .from("platform_llm_providers")
      .select("id, provider, api_key, base_url, model, is_active")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    adminClient
      .from("users")
      .select("email, embedding_provider, embedding_api_key, embedding_model, custom_instructions")
      .eq("id", user.id)
      .single(),
    anyClient
      .from("slack_installations")
      .select("id, team_id, team_name, installed_at")
      .eq("user_id", user.id),
  ]);

  const providers = (providersResult.data || []).map((p: Record<string, unknown>) => ({
    ...p,
    api_key: p.api_key ? "••••••••••••" : "",
  }));
  const platformProviders = (platformProvidersResult.data || []).map((p: Record<string, unknown>) => ({
    ...p,
    api_key: p.api_key ? "••••••••••••" : "",
  }));
  const profile = profileResult.data;
  const slackInstallations = slackResult.data || [];

  return (
    <div className="min-h-screen bg-[#0C0A09]">
      <AppNavbar email={profile?.email} activePage="settings" />

      <SettingsLayout>
        {/* LLM Configuration (contains #llm, #platform-llm, #embedding sections internally) */}
        <section id="llm" className="scroll-mt-24">
          <SectionHeader
            title="AI Models"
            description="Configure LLM providers for web, platforms, and embeddings."
            icon={<BoltIcon />}
          />
          <div className="bg-[#1C1917] border border-[#292524] rounded-2xl overflow-hidden">
            <LLMSettings
              initialProviders={providers}
              initialPlatformProviders={platformProviders}
              initialEmbeddingProvider={profile?.embedding_provider || "openai"}
              initialEmbeddingApiKey={profile?.embedding_api_key || ""}
              initialEmbeddingModel={profile?.embedding_model || ""}
            />
          </div>
        </section>

        {/* Custom Instructions */}
        <section id="instructions" className="scroll-mt-24">
          <SectionHeader
            title="Custom Instructions"
            description="Define your coding style and preferences. Applied to every agent interaction."
            icon={<PenIcon />}
          />
          <div className="bg-[#1C1917] border border-[#292524] rounded-2xl overflow-hidden">
            <CustomInstructions
              initialInstructions={profile?.custom_instructions || ""}
            />
          </div>
        </section>

        {/* Integrations */}
        <section id="integrations" className="scroll-mt-24">
          <SectionHeader
            title="Integrations"
            description="Connect messaging platforms to interact with your repos via chat."
            icon={<LinkIcon />}
          />
          <div className="bg-[#1C1917] border border-[#292524] rounded-2xl overflow-hidden">
            <Integrations
              slackInstallations={slackInstallations}
            />
          </div>
        </section>
      </SettingsLayout>
    </div>
  );
}

// ===========================================
// SECTION HEADER
// ===========================================

function SectionHeader({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-9 h-9 bg-[#292524] rounded-xl flex items-center justify-center text-[#E8A87C] flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-[#FAFAF9]">{title}</h2>
        <p className="text-xs text-[#A8A29E] mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ===========================================
// ICONS
// ===========================================

function BoltIcon() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}
