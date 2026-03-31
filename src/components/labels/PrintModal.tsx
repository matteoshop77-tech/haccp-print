import { useState } from "react";
import { format, addDays } from "date-fns";
import { Printer, X, Minus, Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import { printLabel, formatLabelDate } from "@/lib/printService";
import { t } from "@/lib/i18n";
import type { LabelTemplate } from "@/lib/types";
import clsx from "clsx";

function LabelPreview({ template, preparedDate }: {
  template: LabelTemplate;
  preparedDate: Date;
}) {
  const expiryDate = addDays(preparedDate, template.shelfLifeDays);
  return (
    <div className="bg-white rounded-lg px-4 py-3 relative overflow-hidden">
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-5 bg-app-bg rounded-l-full" />
      <p className="text-[9px] text-black/30 uppercase tracking-widest font-mono mb-1.5">HACCPrint</p>
      <p className="text-[17px] font-bold text-black leading-tight tracking-tight">{template.name}</p>
      {template.description && (
        <p className="text-[10px] text-black/50 mt-1 leading-snug">{template.description}</p>
      )}
      <div className="h-px bg-black/10 my-2.5" />
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] text-black/40 uppercase tracking-wide">Prepared</p>
          <p className="text-[12px] font-semibold text-black">{formatLabelDate(preparedDate)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-black/40 uppercase tracking-wide">Use by</p>
          <p className="text-[12px] font-semibold text-[#0F6E56]">{formatLabelDate(expiryDate)}</p>
        </div>
      </div>
      {template.allergens && (
        <p className="text-[9px] text-black/35 mt-2 leading-snug">Allergens: {template.allergens}</p>
      )}
    </div>
  );
}

const typeBadge: Record<string, string> = {
  ervenyesseg:   "badge-brand",
  bontas:        "badge-amber",
  termek_leiras: "bg-sky/10 text-sky border border-sky/20",
  custom:        "bg-violet/10 text-violet border border-violet/20",
};

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
    const result = await printLabel(template, copies, today, lang);
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

        {/* Anteprima */}
        <div className="p-5 pb-3">
          <LabelPreview template={template} preparedDate={today} />
        </div>

        {/* Controlli */}
        <div className="px-5 pb-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-secondary w-24 flex-shrink-0">Expires in</span>
            <span className="text-sm text-brand-light font-medium">
              {template.shelfLifeDays} {t("days", lang)} → {formatLabelDate(expiry)}
            </span>
          </div>

          {/* Copie con + e - */}
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