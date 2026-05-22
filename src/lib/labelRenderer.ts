import { addDays, format } from "date-fns";
import type { LabelTemplate } from "@/lib/types";

const SCALE = 3;

const LABEL_W_PX = 732 * SCALE;
const MARGIN_PX  = 22  * SCALE;
const CONTENT_W  = LABEL_W_PX - MARGIN_PX * 2;

const F_NAME   = 36 * SCALE;
const F_LABEL  = 26 * SCALE;
const F_VALUE  = 32 * SCALE;
const F_DESC   = 26 * SCALE;
const F_ALLERG = 25 * SCALE;

const GAP_SM  = 6  * SCALE;
const GAP_MD  = 10 * SCALE;
const GAP_TOP = 10 * SCALE;

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

function fontB(s: number) { return `700 ${s}px ${FONT}`; }
function fontM(s: number) { return `500 ${s}px ${FONT}`; }
function fontR(s: number) { return `400 ${s}px ${FONT}`; }

const COL_NAME  = "#000000";
const COL_DESC  = "#333333";
const COL_LABEL = "#000000";
const COL_VALUE = "#111111";
const COL_VALUE_BOLD = "#000000";
const COL_ALLERG = "#444444";

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
  ctx.fillStyle = "#cccccc";
  ctx.fillRect(MARGIN_PX, y, CONTENT_W, Math.round(SCALE * 1.5));
}

// Disegna una riga label+valore — identica per ogni tipo di etichetta
function drawDateRow(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  bold = false
): number {
  ctx.font      = fontR(F_LABEL);
  ctx.fillStyle = COL_LABEL;
  ctx.fillText(label, x, y + F_LABEL);
  y += F_LABEL + GAP_SM;

  ctx.font      = bold ? fontB(F_VALUE) : fontM(F_VALUE);
  ctx.fillStyle = bold ? COL_VALUE_BOLD : COL_VALUE;
  ctx.fillText(value, x, y + F_VALUE);
  y += F_VALUE + GAP_SM;

  return y;
}

function calcHeight(template: LabelTemplate, lang: "en" | "hu"): number {
  const c = document.createElement("canvas");
  c.width  = LABEL_W_PX;
  c.height = 100;
  const ctx = c.getContext("2d")!;
  let h = GAP_TOP;

  ctx.font = fontB(F_NAME);
  const nameLines = wrapText(ctx, template.name.toUpperCase(), CONTENT_W);
  h += nameLines.length * (F_NAME + GAP_SM) + GAP_SM;

  if (template.description && template.type !== "bontas") {
    ctx.font = fontR(F_DESC);
    const dLines = wrapText(ctx, template.description, CONTENT_W);
    h += dLines.length * (F_DESC + GAP_SM) + GAP_SM;
  }

  if (template.type !== "custom") {
    h += Math.round(SCALE * 1.5) + GAP_MD;
    const rows = template.type === "bontas" ? 1 : 2;
    h += rows * (F_LABEL + GAP_SM + F_VALUE + GAP_SM) + GAP_SM;
  }

  if (template.allergens) {
    h += Math.round(SCALE * 1.5) + GAP_MD;
    ctx.font = fontR(F_ALLERG);
    const aLines = wrapText(
      ctx,
      `${lang === "hu" ? "Allergének" : "Allergens"}: ${template.allergens}`,
      CONTENT_W
    );
    h += aLines.length * (F_ALLERG + GAP_SM) + GAP_SM;
  }

  h += GAP_TOP;
  return h;
}

export function calcLabelHeightMM(template: LabelTemplate, lang: "en" | "hu"): number {
  const px = calcHeight(template, lang);
  const mm = (px / SCALE) * (62 / 732);
  return mm + 8;
}

export function drawLabelOnCanvas(
  canvas: HTMLCanvasElement,
  template: LabelTemplate,
  preparedDate: Date,
  lang: "en" | "hu" = "en"
): void {
  const expiry      = addDays(preparedDate, template.shelfLifeDays);
  const preparedStr = format(preparedDate, "dd.MM.yyyy");
  const expiryStr   = format(expiry, "dd.MM.yyyy");

  const L = {
    prepared:  lang === "hu" ? "Elkészítve:"     : "Prepared:",
    useby:     lang === "hu" ? "Felhasználható:"  : "Use by:",
    opened:    lang === "hu" ? "Bontás dátuma:"  : "Opened:",
    allergens: lang === "hu" ? "Allergének:"     : "Allergens:",
  };

  const height = calcHeight(template, lang);
  // Assegnare width/height al canvas azzera il bitmap automaticamente — usiamo
  // questo per re-renderizzare sullo stesso canvas senza accumulare disegno.
  canvas.width  = LABEL_W_PX;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LABEL_W_PX, height);

  const x = MARGIN_PX;
  let y = GAP_TOP;

  // ── Nome ──
  ctx.font      = fontB(F_NAME);
  ctx.fillStyle = COL_NAME;
  for (const l of wrapText(ctx, template.name.toUpperCase(), CONTENT_W)) {
    ctx.fillText(l, x, y + F_NAME);
    y += F_NAME + GAP_SM;
  }
  y += GAP_SM;

  // ── Descrizione ──
  if (template.description && template.type !== "bontas") {
    ctx.font = fontR(F_DESC);
    const used = drawText(ctx, template.description, x, y + F_DESC, CONTENT_W, F_DESC + GAP_SM, COL_DESC);
    y += used + GAP_SM;
  }

  // ── Date — stesso identico schema per tutti i tipi ──
  if (template.type !== "custom") {
    divider(ctx, y);
    y += Math.round(SCALE * 1.5) + GAP_MD;

    if (template.type === "bontas") {
      y = drawDateRow(ctx, L.opened, preparedStr, x, y, true);
    } else {
      y = drawDateRow(ctx, L.prepared, preparedStr, x, y, false);
      y = drawDateRow(ctx, L.useby,    expiryStr,   x, y, true);
    }
    y += GAP_SM;
  }

  // ── Allergeni ──
  if (template.allergens) {
    divider(ctx, y);
    y += Math.round(SCALE * 1.5) + GAP_MD;
    ctx.font = fontR(F_ALLERG);
    drawText(ctx, `${L.allergens} ${template.allergens}`, x, y + F_ALLERG, CONTENT_W, F_ALLERG + GAP_SM, COL_ALLERG);
  }
}

export function renderLabelToCanvas(
  template: LabelTemplate,
  preparedDate: Date,
  lang: "en" | "hu" = "en"
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  drawLabelOnCanvas(canvas, template, preparedDate, lang);
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