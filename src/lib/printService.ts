import { format, addDays } from "date-fns";
import type { LabelTemplate } from "@/lib/types";
import { renderLabelToPNG } from "@/lib/labelRenderer";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI__" in window;

export function formatLabelDate(date: Date): string {
  return format(date, "dd.MM.yyyy");
}

export function calcExpiryDate(template: LabelTemplate, from = new Date()): Date {
  return addDays(from, template.shelfLifeDays);
}

export interface PrintResult {
  success: boolean;
  error?:  string;
}

export async function printLabel(
  template: LabelTemplate,
  copies: number,
  preparedDate = new Date(),
  lang: "en" | "hu" = "en"
): Promise<PrintResult> {

  /* ── Genera PNG dal renderer Canvas ── */
  const pngBase64 = renderLabelToPNG(template, preparedDate, lang);
  // rimuove il prefisso "data:image/png;base64,"
  const pngData = pngBase64.replace(/^data:image\/png;base64,/, "");

  /* ── Tauri path (production) ── */
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("print_label_image", {
        pngBase64: pngData,
        copies,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /* ── Dev / browser path: Python bridge su porta 8013 ── */
  try {
    const response = await fetch("http://localhost:8013/print", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        png_base64: pngData,
        copies,
        label_size: "62",
      }),
    });
    if (!response.ok) {
      return { success: false, error: "Print agent not running on port 8013" };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Cannot reach print agent (localhost:8013)" };
  }
}