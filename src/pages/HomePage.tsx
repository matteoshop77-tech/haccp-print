import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Printer, Plus, Minus } from "lucide-react";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";
import type { LabelTemplate } from "@/lib/types";
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

/* ── Bontás quick card — fixed first slot ── */
function BontasQuickCard({ onPrinted }: { onPrinted: () => void }) {
  const [copies, setCopies] = useState(1);
  const addPrintJob = useStore((s) => s.addPrintJob);
  const settings    = useStore((s) => s.settings);
  const today       = format(new Date(), "dd.MM.yyyy");

  const handlePrint = () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (settings.haccpLogEnabled) {
      addPrintJob({
        templateId:   "bontas-fixed",
        templateName: "Bontás napja",
        labelType:    "bontas",
        copies,
        preparedDate: todayStr,
        expiryDate:   todayStr,
        operatorName: settings.operatorName || null,
      });
    }
    onPrinted();
  };

  return (
    <div className="rounded-lg p-2.5 flex flex-col justify-between gap-2"
      style={{ background: "#FDF3E3", border: "1px solid #E8B96A" }}>
      {/* Top */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#E8B96A" }} />
          <p className="text-xs font-semibold text-ink-primary truncate leading-tight">Bontás napja</p>
        </div>
        <span className="text-xs flex-shrink-0 font-medium" style={{ fontSize: "10px", color: "#D4850A" }}>
          Bontás
        </span>
      </div>
      <p className="text-xs" style={{ fontSize: "10px", color: "#C8943A" }}>{today}</p>
      {/* Bottom */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setCopies((c) => Math.max(1, c - 1))}
          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(212,133,10,0.12)" }}
        >
          <Minus size={9} style={{ color: "#D4850A" }} />
        </button>
        <span className="text-xs font-semibold w-4 text-center tabular-nums text-ink-primary">{copies}</span>
        <button
          onClick={() => setCopies((c) => Math.min(99, c + 1))}
          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(212,133,10,0.12)" }}
        >
          <Plus size={9} style={{ color: "#D4850A" }} />
        </button>
        <button
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded font-semibold text-white ml-0.5"
          style={{ background: "#D4850A", fontSize: "10px" }}
        >
          <Printer size={9} />
          Print
        </button>
      </div>
    </div>
  );
}

/* ── Quick card — compact horizontal ── */
function QuickCard({ template, onPrinted }: {
  template: LabelTemplate;
  onPrinted: (name: string) => void;
}) {
  const [copies, setCopies] = useState(1);
  const addPrintJob = useStore((s) => s.addPrintJob);
  const settings    = useStore((s) => s.settings);

  const handlePrint = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    if (settings.haccpLogEnabled) {
      addPrintJob({
        templateId:   template.id,
        templateName: template.name,
        labelType:    template.type,
        copies,
        preparedDate: today,
        expiryDate:   today,
        operatorName: settings.operatorName || null,
      });
    }
    onPrinted(template.name);
  };

  return (
    <div className="card p-2.5 flex flex-col justify-between gap-2">
      {/* Top: dot + name + type badge */}
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
      {/* Meta */}
      <p className="text-ink-muted truncate" style={{ fontSize: "10px" }}>
        {template.shelfLifeDays}d · {template.category}
      </p>
      {/* Bottom: qty + print */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setCopies((c) => Math.max(1, c - 1))}
          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(0,0,0,0.06)" }}
        >
          <Minus size={9} className="text-ink-secondary" />
        </button>
        <span className="text-xs font-semibold w-4 text-center tabular-nums text-ink-primary">{copies}</span>
        <button
          onClick={() => setCopies((c) => Math.min(99, c + 1))}
          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(0,0,0,0.06)" }}
        >
          <Plus size={9} className="text-ink-secondary" />
        </button>
        <button
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-white font-semibold ml-0.5"
          style={{ background: "#1D9E75", fontSize: "10px" }}
        >
          <Printer size={9} />
          Print
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
  const navigate    = useNavigate();
  const lang        = useStore((s) => s.settings.language);
  const settings    = useStore((s) => s.settings);
  const templates   = useStore((s) => s.templates);
  const printJobs   = useStore((s) => s.printJobs);

  const pinnedTmpl  = templates.filter((tmpl) => tmpl.pinned);
  const recentJobs  = printJobs.slice(0, 4);
  const today       = new Date().toISOString().slice(0, 10);
  const todayCount  = printJobs.filter((j) => j.printedAt.startsWith(today)).reduce((sum, j) => sum + j.copies, 0);
  const expiring    = 0;
  const lastPrint   = recentJobs[0] ? format(new Date(recentJobs[0].printedAt), "HH:mm") : "—";
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
          <span className="badge-brand text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
            Brother QL-800 · {t("online", lang)}
          </span>
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
          {/* Bontás sempre primo, fisso */}
          <BontasQuickCard onPrinted={() => showToast("Bontás printed ✓")} />

          {/* Prodotti pinnati */}
          {pinnedTmpl.map((tmpl) => (
            <QuickCard
              key={tmpl.id}
              template={tmpl}
              onPrinted={(name) => showToast(`${name} ✓`)}
            />
          ))}

          {/* Add new */}
          <AddCard onClick={() => navigate("/labels")} />
        </div>

        {/* Recent prints */}
        {recentJobs.length > 0 && (
          <div className="mt-4">
            <p className="section-label mb-2">{t("home_recent", lang)}</p>
            {recentJobs.map((job) => {
              const tmpl = templates.find((t) => t.id === job.templateId);
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: "#1D9E75" }}>
          {toast}
        </div>
      )}
    </div>
  );
}