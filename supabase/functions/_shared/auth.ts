// =============================================================================
// Shared helpers for HACCPrint edge functions (INTEGRATION-PLAN.md sections 6, 7).
//
// Auth model: "RLS = owner; edge function = outside world." (plan section 4)
// External apps authenticate with an opaque token (hcp_live_…) in the
// Authorization header. We store only its SHA-256 hash; validation is a hash
// lookup against connected_apps, scoped to active (revoked_at IS NULL) rows.
// =============================================================================

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ⚠️ TODO M5: tighten CORS to a strict allowlist of Planivo (and future app)
// origins. For M1/M2 development we accept any origin to unblock integration.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// JSON response with CORS headers attached.
export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Typed error so call sites can map a thrown failure to an HTTP status.
export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

// SHA-256(input) as lowercase hex. No external libraries (crypto.subtle).
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// service_role client for all DB work (bypasses RLS by design).
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TokenContext {
  account_id: string;
  connected_app_id: string;
  org_name: string;
}

// Validate the "Authorization: Bearer hcp_live_…" header against connected_apps.
// On success: updates last_used_at and returns the token context.
// On failure: throws AuthError (401 invalid/revoked/missing, 500 internal).
//
// ⚠️ TODO M5: add per-token rate limiting (the token is the only secret guarding
// /templates and /print; throttle to contain abuse if a token leaks).
export async function validateToken(
  authHeader: string | null,
  admin: SupabaseClient,
): Promise<TokenContext> {
  if (!authHeader) {
    throw new AuthError("Missing Authorization header");
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("hcp_live_")) {
    throw new AuthError("Invalid token format");
  }

  const tokenHash = await sha256Hex(token);

  const { data, error } = await admin
    .from("connected_apps")
    .select("id, account_id, org_name")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    throw new AuthError("Internal error validating token", 500);
  }
  if (!data) {
    throw new AuthError("Invalid or revoked token", 401);
  }

  // Touch last_used_at so the owner can spot anomalies in the Settings UI.
  await admin
    .from("connected_apps")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    account_id: data.account_id,
    connected_app_id: data.id,
    org_name: data.org_name,
  };
}
