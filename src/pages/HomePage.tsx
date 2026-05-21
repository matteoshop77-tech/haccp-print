import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays, isTomorrow } from "date-fns";
import { Printer, Plus, Minus } from "lucide-react";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";
import type { LabelTemplate } from "@/lib/types";
import { printLabel } from "@/lib/printService";
import clsx from "clsx";

/* ── Stat card ── */
function StatCard({ value, label, accent = false }: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="card px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
      <span className={clsx("text-lg font-medium", accent ? "text-brand" : "text-ink-primary")}>
        {value}
      </span>
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  );
}

/* ── Label type dot color + label ── */
const typeDot: Record<string, string> = {
  ervenyesseg:   "#6BCBA8",
  bontas:        "#E8B96A",
  termek_leiras: "#7AADE8",
  custom:        "#A89FE8",
};

const typeLabel: Record<string, string> = {
  ervenyesseg:   "Érvényes",
  bontas:        "Bontás",
  termek_leiras: "Termék leírás",
  custom:        "Custom",
};

/* ── Quantity input — shared between both card types ── */
function CopiesInput({
  value,
  onChange,
  accentColor,
}: {
  value: number;
  onChange: (n: number) => void;
  accentColor?: string;
}) {
  const bg = accentColor ? `rgba(212,133,10,0.12)` : "rgba(0,0,0,0.06)";
  const iconColor = accentColor ?? undefined;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw === "") { onChange(1); return; }
    const n = Math.min(999, Math.max(1, parseInt(raw, 10)));
    onChange(n);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === "" || parseInt(e.target.value, 10) < 1) onChange(1);
  };

  return (
    <>
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
        style={{ background: bg }}
      >
        <Minus size={9} style={iconColor ? { color: iconColor } : undefined}
          className={iconColor ? undefined : "text-ink-secondary"} />
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={(e) => e.target.select()}
        className="text-xs font-semibold text-center tabular-nums text-ink-primary bg-transparent border-0 outline-none"
        style={{ width: "28px" }}
      />

      <button
        onClick={() => onChange(Math.min(999, value + 1))}
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
        style={{ background: bg }}
      >
        <Plus size={9} style={iconColor ? { color: iconColor } : undefined}
          className={iconColor ? undefined : "text-ink-secondary"} />
      </button>
    </>
  );
}

/* ── Bontás quick card — fixed first slot ── */
function BontasQuickCard({ onPrinted }: { onPrinted: () => void }) {
  const [copies, setCopies]   = useState(1);
  const [loading, setLoading] = useState(false);
  const addPrintJob = useStore((s) => s.addPrintJob);
  const settings    = useStore((s) => s.settings);
  const lang        = useStore((s) => s.settings.language);
  const today       = format(new Date(), "dd.MM.yyyy");

  const handlePrint = async () => {
    setLoading(true);
    const now = new Date();

    const bontasTemplate: LabelTemplate = {
      id:            "bontas-fixed",
      name:          lang === "hu" ? "Bontás napja" : "Opening date",
      category:      lang === "hu" ? "Bontás" : "Opening date",
      type:          "bontas",
      shelfLifeDays: 0,
      description:   null,
      allergens:     null,
      profile:       settings.profile,
      pinned:        false,
      printCount:    0,
      createdAt:     now.toISOString(),
      updatedAt:     now.toISOString(),
    };

    const result = await printLabel(bontasTemplate, copies, now, lang, settings.printerName);
    setLoading(false);

    if (result.success && settings.haccpLogEnabled) {
      const todayStr = format(now, "yyyy-MM-dd");
      addPrintJob({
        templateId:   "bontas-fixed",
        templateName: lang === "hu" ? "Bontás napja" : "Opening date",
        labelType:    "bontas",
        copies,
        preparedDate: todayStr,
        expiryDate:   todayStr,
        operatorName: settings.operatorName || null,
      });
    }
    if (result.success) onPrinted();
  };

  return (
    <div className="rounded-lg p-2.5 flex flex-col justify-between gap-2"
      style={{ background: "#FDF3E3", border: "1px solid #E8B96A" }}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#E8B96A" }} />
          <p className="text-xs font-semibold text-ink-primary truncate leading-tight">{lang === "hu" ? "Bontás napja" : "Opening date"}</p>
        </div>
        <span className="flex-shrink-0 font-medium" style={{ fontSize: "10px", color: "#D4850A" }}>
          {lang === "hu" ? "Bontás" : "Opening date"}
        </span>
      </div>
      <p style={{ fontSize: "10px", color: "#C8943A" }}>{today}</p>
      <div className="flex items-center gap-1">
        <CopiesInput value={copies} onChange={setCopies} accentColor="#D4850A" />
        <button
          onClick={handlePrint}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded font-semibold text-white ml-0.5 disabled:opacity-50"
          style={{ background: "#D4850A", fontSize: "10px" }}
        >
          <Printer size={9} />
          {loading ? "…" : "Print"}
        </button>
      </div>
    </div>
  );
}

/* ── Quick card — inline print ── */
function QuickCard({ template, onPrinted }: {
  template: LabelTemplate;
  onPrinted: (name: string) => void;
}) {
  const [copies, setCopies]   = useState(1);
  const [loading, setLoading] = useState(false);
  const addPrintJob = useStore((s) => s.addPrintJob);
  const settings    = useStore((s) => s.settings);
  const lang        = useStore((s) => s.settings.language);

  const handlePrint = async () => {
    setLoading(true);
    const now    = new Date();
    const result = await printLabel(template, copies, now, lang, settings.printerName);
    setLoading(false);

    if (result.success && settings.haccpLogEnabled) {
      const preparedStr = format(now, "yyyy-MM-dd");
      const expiryStr   = format(addDays(now, template.shelfLifeDays), "yyyy-MM-dd");
      addPrintJob({
        templateId:   template.id,
        templateName: template.name,
        labelType:    template.type,
        copies,
        preparedDate: preparedStr,
        expiryDate:   expiryStr,
        operatorName: settings.operatorName || null,
      });
    }
    if (result.success) onPrinted(template.name);
  };

  return (
    <div className="card p-2.5 flex flex-col justify-between gap-2">
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: typeDot[template.type] }}
          />
          <p className="text-xs font-semibold text-ink-primary truncate leading-tight">{template.name}</p>
        </div>
        <span className="text-ink-muted flex-shrink-0" style={{ fontSize: "10px" }}>
          {typeLabel[template.type]}
        </span>
      </div>
      <p className="text-ink-muted truncate" style={{ fontSize: "10px" }}>
        {template.shelfLifeDays}d · {template.category}
      </p>
      <div className="flex items-center gap-1">
        <CopiesInput value={copies} onChange={setCopies} />
        <button
          onClick={handlePrint}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-white font-semibold ml-0.5 disabled:opacity-50"
          style={{ background: "#1D9E75", fontSize: "10px" }}
        >
          <Printer size={9} />
          {loading ? "…" : "Print"}
        </button>
      </div>
    </div>
  );
}

/* ── Add new card ── */
function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card-interactive flex flex-col items-center justify-center gap-1.5 border-dashed py-4"
    >
      <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-black/5">
        <Plus size={12} className="text-ink-muted" />
      </div>
      <p className="text-xs font-medium text-ink-muted">Add new</p>
    </button>
  );
}

/* ── Recent row ── */
function RecentRow({ job, onReprint }: {
  job: import("@/lib/types").PrintJob;
  onReprint: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-app-border last:border-0">
      <div className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-primary truncate">{job.templateName} × {job.copies}</p>
        <p className="text-xs text-ink-muted mt-0.5">{job.labelType} · {format(new Date(job.printedAt), "HH:mm")}</p>
      </div>
      <button
        onClick={onReprint}
        className="text-xs text-ink-muted border border-app-border px-2.5 py-1 rounded
                   hover:text-brand hover:border-brand/30 transition-colors flex-shrink-0"
      >
        Reprint
      </button>
    </div>
  );
}

/* ── Home page ── */
export default function HomePage() {
  const navigate   = useNavigate();
  const lang       = useStore((s) => s.settings.language);
  const settings   = useStore((s) => s.settings);
  const templates  = useStore((s) => s.templates);
  const printJobs  = useStore((s) => s.printJobs);

  const pinnedTmpl  = templates.filter((tmpl) => tmpl.pinned);
  const recentJobs  = printJobs.slice(0, 4);
  const today       = new Date().toISOString().slice(0, 10);
  const todayCount  = printJobs
    .filter((j) => j.printedAt.startsWith(today))
    .reduce((sum, j) => sum + j.copies, 0);

  const expiring = printJobs.filter((j) => {
    if (!j.expiryDate || j.expiryDate === j.preparedDate) return false;
    return isTomorrow(new Date(j.expiryDate));
  }).length;

  const lastPrint    = recentJobs[0] ? format(new Date(recentJobs[0].printedAt), "HH:mm") : "—";
  const profileLabel = t(`profile_${settings.profile}` as Parameters<typeof t>[0], lang);

  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden gap-3 py-4">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <p className="section-label mb-0.5">{profileLabel} {t("home_profile", lang)}</p>
          <h1 className="text-lg font-medium text-ink-primary">{t("home_greeting", lang)}</h1>
        </div>
        <div className="flex items-center gap-2">
          {settings.printerName ? (
            <span className="badge-brand text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
              {settings.printerName} · {t("printer_ready", lang)}
            </span>
          ) : (
            <button
              onClick={() => navigate("/settings")}
              className="text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1.5 transition-colors"
              style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}
              title={t("printer_no_brother", lang)}
            >
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#B91C1C" }} />
              {t("printer_no_driver", lang)}
            </button>
          )}
          {settings.operatorName && (
            <div className="w-8 h-8 rounded-full bg-app-surface border border-app-border
                            flex items-center justify-center text-xs text-ink-muted font-medium">
              {settings.operatorName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 px-6 flex-shrink-0">
        <StatCard value={todayCount} label={t("home_printed_today", lang)} />
        <StatCard value={expiring}   label={t("home_expiring", lang)} accent />
        <StatCard value={templates.length} label={t("home_saved", lang)} />
        <StatCard value={lastPrint}  label={t("home_last_print", lang)} />
      </div>

      {/* Quick access */}
      <div className="px-6 flex-shrink-0">
        <p className="section-label mb-2">{t("home_quick_access", lang)}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 min-h-0">
        <div className="grid grid-cols-5 gap-2">
          <BontasQuickCard onPrinted={() => showToast("Bontás printed ✓")} />
          {pinnedTmpl.map((tmpl) => (
            <QuickCard
              key={tmpl.id}
              template={tmpl}
              onPrinted={(name) => showToast(`${name} ✓`)}
            />
          ))}
          <AddCard onClick={() => navigate("/labels")} />
        </div>

        {recentJobs.length > 0 && (
          <div className="mt-4">
            <p className="section-label mb-2">{t("home_recent", lang)}</p>
            {recentJobs.map((job) => {
              templates.find((t) => t.id === job.templateId);
              return (
                <RecentRow
                  key={job.id}
                  job={job}
                  onReprint={() => showToast(`${job.templateName} ✓`)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Print button */}
      <div className="px-6 flex-shrink-0">
        <button
          onClick={() => navigate("/labels")}
          className="btn-primary w-full py-2.5 text-sm rounded-lg"
        >
          <Printer size={15} />
          {t("home_new_job", lang)}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: "#1D9E75" }}>
          {toast}
        </div>
      )}
    </div>
  );
}