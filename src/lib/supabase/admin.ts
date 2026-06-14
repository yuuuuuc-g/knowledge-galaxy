import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/src/lib/database.types";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL ?? getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? getRequiredEnv("SUPABASE_KEY");

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
