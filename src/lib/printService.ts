import { format, addDays } from "date-fns";
import { invoke } from "@tauri-apps/api/core";
import type { LabelTemplate } from "@/lib/types";
import { renderLabelToPNG, calcLabelHeightMM } from "@/lib/labelRenderer";
import {
  renderCustomLabelToPNG,
  calcCustomLabelDimsMM,
  type CustomLabelOptions,
} from "@/lib/customLabelRenderer";

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
  lang: "en" | "hu" = "en",
  printerName?: string | null
): Promise<PrintResult> {

  console.time("[PRINT] 1. renderLabelToPNG");
  const pngBase64 = renderLabelToPNG(template, preparedDate, lang);
  const pngData   = pngBase64.replace(/^data:image\/png;base64,/, "");
  console.timeEnd("[PRINT] 1. renderLabelToPNG");

  console.log("[PRINT] PNG size (chars):", pngData.length, "| copies:", copies);

  const labelWMM = 62.0;
  const labelHMM = calcLabelHeightMM(template, lang);

  try {
    console.time("[PRINT] 2. invoke print_label_image");
    await invoke("print_label_image", {
      pngBase64:  pngData,
      copies,
      printerName: printerName ?? null,
      labelWMm:   labelWMM,
      labelHMm:   labelHMM,
    });
    console.timeEnd("[PRINT] 2. invoke print_label_image");

    return { success: true };
  } catch (err) {
    console.error("[PRINT] Error:", err);
    return { success: false, error: String(err) };
  }
}

/* Stampa un'etichetta personalizzata "one-time" (Quick custom print).
   Riusa lo STESSO comando Tauri della stampa normale: produce un PNG base64
   con le proporzioni corrette e lascia che il backend Rust lo ridimensioni. */
export async function printCustomLabel(
  opts: CustomLabelOptions,
  copies: number,
  printerName?: string | null
): Promise<PrintResult> {
  const pngBase64 = renderCustomLabelToPNG(opts);
  const pngData   = pngBase64.replace(/^data:image\/png;base64,/, "");

  const { widthMM, lengthMM } = calcCustomLabelDimsMM(opts);

  try {
    await invoke("print_label_image", {
      pngBase64:   pngData,
      copies,
      printerName: printerName ?? null,
      labelWMm:    widthMM,
      labelHMm:    lengthMM,
    });
    return { success: true };
  } catch (err) {
    console.error("[PRINT custom] Error:", err);
    return { success: false, error: String(err) };
  }
}