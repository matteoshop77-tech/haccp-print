import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase env vars: assicurati che .env contenga " +
    "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Vedi .env.example."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: "haccprint-auth",
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});