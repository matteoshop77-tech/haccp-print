/* ─────────────────────────────────────────────
   HACCPrint – Quick custom label renderer

   Renderizza testo libero su canvas a scala 3× e produce un PNG con le
   PROPORZIONI corrette per la pipeline Brother QL-800 esistente:
   - la LARGHEZZA del PNG mappa sempre sui 62mm del nastro;
   - l'ALTEZZA del PNG mappa sulla lunghezza (continua) del nastro.

   Il backend Rust (print_label_image) ridimensiona il PNG a 696 pin di
   larghezza e cresce in lunghezza: quindi qui conta solo l'aspect ratio.

   NOTA: il calcolo dimensioni usa la cap-height nominale (versione che
   stampa correttamente sulla stampante reale). L'anteprima può tagliare
   visivamente qualche glifo ai bordi — problema cosmetico noto, da
   affrontare separatamente (es. padding solo sul canvas di preview).
───────────────────────────────────────────── */

const SCALE = 3;

// Stesso riferimento del renderer dei template: 732 logical px = 62mm.
// A 3× → 2196 device px = 62mm  →  ~35.42 px/mm.
const LABEL_W_PX = 732 * SCALE;          // asse trasversale = 62mm (fisso)
const PX_PER_MM  = LABEL_W_PX / 62;      // ≈ 35.42

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// Rotazione del testo in verticale. +π/2 = orario → primo carattere in alto,
// lettura dall'alto verso il basso (testa inclinata a destra).
// Invertire il segno per ribaltare il verso di lettura.
const VERTICAL_ROTATION = Math.PI / 2;

const mm = (n: number) => n * PX_PER_MM;

export type Orientation = "horizontal" | "vertical";
export type FontPreset  = "small" | "medium" | "large";

export interface CustomLabelOptions {
  text:        string;
  orientation: Orientation;
  fontPreset:  FontPreset;
}

/* Cap-height target (mm) per preset — calibrati separatamente per orientamento.
   Verticale: il carattere riempie l'asse 62mm.
   Orizzontale: dimensioni tipiche da testo "scritto normalmente". */
const CAP_TARGET_MM: Record<Orientation, Record<FontPreset, number>> = {
  vertical:   { small: 20, medium: 32, large: 48 },
  horizontal: { small: 6,  medium: 10, large: 16 },
};

/* Spezza il testo in righe (a capo SOLO su Invio dell'utente, niente word-wrap).
   Rimuove le righe vuote finali ma preserva quelle interne. */
function normalizeLines(text: string): string[] {
  let lines = text.replace(/\r/g, "").split("\n");
  while (lines.length > 1 && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length === 0) lines = [""];
  return lines;
}

/* Calcola il font-size px necessario per ottenere una cap-height target.
   Misura la cap-height reale di "H" a un font di riferimento e scala. */
function computeFontSizePx(ctx: CanvasRenderingContext2D, targetCapPx: number): number {
  const REF = 200;
  ctx.font = `700 ${REF}px ${FONT}`;
  const m   = ctx.measureText("H");
  const asc = m.actualBoundingBoxAscent || REF * 0.72;
  const capRatio = asc / REF;
  return targetCapPx / capRatio;
}

/* ─────── Orizzontale ─────── */
function drawHorizontal(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  lines: string[],
  preset: FontPreset
): void {
  const targetCapPx = mm(CAP_TARGET_MM.horizontal[preset]);
  const fontSize    = computeFontSizePx(ctx, targetCapPx);

  ctx.font = `700 ${fontSize}px ${FONT}`;
  const m    = ctx.measureText("Hg");
  const asc  = m.actualBoundingBoxAscent  || fontSize * 0.72;
  const desc = m.actualBoundingBoxDescent || fontSize * 0.20;

  const lineGap     = targetCapPx * 0.35;
  const marginLen   = mm(4);                 // margine lungo la lunghezza
  const marginCross = mm(3);                 // margine sui 62mm
  const contentW    = LABEL_W_PX - marginCross * 2;

  const slotH    = asc + desc;
  const contentH = lines.length * slotH + (lines.length - 1) * lineGap;
  const height   = Math.max(1, Math.ceil(marginLen * 2 + contentH));

  canvas.width  = LABEL_W_PX;
  canvas.height = height;                     // azzera lo stato del context

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LABEL_W_PX, height);
  ctx.fillStyle    = "#000000";
  ctx.font         = `700 ${fontSize}px ${FONT}`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";

  const centerX = LABEL_W_PX / 2;
  for (let i = 0; i < lines.length; i++) {
    const line      = lines[i];
    const baselineY = marginLen + asc + i * (slotH + lineGap);
    const w         = ctx.measureText(line).width;

    // Auto-shrink: se la riga è troppo larga per i 62mm, comprimi solo in
    // orizzontale mantenendo costante l'altezza del carattere.
    if (w > contentW && w > 0) {
      const scaleX = contentW / w;
      ctx.save();
      ctx.translate(centerX, baselineY);
      ctx.scale(scaleX, 1);
      ctx.fillText(line, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(line, centerX, baselineY);
    }
  }
}

/* ─────── Verticale ─────── */
function drawVertical(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  lines: string[],
  preset: FontPreset
): void {
  const targetCapPx = mm(CAP_TARGET_MM.vertical[preset]);
  const numCols     = lines.length;

  // Ogni riga = una colonna affiancata dentro i 62mm. La cap-height si
  // riduce se le colonne non ci stanno (es. 2 righe → ~31mm ciascuna).
  const bandW          = LABEL_W_PX / numCols;
  const effectiveCapPx = Math.min(targetCapPx, bandW * 0.92);
  const fontSize       = computeFontSizePx(ctx, effectiveCapPx);

  ctx.font = `700 ${fontSize}px ${FONT}`;

  // La lunghezza dell'etichetta cresce con la riga più lunga.
  let maxLen = 0;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    if (w > maxLen) maxLen = w;
  }

  const marginLen = mm(4);
  const height    = Math.max(Math.ceil(mm(10)), Math.ceil(maxLen + marginLen * 2));

  canvas.width  = LABEL_W_PX;
  canvas.height = height;                     // azzera lo stato del context

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LABEL_W_PX, height);
  ctx.fillStyle    = "#000000";
  ctx.font         = `700 ${fontSize}px ${FONT}`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  const centerY = height / 2;
  for (let i = 0; i < numCols; i++) {
    const bandCenterX = (i + 0.5) * bandW;
    ctx.save();
    ctx.translate(bandCenterX, centerY);
    ctx.rotate(VERTICAL_ROTATION);
    ctx.fillText(lines[i], 0, 0);            // centrato (align center, baseline middle)
    ctx.restore();
  }
}

/* Disegna l'etichetta personalizzata sul canvas fornito (usato sia per
   l'anteprima live nel dialog sia per il rendering di stampa). */
export function drawCustomLabelOnCanvas(
  canvas: HTMLCanvasElement,
  opts: CustomLabelOptions
): void {
  const ctx   = canvas.getContext("2d")!;
  const lines = normalizeLines(opts.text);
  if (opts.orientation === "vertical") {
    drawVertical(canvas, ctx, lines, opts.fontPreset);
  } else {
    drawHorizontal(canvas, ctx, lines, opts.fontPreset);
  }
}

export function renderCustomLabelToCanvas(opts: CustomLabelOptions): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  drawCustomLabelOnCanvas(canvas, opts);
  return canvas;
}

export function renderCustomLabelToPNG(opts: CustomLabelOptions): string {
  return renderCustomLabelToCanvas(opts).toDataURL("image/png");
}

/* Lunghezza in mm a partire dall'altezza in px del canvas renderizzato. */
export function customLabelLengthMM(canvas: HTMLCanvasElement): number {
  return Math.round(canvas.height / PX_PER_MM);
}

/* Dimensioni stimate: larghezza fissa 62mm, lunghezza dinamica. */
export function calcCustomLabelDimsMM(opts: CustomLabelOptions): {
  widthMM: number;
  lengthMM: number;
} {
  const canvas = renderCustomLabelToCanvas(opts);
  return { widthMM: 62, lengthMM: customLabelLengthMM(canvas) };
}
