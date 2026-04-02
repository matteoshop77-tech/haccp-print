import { addDays, format } from "date-fns";
import type { LabelTemplate } from "@/lib/types";

const SCALE = 3;

const LABEL_W_PX  = 732 * SCALE;
const MARGIN_PX   = 20  * SCALE;
const CONTENT_W   = LABEL_W_PX - MARGIN_PX * 2;

const F_NAME   = 38 * SCALE;
const F_DESC   = 26 * SCALE;
const F_LABEL  = 22 * SCALE;
const F_VALUE  = 34 * SCALE;
const F_ALLERG = 24 * SCALE;

const GAP_SM  = 8  * SCALE;
const GAP_MD  = 10 * SCALE;
const GAP_TOP = 6  * SCALE;

function fontB(s: number) { return `bold ${s}px Arial, sans-serif`; }
function fontM(s: number) { return `500 ${s}px Arial, sans-serif`; }
function fontR(s: number) { return `400 ${s}px Arial, sans-serif`; }

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineH: number,
  color = "#000"
): number {
  const lines = wrapText(ctx, text, maxWidth);
  ctx.fillStyle = color;
  for (const l of lines) {
    ctx.fillText(l, x, y);
    y += lineH;
  }
  return lines.length * lineH;
}

function divider(ctx: CanvasRenderingContext2D, y: number) {
  ctx.fillStyle = "#aaaaaa";
  ctx.fillRect(MARGIN_PX, y, CONTENT_W, SCALE * 3);
}

function calcHeight(template: LabelTemplate, lang: "en" | "hu"): number {
  const c = document.createElement("canvas");
  c.width = LABEL_W_PX;
  c.height = 100;
  const ctx = c.getContext("2d")!;
  let h = GAP_TOP;

  ctx.font = fontB(F_NAME);
  const nameLines = wrapText(ctx, template.name.toUpperCase(), CONTENT_W);
  h += nameLines.length * (F_NAME + GAP_SM);
  h += GAP_SM;

  if (template.description && template.type !== "bontas") {
    ctx.font = fontR(F_DESC);
    const dLines = wrapText(ctx, template.description, CONTENT_W);
    h += dLines.length * (F_DESC + GAP_SM);
    h += GAP_SM;
  }

  if (template.type !== "custom") {
    h += SCALE + GAP_MD;
    if (template.type === "bontas") {
      h += F_LABEL + GAP_SM + F_VALUE + GAP_SM;
    } else {
      h += (F_LABEL + GAP_SM + F_VALUE + GAP_SM) * 2;
    }
    h += GAP_SM;
  }

  if (template.allergens) {
    h += SCALE + GAP_MD;
    ctx.font = fontR(F_ALLERG);
    const aLines = wrapText(
      ctx,
      `${lang === "hu" ? "Allergének" : "Allergens"}: ${template.allergens}`,
      CONTENT_W
    );
    h += aLines.length * (F_ALLERG + GAP_SM);
    h += GAP_SM;
  }

  h += GAP_TOP;
  return h;
}

// Altezza fisica in mm passata al driver.
// Aggiungiamo 8mm di padding di sicurezza così il driver non taglia mai il contenuto.
export function calcLabelHeightMM(template: LabelTemplate, lang: "en" | "hu"): number {
  const px = calcHeight(template, lang);
  const mm = (px / SCALE) * (62 / 732);
  return mm + 8; // 8mm padding di sicurezza
}

export function renderLabelToCanvas(
  template: LabelTemplate,
  preparedDate: Date,
  lang: "en" | "hu" = "en"
): HTMLCanvasElement {
  const expiry      = addDays(preparedDate, template.shelfLifeDays);
  const preparedStr = format(preparedDate, "dd.MM.yyyy");
  const expiryStr   = format(expiry, "dd.MM.yyyy");

  const L = {
    prepared:  lang === "hu" ? "Elkészítve:"    : "Prepared:",
    useby:     lang === "hu" ? "Felhasználható:" : "Use by:",
    opened:    lang === "hu" ? "Bontás dátuma:" : "Opened:",
    allergens: lang === "hu" ? "Allergének:"    : "Allergens:",
  };

  const height = calcHeight(template, lang);
  const canvas = document.createElement("canvas");
  canvas.width  = LABEL_W_PX;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LABEL_W_PX, height);

  const x = MARGIN_PX;
  let y = GAP_TOP;

  // Nome
  ctx.font = fontB(F_NAME);
  const nameLines = wrapText(ctx, template.name.toUpperCase(), CONTENT_W);
  ctx.fillStyle = "#000";
  for (const l of nameLines) {
    ctx.fillText(l, x, y + F_NAME);
    y += F_NAME + GAP_SM;
  }
  y += GAP_SM;

  // Descrizione
  if (template.description && template.type !== "bontas") {
    ctx.font = fontR(F_DESC);
    const used = drawText(ctx, template.description, x, y + F_DESC, CONTENT_W, F_DESC + GAP_SM, "#333");
    y += used + GAP_SM;
  }

  // Date
  if (template.type !== "custom") {
    divider(ctx, y);
    y += SCALE + GAP_MD;

    if (template.type === "bontas") {
      ctx.font = fontR(F_LABEL);
      ctx.fillStyle = "#888";
      ctx.fillText(L.opened, x, y + F_LABEL);
      y += F_LABEL + GAP_SM;
      ctx.font = fontB(F_VALUE);
      ctx.fillStyle = "#000";
      ctx.fillText(preparedStr, x, y + F_VALUE);
      y += F_VALUE + GAP_SM;
    } else {
      ctx.font = fontR(F_LABEL);
      ctx.fillStyle = "#888";
      ctx.fillText(L.prepared, x, y + F_LABEL);
      y += F_LABEL + GAP_SM;
      ctx.font = fontM(F_VALUE);
      ctx.fillStyle = "#444";
      ctx.fillText(preparedStr, x, y + F_VALUE);
      y += F_VALUE + GAP_SM;

      ctx.font = fontR(F_LABEL);
      ctx.fillStyle = "#888";
      ctx.fillText(L.useby, x, y + F_LABEL);
      y += F_LABEL + GAP_SM;
      ctx.font = fontB(F_VALUE);
      ctx.fillStyle = "#000";
      ctx.fillText(expiryStr, x, y + F_VALUE);
      y += F_VALUE + GAP_SM;
    }
    y += GAP_SM;
  }

  // Allergeni
  if (template.allergens) {
    divider(ctx, y);
    y += SCALE + GAP_MD;
    ctx.font = fontR(F_ALLERG);
    const algText = `${L.allergens} ${template.allergens}`;
    drawText(ctx, algText, x, y + F_ALLERG, CONTENT_W, F_ALLERG + GAP_SM, "#555");
  }

  return canvas;
}

export function renderLabelToPNG(
  template: LabelTemplate,
  preparedDate: Date,
  lang: "en" | "hu" = "en"
): string {
  return renderLabelToCanvas(template, preparedDate, lang).toDataURL("image/png");
}

export function formatLabelDate(date: Date): string {
  return format(date, "dd.MM.yyyy");
}