import { format, addDays } from "date-fns";
import type { LabelTemplate } from "@/lib/types";
import { renderLabelToPNG } from "@/lib/labelRenderer";

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

/** Fetch the auto-detected Brother printer name from the Rust layer. */
export async function getDetectedPrinterName(): Promise<string> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const name = await invoke<string>("get_printer_name");
    return name;
  } catch {
    return "Brother QL-800";
  }
}

export async function printLabel(
  template: LabelTemplate,
  copies: number,
  preparedDate = new Date(),
  lang: "en" | "hu" = "en",
  printerName?: string | null
): Promise<PrintResult> {

  const pngBase64 = renderLabelToPNG(template, preparedDate, lang);
  const pngData   = pngBase64.replace(/^data:image\/png;base64,/, "");

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("print_label_image", {
      pngBase64: pngData,
      copies,
      printerName: printerName ?? null,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}