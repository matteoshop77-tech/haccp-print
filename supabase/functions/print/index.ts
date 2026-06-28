// =============================================================================
// Edge function: POST /print
// INTEGRATION-PLAN.md section 6.3
//
// Auth: header Authorization: Bearer hcp_…  (validated via _shared/auth.ts)
// Enqueues a print job into print_queue. The desktop listener (M4) processes it.
//
// ⚠️ Re-verifies authorization server-side: the template_id MUST be visible to
// THIS connected app. We never trust that the client obtained it from /templates
// (otherwise an app could print any template by guessing the UUID). (step 3)
//
// Idempotent: the same idempotency_key for the same account returns the existing
// job instead of creating a duplicate (UNIQUE (account_id, idempotency_key)).
// =============================================================================

import { corsHeaders, json, createAdminClient, validateToken, AuthError } from "../_shared/auth.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const admin = createAdminClient();

  // 1-2. Validate token → account_id + connected_app_id + org_name (bumps last_used_at).
  let ctx;
  try {
    ctx = await validateToken(req.headers.get("Authorization"), admin);
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.message }, e.status);
    return json({ error: "Authentication failed" }, 401);
  }

  // 0. Parse + validate body.
  let body: {
    template_id?: string;
    copies?: number;
    prepared_date?: string | null;
    idempotency_key?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const templateId = body.template_id?.trim();
  const copies = body.copies;
  const preparedDate = body.prepared_date?.trim() || null;
  const idempotencyKey = body.idempotency_key?.trim();

  if (!templateId || !UUID_RE.test(templateId)) {
    return json({ error: "Invalid or missing template_id (must be a UUID)" }, 400);
  }
  if (typeof copies !== "number" || !Number.isInteger(copies) || copies < 1 || copies > 200) {
    return json({ error: "Invalid copies (must be an integer 1–200)" }, 400);
  }
  if (!idempotencyKey) {
    return json({ error: "Missing idempotency_key" }, 400);
  }
  if (preparedDate && !DATE_RE.test(preparedDate)) {
    return json({ error: "Invalid prepared_date (must be YYYY-MM-DD)" }, 400);
  }

  // 3. ⚠️ RE-VERIFY AUTHORIZATION: the template must be visible to THIS app.
  const { data: vis, error: visError } = await admin
    .from("template_visibility")
    .select("template_id")
    .eq("template_id", templateId)
    .eq("connected_app_id", ctx.connected_app_id)
    .maybeSingle();

  if (visError) {
    return json({ error: "Internal error checking authorization" }, 500);
  }
  if (!vis) {
    return json({ error: "Template not found or not visible to this app" }, 403);
  }

  // 4. INSERT into print_queue. org_name is a snapshot (survives revoke/rename).
  const { data: inserted, error: insertError } = await admin
    .from("print_queue")
    .insert({
      account_id: ctx.account_id,
      connected_app_id: ctx.connected_app_id,
      org_name: ctx.org_name,
      template_id: templateId,
      copies,
      prepared_date: preparedDate,
      idempotency_key: idempotencyKey,
      status: "pending",
    })
    .select("id, status")
    .single();

  if (insertError) {
    // Idempotency: a retry with the same (account_id, idempotency_key) hits the
    // unique index → return the EXISTING job instead of creating a duplicate.
    if (insertError.code === "23505") {
      const { data: existing, error: existingError } = await admin
        .from("print_queue")
        .select("id, status")
        .eq("account_id", ctx.account_id)
        .eq("idempotency_key", idempotencyKey)
        .single();

      if (existingError || !existing) {
        return json({ error: "Could not resolve idempotent job" }, 500);
      }
      return json({ job_id: existing.id, status: existing.status }, 200);
    }
    return json({ error: "Could not enqueue print job" }, 500);
  }

  // 5. Job enqueued.
  return json({ job_id: inserted.id, status: inserted.status }, 201);
});
