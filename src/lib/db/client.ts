import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Singleton for browser client
let browserClient: ReturnType<typeof createSupabaseBrowserClient<Database>> | null = null;

// Client-side Supabase client (singleton for "use client" components)
export function createBrowserClient() {
  if (browserClient) return browserClient;

  browserClient = createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return browserClient;
}

// Admin client with service role (bypasses RLS) - server only
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
