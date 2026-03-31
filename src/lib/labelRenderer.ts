import { addDays, format } from "date-fns";
import type { LabelTemplate } from "@/lib/types";

/* ── Costanti fisiche Brother QL-800 62mm ── */
const PRINT_WIDTH_PX   = 696;   // 58mm a 300dpi
const MARGIN_PX        = 24;    // margine interno
const CONTENT_WIDTH    = PRINT_WIDTH_PX - MARGIN_PX * 2;
const DPI              = 300;
const MM_TO_PX         = DPI / 25.4;

/* ── Font sizes in px (300dpi) ── */
const FONT_PRODUCT_NAME = 52;   // nome prodotto grande
const FONT_LABEL        = 28;   // etichette piccole (PREPARED, USE BY...)
const FONT_VALUE        = 38;   // valori (date, giorni)
const FONT_DESCRIPTION  = 30;   // descrizione / ingredienti
const FONT_ALLERGENS    = 26;   // allergeni
const FONT_FOOTER       = 24;   // footer HACCPrint

const LINE_GAP          = 12;   // spazio tra righe
const SECTION_GAP       = 28;   // spazio tra sezioni
const DIVIDER_HEIGHT    = 2;    // linea separatrice

/* ── Colori ── */
const COLOR_BLACK       = "#000000";
const COLOR_DARK_GRAY   = "#333333";
const COLOR_MID_GRAY    = "#666666";
const COLOR_LIGHT_GRAY  = "#999999";
const COLOR_DIVIDER     = "#cccccc";

/* ── Font stack ── */
const FONT_BOLD    = `bold %PX%px "DM Sans", Arial, sans-serif`;
const FONT_MEDIUM  = `500 %PX%px "DM Sans", Arial, sans-serif`;
const FONT_REGULAR = `400 %PX%px "DM Sans", Arial, sans-serif`;

function px(size: number) { return size; }
function fontBold(size: number)    { return FONT_BOLD.replace("%PX%", String(size)); }
function fontMedium(size: number)  { return FONT_MEDIUM.replace("%PX%", String(size)); }
function fontRegular(size: number) { return FONT_REGULAR.replace("%PX%", String(size)); }

/* ── Wrap testo su più righe ── */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/* ── Disegna testo wrappato, ritorna altezza usata ── */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  color = COLOR_BLACK
): number {
  const lines = wrapText(ctx, text, maxWidth);
  ctx.fillStyle = color;
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return lines.length * lineHeight;
}

/* ── Calcola altezza totale senza disegnare (dry run) ── */
function calculateHeight(
  template: LabelTemplate,
  preparedDate: Date,
  lang: "en" | "hu"
): number {
  const canvas = document.createElement("canvas");
  canvas.width = PRINT_WIDTH_PX;
  canvas.height = 100; // temporaneo
  const ctx = canvas.getContext("2d")!;

  let h = MARGIN_PX;

  // Nome prodotto
  ctx.font = fontBold(FONT_PRODUCT_NAME);
  const nameLines = wrapText(ctx, template.name.toUpperCase(), CONTENT_WIDTH);
  h += nameLines.length * (FONT_PRODUCT_NAME + LINE_GAP);
  h += SECTION_GAP;

  // Divider
  h += DIVIDER_HEIGHT + SECTION_GAP;

  // Tipo etichetta
  if (template.type === "bontas") {
    h += FONT_LABEL + LINE_GAP;
    h += FONT_VALUE + LINE_GAP;
    h += SECTION_GAP;
  } else if (template.type === "ervenyesseg") {
    h += (FONT_LABEL + LINE_GAP) * 2;
    h += (FONT_VALUE + LINE_GAP) * 2;
    h += SECTION_GAP;
  } else if (template.type === "termek_leiras") {
    if (template.description) {
      ctx.font = fontRegular(FONT_DESCRIPTION);
      const descLines = wrapText(ctx, template.description, CONTENT_WIDTH);
      h += descLines.length * (FONT_DESCRIPTION + LINE_GAP);
      h += SECTION_GAP;
    }
    h += FONT_LABEL + LINE_GAP;
    h += FONT_VALUE + LINE_GAP;
    h += SECTION_GAP;
  } else if (template.type === "custom") {
    if (template.description) {
      ctx.font = fontRegular(FONT_DESCRIPTION);
      const descLines = wrapText(ctx, template.description, CONTENT_WIDTH);
      h += descLines.length * (FONT_DESCRIPTION + LINE_GAP);
      h += SECTION_GAP;
    }
  }

  // Allergeni
  if (template.allergens) {
    h += DIVIDER_HEIGHT + SECTION_GAP;
    ctx.font = fontRegular(FONT_ALLERGENS);
    const algLines = wrapText(ctx, `${lang === "hu" ? "Allergének" : "Allergens"}: ${template.allergens}`, CONTENT_WIDTH);
    h += algLines.length * (FONT_ALLERGENS + LINE_GAP);
    h += SECTION_GAP;
  }

  // Footer
  h += DIVIDER_HEIGHT + SECTION_GAP;
  h += FONT_FOOTER + LINE_GAP;
  h += MARGIN_PX;

  return h;
}

/* ── Renderer principale ── */
export function renderLabelToCanvas(
  template: LabelTemplate,
  preparedDate: Date,
  lang: "en" | "hu" = "en"
): HTMLCanvasElement {
  const expiry = addDays(preparedDate, template.shelfLifeDays);
  const preparedStr = format(preparedDate, "dd.MM.yyyy");
  const expiryStr   = format(expiry,       "dd.MM.yyyy");

  const labels = {
    prepared:   lang === "hu" ? "Elkészítve:"      : "Prepared:",
    useby:      lang === "hu" ? "Felhasználható:"  : "Use by:",
    opened:     lang === "hu" ? "Bontás dátuma:"   : "Opened on:",
    expires:    lang === "hu" ? "Lejárat:"         : "Expires:",
    allergens:  lang === "hu" ? "Allergének:"      : "Allergens:",
    footer:     "HACCPrint",
  };

  const height = calculateHeight(template, preparedDate, lang);

  const canvas = document.createElement("canvas");
  canvas.width  = PRINT_WIDTH_PX;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;

  // Sfondo bianco
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PRINT_WIDTH_PX, height);

  let y = MARGIN_PX;
  const x = MARGIN_PX;

  // ── Nome prodotto ──
  ctx.font = fontBold(FONT_PRODUCT_NAME);
  const nameLines = wrapText(ctx, template.name.toUpperCase(), CONTENT_WIDTH);
  ctx.fillStyle = COLOR_BLACK;
  for (const line of nameLines) {
    ctx.fillText(line, x, y + FONT_PRODUCT_NAME);
    y += FONT_PRODUCT_NAME + LINE_GAP;
  }
  y += SECTION_GAP;

  // ── Divider ──
  ctx.fillStyle = COLOR_DIVIDER;
  ctx.fillRect(x, y, CONTENT_WIDTH, DIVIDER_HEIGHT);
  y += DIVIDER_HEIGHT + SECTION_GAP;

  // ── Contenuto per tipo ──
  if (template.type === "bontas") {
    ctx.font = fontRegular(FONT_LABEL);
    ctx.fillStyle = COLOR_LIGHT_GRAY;
    ctx.fillText(labels.opened, x, y + FONT_LABEL);
    y += FONT_LABEL + LINE_GAP;
    ctx.font = fontBold(FONT_VALUE);
    ctx.fillStyle = COLOR_BLACK;
    ctx.fillText(preparedStr, x, y + FONT_VALUE);
    y += FONT_VALUE + LINE_GAP + SECTION_GAP;

  } else if (template.type === "ervenyesseg") {
    // Prepared
    ctx.font = fontRegular(FONT_LABEL);
    ctx.fillStyle = COLOR_LIGHT_GRAY;
    ctx.fillText(labels.prepared, x, y + FONT_LABEL);
    y += FONT_LABEL + LINE_GAP;
    ctx.font = fontMedium(FONT_VALUE);
    ctx.fillStyle = COLOR_DARK_GRAY;
    ctx.fillText(preparedStr, x, y + FONT_VALUE);
    y += FONT_VALUE + LINE_GAP + SECTION_GAP * 0.5;

    // Use by
    ctx.font = fontRegular(FONT_LABEL);
    ctx.fillStyle = COLOR_LIGHT_GRAY;
    ctx.fillText(labels.useby, x, y + FONT_LABEL);
    y += FONT_LABEL + LINE_GAP;
    ctx.font = fontBold(FONT_VALUE);
    ctx.fillStyle = COLOR_BLACK;
    ctx.fillText(expiryStr, x, y + FONT_VALUE);
    y += FONT_VALUE + LINE_GAP + SECTION_GAP;

  } else if (template.type === "termek_leiras") {
    // Descrizione
    if (template.description) {
      ctx.font = fontRegular(FONT_DESCRIPTION);
      const used = drawWrappedText(
        ctx, template.description,
        x, y + FONT_DESCRIPTION,
        CONTENT_WIDTH, FONT_DESCRIPTION + LINE_GAP,
        COLOR_DARK_GRAY
      );
      y += used + SECTION_GAP;
    }
    // Expires
    ctx.font = fontRegular(FONT_LABEL);
    ctx.fillStyle = COLOR_LIGHT_GRAY;
    ctx.fillText(labels.expires, x, y + FONT_LABEL);
    y += FONT_LABEL + LINE_GAP;
    ctx.font = fontBold(FONT_VALUE);
    ctx.fillStyle = COLOR_BLACK;
    ctx.fillText(expiryStr, x, y + FONT_VALUE);
    y += FONT_VALUE + LINE_GAP + SECTION_GAP;

  } else if (template.type === "custom") {
    if (template.description) {
      ctx.font = fontRegular(FONT_DESCRIPTION);
      const used = drawWrappedText(
        ctx, template.description,
        x, y + FONT_DESCRIPTION,
        CONTENT_WIDTH, FONT_DESCRIPTION + LINE_GAP,
        COLOR_BLACK
      );
      y += used + SECTION_GAP;
    }
  }

  // ── Allergeni ──
  if (template.allergens) {
    ctx.fillStyle = COLOR_DIVIDER;
    ctx.fillRect(x, y, CONTENT_WIDTH, DIVIDER_HEIGHT);
    y += DIVIDER_HEIGHT + SECTION_GAP;

    ctx.font = fontRegular(FONT_ALLERGENS);
    const algText = `${labels.allergens} ${template.allergens}`;
    const used = drawWrappedText(
      ctx, algText,
      x, y + FONT_ALLERGENS,
      CONTENT_WIDTH, FONT_ALLERGENS + LINE_GAP,
      COLOR_MID_GRAY
    );
    y += used + SECTION_GAP;
  }

  // ── Footer ──
  ctx.fillStyle = COLOR_DIVIDER;
  ctx.fillRect(x, y, CONTENT_WIDTH, DIVIDER_HEIGHT);
  y += DIVIDER_HEIGHT + SECTION_GAP;

  ctx.font = fontRegular(FONT_FOOTER);
  ctx.fillStyle = COLOR_LIGHT_GRAY;
  ctx.fillText(`${labels.footer} · ${preparedStr}`, x, y + FONT_FOOTER);

  return canvas;
}

/* ── Esporta come PNG base64 ── */
export function renderLabelToPNG(
  template: LabelTemplate,
  preparedDate: Date,
  lang: "en" | "hu" = "en"
): string {
  const canvas = renderLabelToCanvas(template, preparedDate, lang);
  return canvas.toDataURL("image/png");
}

/* ── Calcola altezza etichetta in mm ── */
export function getLabelHeightMM(
  template: LabelTemplate,
  preparedDate: Date,
  lang: "en" | "hu" = "en"
): number {
  const heightPx = calculateHeight(template, preparedDate, lang);
  return Math.ceil(heightPx / MM_TO_PX);
}