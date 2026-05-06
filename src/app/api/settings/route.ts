import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/client";
import { createServerSupabaseClient } from "@/lib/db/server";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const VALID_LLM_PROVIDERS = ["ollama", "openai", "claude", "gemini", "grok", "qwen", "fireworks", "together"];
const VALID_PLATFORM_PROVIDERS = ["openai", "claude", "gemini", "grok", "qwen", "fireworks", "together"]; // no ollama
const VALID_EMBEDDING_PROVIDERS = ["openai", "gemini", "mistral", "voyage", "cohere"];

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient: AnyClient = createAdminClient();

  // Fetch LLM providers
  const { data: providers, error: provError } = await adminClient
    .from("llm_providers")
    .select("id, provider, api_key, base_url, model, is_active")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (provError) {
    return NextResponse.json({ error: provError.message }, { status: 500 });
  }

  // Mask API keys in response
  const maskedProviders = (providers || []).map((p: Record<string, unknown>) => ({
    ...p,
    api_key: p.api_key ? String(p.api_key).slice(0, 7) + "..." : null,
  }));

  // Fetch embedding settings (still on users table)
  const { data: profile, error: profileError } = await adminClient
    .from("users")
    .select("embedding_provider, embedding_api_key, embedding_model")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Mask embedding API key
  if (profile?.embedding_api_key) {
    profile.embedding_api_key = profile.embedding_api_key.slice(0, 7) + "...";
  }

  // Fetch platform LLM providers
  const { data: platformProviders } = await adminClient
    .from("platform_llm_providers")
    .select("id, provider, api_key, base_url, model, is_active")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const maskedPlatformProviders = (platformProviders || []).map((p: Record<string, unknown>) => ({
    ...p,
    api_key: p.api_key ? String(p.api_key).slice(0, 7) + "..." : null,
  }));

  return NextResponse.json({
    settings: {
      embedding_provider: profile?.embedding_provider,
      embedding_api_key: profile?.embedding_api_key,
      embedding_model: profile?.embedding_model,
    },
    llmProviders: maskedProviders,
    platformProviders: maskedPlatformProviders,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const adminClient: AnyClient = createAdminClient();

  // Handle LLM provider upsert
  if (body.llm_provider) {
    const { provider, api_key, base_url, model, is_active } = body.llm_provider;

    if (!VALID_LLM_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: "Invalid LLM provider" }, { status: 400 });
    }
    if (!model) {
      return NextResponse.json({ error: "Model is required" }, { status: 400 });
    }
    if (!base_url) {
      return NextResponse.json({ error: "Base URL is required" }, { status: 400 });
    }

    // Encrypt API key if provided and not already masked
    let encryptedKey = null;
    if (api_key && !api_key.includes("...")) {
      encryptedKey = encrypt(api_key);
    } else if (api_key && api_key.includes("...")) {
      // Masked key — fetch existing encrypted key from DB
      const { data: existing } = await adminClient
        .from("llm_providers")
        .select("api_key")
        .eq("user_id", user.id)
        .eq("provider", provider)
        .single();
      encryptedKey = existing?.api_key || null;
    }

    // Upsert without is_active first (avoids trigger conflict)
    const { error } = await adminClient
      .from("llm_providers")
      .upsert(
        {
          user_id: user.id,
          provider,
          api_key: encryptedKey,
          base_url,
          model,
          is_active: false,
        },
        { onConflict: "user_id,provider" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Set active separately (trigger handles deactivating others)
    if (is_active) {
      await adminClient
        .from("llm_providers")
        .update({ is_active: true })
        .eq("user_id", user.id)
        .eq("provider", provider);
    }
  }

  // Handle setting active provider
  if (body.set_active_provider) {
    const { provider } = body.set_active_provider;

    // The DB trigger handles deactivating others
    const { error } = await adminClient
      .from("llm_providers")
      .update({ is_active: true })
      .eq("user_id", user.id)
      .eq("provider", provider);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Handle deleting a provider
  if (body.delete_provider) {
    const { provider } = body.delete_provider;

    const { error } = await adminClient
      .from("llm_providers")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Handle platform LLM provider upsert
  if (body.platform_provider) {
    const { provider, api_key, base_url, model, is_active } = body.platform_provider;

    if (!VALID_PLATFORM_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: "Invalid platform provider. Ollama is not supported for platform integrations." }, { status: 400 });
    }
    if (!model) {
      return NextResponse.json({ error: "Model is required" }, { status: 400 });
    }
    if (!base_url) {
      return NextResponse.json({ error: "Base URL is required" }, { status: 400 });
    }

    let encryptedKey = null;
    if (api_key && !api_key.includes("...")) {
      encryptedKey = encrypt(api_key);
    } else if (api_key && api_key.includes("...")) {
      const { data: existing } = await adminClient
        .from("platform_llm_providers")
        .select("api_key")
        .eq("user_id", user.id)
        .eq("provider", provider)
        .single();
      encryptedKey = existing?.api_key || null;
    }

    if (!encryptedKey) {
      return NextResponse.json({ error: "API key is required for platform providers" }, { status: 400 });
    }

    // Upsert without is_active first (avoids trigger conflict)
    const { error } = await adminClient
      .from("platform_llm_providers")
      .upsert(
        {
          user_id: user.id,
          provider,
          api_key: encryptedKey,
          base_url,
          model,
          is_active: false,
        },
        { onConflict: "user_id,provider" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Set active separately (trigger handles deactivating others)
    if (is_active) {
      await adminClient
        .from("platform_llm_providers")
        .update({ is_active: true })
        .eq("user_id", user.id)
        .eq("provider", provider);
    }
  }

  // Handle setting active platform provider
  if (body.set_active_platform_provider) {
    const { provider } = body.set_active_platform_provider;

    const { error } = await adminClient
      .from("platform_llm_providers")
      .update({ is_active: true })
      .eq("user_id", user.id)
      .eq("provider", provider);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Handle deleting a platform provider
  if (body.delete_platform_provider) {
    const { provider } = body.delete_platform_provider;

    const { error } = await adminClient
      .from("platform_llm_providers")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Handle embedding settings (still on users table)
  if (body.embedding) {
    const { embedding_provider, embedding_api_key, embedding_model } = body.embedding;

    if (embedding_provider && !VALID_EMBEDDING_PROVIDERS.includes(embedding_provider)) {
      return NextResponse.json({ error: "Invalid embedding provider" }, { status: 400 });
    }

    const updates: Record<string, string | null> = {};
    if (embedding_provider !== undefined) updates.embedding_provider = embedding_provider;
    if (embedding_model !== undefined) updates.embedding_model = embedding_model;
    if (embedding_api_key && !embedding_api_key.includes("...")) {
      updates.embedding_api_key = embedding_api_key;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await adminClient
        .from("users")
        .update(updates)
        .eq("id", user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}
