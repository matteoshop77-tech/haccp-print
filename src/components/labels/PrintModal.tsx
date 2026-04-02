import { useState, useEffect, useRef } from "react";
import { format, addDays } from "date-fns";
import { Printer, X, Minus, Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import { printLabel } from "@/lib/printService";
import { renderLabelToCanvas } from "@/lib/labelRenderer";
import { formatLabelDate } from "@/lib/printService";
import { t } from "@/lib/i18n";
import type { LabelTemplate } from "@/lib/types";
import clsx from "clsx";

const typeBadge: Record<string, string> = {
  ervenyesseg:   "badge-brand",
  bontas:        "badge-amber",
  termek_leiras: "bg-sky/10 text-sky border border-sky/20",
  custom:        "bg-violet/10 text-violet border border-violet/20",
};

/* ── Anteprima Canvas reale ── */
function LabelPreview({ template, preparedDate, lang }: {
  template: LabelTemplate;
  preparedDate: Date;
  lang: "en" | "hu";
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const canvas = renderLabelToCanvas(template, preparedDate, lang);
    // Scala il canvas per farlo stare nel modal (larghezza max 340px)
    const maxW = containerRef.current.clientWidth || 340;
    const scale = maxW / canvas.width;
    canvas.style.width  = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
    canvas.style.borderRadius = "8px";
    canvas.style.display = "block";
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(canvas);
  }, [template, preparedDate, lang]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden"
      style={{ background: "#fff", minHeight: "80px" }}
    />
  );
}

interface PrintModalProps {
  template: LabelTemplate;
  onClose:  () => void;
}

export function PrintModal({ template, onClose }: PrintModalProps) {
  const lang        = useStore((s) => s.settings.language);
  const addPrintJob = useStore((s) => s.addPrintJob);
  const settings    = useStore((s) => s.settings);

  const [copies,  setCopies]  = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const today  = new Date();
  const expiry = addDays(today, template.shelfLifeDays);

  const handlePrint = async () => {
    setLoading(true);
    setError(null);
    const result = await printLabel(template, copies, today, lang, settings.printerName);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Unknown error");
      return;
    }
    if (settings.haccpLogEnabled) {
      addPrintJob({
        templateId:   template.id,
        templateName: template.name,
        labelType:    template.type,
        copies,
        preparedDate: format(today, "yyyy-MM-dd"),
        expiryDate:   format(expiry, "yyyy-MM-dd"),
        operatorName: settings.operatorName || null,
      });
    }
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-app-bg border border-app-border rounded-xl w-full max-w-sm mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-app-border">
          <div>
            <h2 className="text-lg font-medium text-ink-primary">{template.name}</h2>
            <p className="text-xs text-ink-secondary mt-0.5">{template.category}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={clsx("badge text-xs", typeBadge[template.type] ?? "badge-brand")}>
              {t(`type_${template.type}` as Parameters<typeof t>[0], lang)}
            </span>
            <button onClick={onClose} className="nav-item w-7 h-7"><X size={15} /></button>
          </div>
        </div>

        {/* Anteprima etichetta reale */}
        <div className="p-5 pb-3">
          <p className="section-label mb-2">Label preview</p>
          <LabelPreview template={template} preparedDate={today} lang={lang} />
        </div>

        {/* Controlli */}
        <div className="px-5 pb-4 flex flex-col gap-3">
          {template.type !== "custom" && template.type !== "bontas" && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink-secondary w-24 flex-shrink-0">
                {t("print_expires_in", lang)}
              </span>
              <span className="text-sm text-brand-light font-medium">
                {template.shelfLifeDays} {t("days", lang)} → {formatLabelDate(expiry)}
              </span>
            </div>
          )}

          {/* Copie */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-secondary w-24 flex-shrink-0">
              {t("print_copies", lang)}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCopies((c) => Math.max(1, c - 1))}
                className="w-8 h-8 rounded-lg bg-app-surface border border-app-border
                           flex items-center justify-center text-brand-light
                           hover:border-brand hover:bg-brand-muted transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="text-lg font-medium text-ink-primary w-10 text-center tabular-nums">
                {copies}
              </span>
              <button
                onClick={() => setCopies((c) => Math.min(200, c + 1))}
                className="w-8 h-8 rounded-lg bg-app-surface border border-app-border
                           flex items-center justify-center text-brand-light
                           hover:border-brand hover:bg-brand-muted transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            <span className="text-xs text-ink-secondary">{t("print_max", lang)}</span>
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
          <button
            onClick={handlePrint}
            disabled={loading}
            className="btn-primary flex-[2]"
          >
            <Printer size={15} />
            {loading
              ? "Printing…"
              : `${t("print_btn", lang)} ${copies} ${copies === 1 ? t("print_label", lang) : t("print_labels", lang)}`
            }
          </button>
        </div>

      </div>
    </div>
  );
}