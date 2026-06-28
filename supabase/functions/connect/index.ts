// =============================================================================
// Edge function: POST /connect
// INTEGRATION-PLAN.md section 6.1
//
// Public auth endpoint: an external app (e.g. Planivo HUB) connects to a
// HACCPrint account with email+password, declares its org_name, and receives
// a raw token ONCE. We store only the SHA-256 hash + a prefix for the UI.
//
// Deployed with verify_jwt = false: external apps do NOT have a HACCPrint JWT.
// Authentication is custom (email+password) inside the function body.
// =============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json, sha256Hex, createAdminClient } from "../_shared/auth.ts";

// ⚠️ TODO M5: add rate limiting (per IP + per email, lockout after N failures).
// This is a public auth endpoint → brute-force / credential-stuffing target.
// Skipped in M1/M2 on purpose; added with the rest of the polish in M5.

const TOKEN_PREFIX = "hcp_live_";
const TOKEN_PREFIX_LEN = 16; // chars of the raw token kept for the UI (token_prefix)

// Random opaque token: "hcp_live_" + 64 hex chars (32 random bytes).
function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return TOKEN_PREFIX + hex;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 0. Parse body
  let body: { email?: string; password?: string; org_name?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = body.email?.trim();
  const password = body.password;
  const org_name = body.org_name?.trim();

  if (!email || !password || !org_name) {
    return json(
      { error: "Missing required fields: email, password, org_name" },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1. Validate credentials with an anon client (no session persistence).
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInError } =
    await authClient.auth.signInWithPassword({ email, password });

  if (signInError || !signIn.user) {
    return json({ error: "Invalid email or password" }, 401);
  }
  const accountId = signIn.user.id;

  // service_role client for all DB work (bypasses RLS by design).
  const admin = createAdminClient();

  // 2. org_name must be unique among ACTIVE connections for this account
  //    (product decision #2 / partial unique index). We check explicitly to
  //    return a clean 409 instead of relying only on the DB constraint.
  const { data: existing, error: existingError } = await admin
    .from("connected_apps")
    .select("id")
    .eq("account_id", accountId)
    .eq("org_name", org_name)
    .is("revoked_at", null)
    .maybeSingle();

  if (existingError) {
    return json({ error: "Internal error checking existing connection" }, 500);
  }
  if (existing) {
    return json(
      {
        error:
          "A connection with this name already exists. Revoke the previous one to reconnect.",
      },
      409,
    );
  }

  // 3-4. Generate raw token, hash it, derive the UI prefix.
  const rawToken = generateRawToken();
  const tokenHash = await sha256Hex(rawToken);
  const tokenPrefix = rawToken.slice(0, TOKEN_PREFIX_LEN);

  // 5. INSERT the connection (service_role bypasses RLS).
  const { error: insertError } = await admin.from("connected_apps").insert({
    account_id: accountId,
    org_name,
    token_hash: tokenHash,
    token_prefix: tokenPrefix,
  });

  if (insertError) {
    // Unique-violation safety net if a race slipped past the check above.
    if (insertError.code === "23505") {
      return json(
        {
          error:
            "A connection with this name already exists. Revoke the previous one to reconnect.",
        },
        409,
      );
    }
    return json({ error: "Could not create connection" }, 500);
  }

  // 6. Return the RAW token ONCE. It is never retrievable again.
  return json({ token: rawToken, org_name }, 200);
});
