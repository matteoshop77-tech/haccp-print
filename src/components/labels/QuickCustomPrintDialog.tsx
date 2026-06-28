import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Printer, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import { printCustomLabel } from "@/lib/printService";
import {
  drawCustomLabelOnCanvas,
  customLabelLengthMM,
  type Orientation,
  type FontPreset,
} from "@/lib/customLabelRenderer";
import { t } from "@/lib/i18n";
import clsx from "clsx";

/* ─────── Segmented control generico ─────── */
function Segmented<T extends string>({ value, onChange, options }: {
  value:    T;
  onChange: (v: T) => void;
  options:  { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center bg-app-elevated border border-app-border rounded-md p-0.5 text-sm w-full">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "flex-1 px-2.5 py-1.5 rounded font-medium transition-colors",
            value === opt.value
              ? "bg-app-surface text-ink-primary shadow-sm"
              : "text-ink-muted hover:text-ink-secondary"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ─────── Anteprima live ─────── */
function CustomPreview({ text, orientation, fontPreset, onDims }: {
  text:        string;
  orientation: Orientation;
  fontPreset:  FontPreset;
  onDims:      (lengthMM: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    drawCustomLabelOnCanvas(canvas, { text, orientation, fontPreset });

    // Scala per stare nel box: vincolata sia in larghezza sia in altezza.
    const maxW  = container.clientWidth || 320;
    const maxH  = 220;
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
    canvas.style.width  = `${canvas.width  * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;

    onDims(customLabelLengthMM(canvas));
  }, [text, orientation, fontPreset, onDims]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg flex items-center justify-center p-2"
      style={{ background: "#fff", minHeight: "120px", border: "1px solid #E5E9E6" }}
    >
      <canvas ref={canvasRef} style={{ display: "block", borderRadius: "4px" }} />
    </div>
  );
}

interface QuickCustomPrintDialogProps {
  onClose:    () => void;
  onPrinted?: () => void;
}

export function QuickCustomPrintDialog({ onClose, onPrinted }: QuickCustomPrintDialogProps) {
  const lang        = useStore((s) => s.settings.language);
  const settings    = useStore((s) => s.settings);
  const addPrintJob = useStore((s) => s.addPrintJob);

  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [fontPreset,  setFontPreset]  = useState<FontPreset>("medium");
  const [text,        setText]        = useState("");
  const [lengthMM,    setLengthMM]    = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const canPrint = text.trim().length > 0 && !loading;

  const handlePrint = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);

    const opts = { text, orientation, fontPreset };
    const result = await printCustomLabel(opts, 1, settings.printerName);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Unknown error");
      return;
    }

    if (settings.haccpLogEnabled) {
      const todayStr  = format(new Date(), "yyyy-MM-dd");
      const firstLine = text.replace(/\r/g, "").split("\n").find((l) => l.trim()) ?? "";
      addPrintJob({
        templateId:   "",                                   // store normalizza "" → null
        templateName: firstLine.trim().slice(0, 30) || "—",
        labelType:    "custom",
        copies:       1,
        preparedDate: todayStr,
        expiryDate:   todayStr,                             // one-time, nessuna scadenza
        operatorName: settings.operatorName || null,
      });
    }

    // Il dialog resta aperto con i dati invariati: l'utente può ristampare
    // o modificare e ristampare subito. Si chiude solo da Annulla / X.
    onPrinted?.();
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-app-bg border border-app-border rounded-xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-app-border">
          <h2 className="text-lg font-medium text-ink-primary">{t("qcp_title", lang)}</h2>
          <button onClick={onClose} className="nav-item w-7 h-7"><X size={15} /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Orientamento */}
          <div className="flex flex-col gap-1.5">
            <span className="section-label">{t("qcp_orientation", lang)}</span>
            <Segmented<Orientation>
              value={orientation}
              onChange={setOrientation}
              options={[
                { value: "horizontal", label: t("qcp_horizontal", lang) },
                { value: "vertical",   label: t("qcp_vertical", lang) },
              ]}
            />
          </div>

          {/* Font size */}
          <div className="flex flex-col gap-1.5">
            <span className="section-label">{t("qcp_font_size", lang)}</span>
            <Segmented<FontPreset>
              value={fontPreset}
              onChange={setFontPreset}
              options={[
                { value: "small",  label: t("qcp_small", lang) },
                { value: "medium", label: t("qcp_medium", lang) },
                { value: "large",  label: t("qcp_large", lang) },
              ]}
            />
          </div>

          {/* Testo */}
          <div className="flex flex-col gap-1.5">
            <span className="section-label">{t("qcp_text", lang)}</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("qcp_text_placeholder", lang)}
              rows={3}
              spellCheck={false}
              className="input resize-none font-mono"
              style={{ whiteSpace: "pre", overflowWrap: "normal" }}
            />
          </div>

          {/* Anteprima live */}
          <div className="flex flex-col gap-1.5">
            <CustomPreview
              text={text}
              orientation={orientation}
              fontPreset={fontPreset}
              onDims={setLengthMM}
            />
            <p className="text-xs text-ink-muted text-center">
              {t("qcp_estimated_size", lang)}: 62mm × {lengthMM}mm
            </p>
          </div>

          {error && (
            <p className="text-xs text-coral bg-coral-muted border border-coral/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Azioni */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn-ghost flex-1">{t("cancel", lang)}</button>
          <button onClick={handlePrint} disabled={!canPrint} className="btn-primary flex-[2]">
            <Printer size={15} />
            {loading ? t("print_printing", lang) : t("qcp_print", lang)}
          </button>
        </div>

      </div>
    </div>
  );
}
