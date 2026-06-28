// =============================================================================
// Desktop print-queue listener (INTEGRATION-PLAN.md section 8, milestone M4).
//
// Listens to print_queue via Supabase Realtime, catches up on pending jobs at
// startup, claims each job atomically (multi-instance safe), renders headless
// and prints physically on the Brother QL-800, then logs the print into
// print_jobs with source='api' for HACCP compliance.
//
// ⚠️ R1 — GDI pipeline is reused, NEVER modified. We call the existing
// printLabel() from printService.ts (which encapsulates renderLabelToPNG +
// calcLabelHeightMM + invoke print_label_image). No rendering code is touched
// or duplicated here.
//
// ⚠️ Constraint #6 (section 3) — no Supabase queries inside the Realtime
// callback. The callback only enqueues an id and triggers an async drain loop
// that runs OUTSIDE the callback. This avoids reintroducing the auth/realtime
// deadlock fought in commit cae959b.
//
// Runs only in the Tauri desktop build (no printer in the browser).
// =============================================================================

import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/store/useStore";
import { printLabel, calcExpiryDate } from "@/lib/printService";
import type { LabelTemplate, LabelType, IndustryProfile } from "@/lib/types";
import { format } from "date-fns";

// A row of print_queue as returned by the claim (RETURNING *).
interface PrintQueueRow {
  id: string;
  account_id: string;
  connected_app_id: string | null;
  org_name: string;
  template_id: string;
  copies: number;
  prepared_date: string | null;
  idempotency_key: string;
  status: string;
  claimed_by: string | null;
  error: string | null;
  created_at: string;
  printed_at: string | null;
}

// Raw templates row (snake_case) for the DB fallback lookup.
interface TemplateRow {
  id: string;
  name: string;
  type: LabelType;
  category: string;
  description: string | null;
  shelf_life_days: number;
  allergens: string | null;
  profile: IndustryProfile;
  pinned: boolean;
  print_count: number;
  created_at: string;
  updated_at: string;
  last_copies: number | null;
}

// True only in the Tauri desktop build (v2 marker). In the browser there is no
// printer, so the listener is inert (same criterion as printService's fallback).
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Mirror of the store's snake_case → camelCase template mapping (useStore.ts).
// Used only when a job references a template not present in the loaded store.
function rowToTemplate(r: TemplateRow): LabelTemplate {
  return {
    id:            r.id,
    name:          r.name,
    type:          r.type,
    category:      r.category,
    description:   r.description ?? null,
    shelfLifeDays: r.shelf_life_days,
    allergens:     r.allergens ?? null,
    profile:       r.profile,
    pinned:        r.pinned,
    printCount:    r.print_count,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
    lastCopies:    r.last_copies ?? 1,
  };
}

// Parse a "YYYY-MM-DD" date as LOCAL midnight (avoids the UTC off-by-one that
// `new Date("2026-06-28")` would cause in negative-offset timezones).
function parsePreparedDate(s: string | null): Date {
  if (!s) return new Date();
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function startPrintQueueListener(userId: string): () => void {
  if (!isTauri()) {
    console.log("[printQueueListener] not a Tauri build — listener inert (no printer).");
    return () => {};
  }

  // Unique id for this desktop instance — written to claimed_by on the atomic
  // claim so we can tell which instance owns a job (multi-instance safety).
  const instanceId = crypto.randomUUID();
  console.log("[printQueueListener] starting, instance:", instanceId, "user:", userId);

  const queue: string[] = [];
  const seen = new Set<string>(); // de-dupe enqueue across catch-up + realtime
  let draining = false;
  let stopped = false;

  function enqueue(jobId: string): void {
    if (seen.has(jobId)) return;
    seen.add(jobId);
    queue.push(jobId);
    void drainQueue();
  }

  // Atomically claim a pending job. Only the instance that gets the row back
  // proceeds; a concurrent instance (or a double Realtime delivery) sees 0 rows.
  async function claim(jobId: string): Promise<PrintQueueRow | null> {
    const { data, error } = await supabase
      .from("print_queue")
      .update({ status: "printing", claimed_by: instanceId })
      .eq("id", jobId)
      .eq("status", "pending")
      .select();

    if (error) {
      console.error("[printQueueListener] claim error for", jobId, error.message);
      return null;
    }
    const rows = (data ?? []) as PrintQueueRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  async function markFailed(jobId: string, message: string): Promise<void> {
    await supabase
      .from("print_queue")
      .update({ status: "failed", error: message, printed_at: new Date().toISOString() })
      .eq("id", jobId);
  }

  async function markDone(jobId: string): Promise<void> {
    await supabase
      .from("print_queue")
      .update({ status: "done", printed_at: new Date().toISOString() })
      .eq("id", jobId);
  }

  // Store-first (already-mapped LabelTemplate), DB fallback for templates the
  // local store hasn't loaded (e.g. created on another device).
  async function getTemplate(templateId: string): Promise<LabelTemplate | null> {
    const fromStore = useStore.getState().templates.find((t) => t.id === templateId);
    if (fromStore) return fromStore;

    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();

    if (error || !data) return null;
    return rowToTemplate(data as TemplateRow);
  }

  async function processJob(jobId: string): Promise<void> {
    try {
      // a) Atomic claim — bail out if another instance already took it.
      const job = await claim(jobId);
      if (!job) return;

      // b) Resolve the full template.
      const template = await getTemplate(job.template_id);
      if (!template) {
        console.error("[printQueueListener] template not found:", job.template_id);
        await markFailed(job.id, "template_not_found");
        return;
      }

      // c) Context from settings (language, printer, etc.).
      const { settings } = useStore.getState();
      const lang = settings.language;
      const printerName = settings.printerName;
      const preparedDate = parsePreparedDate(job.prepared_date);

      console.log(
        "[printQueueListener] printing job", job.id,
        "| template:", template.name,
        "| copies:", job.copies,
        "| org:", job.org_name,
      );

      // d) Print — REUSE the canonical pipeline (printService.printLabel),
      //    which renders to PNG and invokes the Rust GDI command. (R1/R2)
      const result = await printLabel(template, job.copies, preparedDate, lang, printerName);

      if (!result.success) {
        console.error("[printQueueListener] print failed for", job.id, result.error);
        await markFailed(job.id, result.error ?? "print_failed");
        return;
      }

      // e) Mark the queue row done.
      await markDone(job.id);

      // f) HACCP log — direct insert with source='api' so external prints don't
      //    create a compliance gap. addPrintJob() can't set source/requested_by_org,
      //    so we insert here (additive; existing store behavior untouched).
      const expiry = calcExpiryDate(template, preparedDate);
      const { error: logError } = await supabase.from("print_jobs").insert({
        user_id:          job.account_id,
        template_id:      template.id,
        template_name:    template.name,
        label_type:       template.type,
        copies:           job.copies,
        printed_at:       new Date().toISOString(),
        prepared_date:    format(preparedDate, "yyyy-MM-dd"),
        expiry_date:      format(expiry, "yyyy-MM-dd"),
        operator_name:    null,
        source:           "api",
        requested_by_org: job.org_name,
      });
      if (logError) {
        // The label already printed; a log failure must not crash the loop.
        console.error("[printQueueListener] HACCP log insert failed for", job.id, logError.message);
      } else {
        console.log("[printQueueListener] job done + logged:", job.id);
      }
    } catch (e) {
      console.error("[printQueueListener] unexpected error processing", jobId, e);
      await markFailed(jobId, `unexpected: ${String(e)}`).catch(() => {});
    }
  }

  // Sequential drain — one print at a time, outside any Realtime callback.
  async function drainQueue(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0 && !stopped) {
        const jobId = queue.shift();
        if (jobId) await processJob(jobId);
      }
    } finally {
      draining = false;
    }
  }

  // Catch-up: pending jobs that arrived while the desktop was off (Realtime only
  // delivers live events). Run AFTER the subscription is active to avoid a gap.
  async function catchUp(): Promise<void> {
    const { data, error } = await supabase
      .from("print_queue")
      .select("id")
      .eq("account_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[printQueueListener] catch-up query error:", error.message);
      return;
    }
    const rows = (data ?? []) as { id: string }[];
    console.log("[printQueueListener] catch-up found", rows.length, "pending job(s).");
    for (const r of rows) enqueue(r.id);
  }

  // Subscribe first, catch-up on SUBSCRIBED → no missed-job gap.
  const channel = supabase
    .channel(`print_queue_${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "print_queue", filter: `account_id=eq.${userId}` },
      (payload) => {
        // NO query here (constraint #6): just enqueue + trigger the async drain.
        const row = payload.new as { id?: string };
        if (row?.id) enqueue(row.id);
      },
    )
    .subscribe((status) => {
      console.log("[printQueueListener] realtime status:", status);
      if (status === "SUBSCRIBED") void catchUp();
    });

  return () => {
    stopped = true;
    void supabase.removeChannel(channel);
    console.log("[printQueueListener] stopped, instance:", instanceId);
  };
}
