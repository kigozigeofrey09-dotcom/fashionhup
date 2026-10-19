import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = process.env.SUPABASE_URL;
export const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env");
}

const serverAuthOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
};

export const supabase = createClient(
  supabaseUrl!,
  supabasePublishableKey!,
  serverAuthOptions
);

export function createAuthenticatedSupabase(accessToken: string) {
  return createClient(supabaseUrl!, supabasePublishableKey!, {
    ...serverAuthOptions,
    global: {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  });
}
