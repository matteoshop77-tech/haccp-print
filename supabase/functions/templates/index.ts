// =============================================================================
// Edge function: GET /templates
// INTEGRATION-PLAN.md section 6.2
//
// Auth: header Authorization: Bearer hcp_…  (validated via _shared/auth.ts)
// Returns the templates assigned to THIS connected app via template_visibility.
// Read-only: only the fields an external app needs to request a print are
// exposed (no user_id, print_count, pinned, last_copies, timestamps).
//
// Deployed with verify_jwt = false: the hcp token is NOT a Supabase JWT.
// =============================================================================

import { corsHeaders, json, createAdminClient, validateToken, AuthError } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const admin = createAdminClient();

  // 1-3. Validate token → account_id + connected_app_id (also bumps last_used_at).
  let ctx;
  try {
    ctx = await validateToken(req.headers.get("Authorization"), admin);
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.message }, e.status);
    return json({ error: "Authentication failed" }, 401);
  }

  // 4. Templates for this account that have a visibility row for this app.
  //    template_visibility is the join; we filter by connected_app_id and read
  //    the embedded template with only the print-relevant columns (5. read-only).
  const { data, error } = await admin
    .from("template_visibility")
    .select(
      "templates:template_id ( id, name, type, category, shelf_life_days, description, allergens, profile )",
    )
    .eq("connected_app_id", ctx.connected_app_id)
    .eq("account_id", ctx.account_id);

  if (error) {
    return json({ error: "Could not load templates" }, 500);
  }

  // Flatten the embedded relation into a plain array of templates.
  const templates = (data ?? [])
    .map((row: { templates: unknown }) => row.templates)
    .filter(Boolean);

  return json(templates, 200);
});
