import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function supabaseUrl() {
  return process.env.SUPABASE_URL?.trim() || "";
}

export function supabaseServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    ""
  );
}

export function supabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseServiceRoleKey());
}

export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured()) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (client === undefined) {
    client = createClient(supabaseUrl(), supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client!;
}

export async function pingSupabase() {
  if (!supabaseConfigured()) return false;
  const { error } = await getSupabase().from("vantage_users").select("id").limit(1);
  return !error;
}

