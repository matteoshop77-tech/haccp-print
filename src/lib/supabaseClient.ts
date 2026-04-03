import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fqgsmnubfufyeoupxtgn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_HqlftCz9lVhIf1YLyCVdsA_fuFFFKxF";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);