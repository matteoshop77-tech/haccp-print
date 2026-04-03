import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fqgsmnubfufyeoupxtgn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxZ3NtbnViZnVmeWVvdXB4dGduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDg2NTUsImV4cCI6MjA5MDc4NDY1NX0.pzMRXUMd2ETsiF2cH8ioC2M3SV_3b0Gc333FKFwBkAY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: "haccprint-auth",
    storage: {
      getItem: (key) => {
        try { return localStorage.getItem(key); } catch { return null; }
      },
      setItem: (key, value) => {
        try { localStorage.setItem(key, value); } catch {}
      },
      removeItem: (key) => {
        try { localStorage.removeItem(key); } catch {}
      },
    },
  },
});