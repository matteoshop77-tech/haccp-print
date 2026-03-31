/**
 * HACCPrint – Print Service
 *
 * In development / browser mode: POSTs to http://localhost:8013/print
 * (same as the original Python bridge, for backward compat while testing)
 *
 * In Tauri production build: calls the Tauri command `print_label`
 * which talks to the Brother QL-800 via the system print API.
 */

import { format, addDays } from "date-fns";
import type { LabelTemplate, LabelType } from "@/lib/types";

/* ── Check if running inside Tauri ── */
const isTauri = () =>
  typeof window !== "undefined" && "__TAURI__" in window;

/* ── Format a date for label display ── */
export function formatLabelDate(date: Date): string {
  return format(date, "dd.MM.yyyy");
}

/* ── Calculate expiry date from template ── */
export function calcExpiryDate(template: LabelTemplate, from = new Date()): Date {
  return addDays(from, template.shelfLifeDays);
}

/* ── Build the text lines for a label ── */
export function buildLabelLines(
  template: LabelTemplate,
  preparedDate: Date,
  lang: "en" | "hu" = "en"
): string[] {
  const prepared = formatLabelDate(preparedDate);
  const expiry   = formatLabelDate(addDays(preparedDate, template.shelfLifeDays));

  const typeLabels: Record<LabelType, { en: string; hu: string }> = {
    bontas:        { en: "Opened",    hu: "Bontás" },
    ervenyesseg:   { en: "Use by",    hu: "Érvényes" },
    termek_leiras: { en: "Product",   hu: "Termék" },
    custom:        { en: "",          hu: "" },
  };

  const typeLabel = typeLabels[template.type][lang];

  const lines: string[] = [
    template.name.toUpperCase(),
    "",
  ];

  if (template.type === "bontas") {
    lines.push(`${lang === "hu" ? "Bontás dátuma" : "Opened on"}: ${prepared}`);
    lines.push(`${lang === "hu" ? "Felhasználható" : "Use by"}: ${expiry}`);
  } else if (template.type === "ervenyesseg") {
    lines.push(`${lang === "hu" ? "Elkészítve" : "Prepared"}: ${prepared}`);
    lines.push(`${lang === "hu" ? "Felhasználható" : "Use by"}: ${expiry}`);
  } else if (template.type === "termek_leiras") {
    if (template.description) lines.push(template.description);
    lines.push(`${lang === "hu" ? "Lejárat" : "Expires"}: ${expiry}`);
  } else {
    if (template.description) lines.push(template.description);
  }

  if (template.allergens) {
    lines.push("");
    lines.push(`${lang === "hu" ? "Allergének" : "Allergens"}: ${template.allergens}`);
  }

  lines.push("");
  lines.push(`${typeLabel ? typeLabel + " · " : ""}${prepared}`);

  return lines.filter((l) => l !== undefined);
}

/* ── Print result ── */
export interface PrintResult {
  success: boolean;
  error?:  string;
}

/* ── Main print function ── */
export async function printLabel(
  template: LabelTemplate,
  copies: number,
  preparedDate = new Date(),
  lang: "en" | "hu" = "en"
): Promise<PrintResult> {
  const lines = buildLabelLines(template, preparedDate, lang);
  const text  = lines.join("\n");

  /* ── Tauri path (production) ── */
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("print_label", {
        text,
        copies,
        printerName: null, // auto-detect first Brother QL
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /* ── Dev / browser path: Python bridge on port 8013 ── */
  try {
    const requests = Array.from({ length: copies }, () =>
      fetch("http://localhost:8013/print", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text }),
      })
    );
    const responses = await Promise.all(requests);
    if (!responses.every((r) => r.ok)) {
      return { success: false, error: "Print agent not running on port 8013" };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Cannot reach print agent (localhost:8013)" };
  }
}
