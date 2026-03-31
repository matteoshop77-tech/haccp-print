import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Printer, Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";
import type { LabelTemplate } from "@/lib/types";
import { PrintModal } from "@/components/labels/PrintModal";
import clsx from "clsx";

/* ── Stat card ── */
function StatCard({ value, label, accent = false }: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="card px-3.5 py-3 flex flex-col gap-0.5 min-w-0">
      <span className={clsx("text-xl font-medium", accent ? "text-brand-light" : "text-ink-primary")}>
        {value}
      </span>
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  );
}

/* ── Label type accent color ── */
const typeColor: Record<string, string> = {
  ervenyesseg:   "bg-brand",
  bontas:        "bg-amber",
  termek_leiras: "bg-sky",
  custom:        "bg-violet",
};

/* ── Quick access card ── */
function QuickCard({
  template,
  onSelect,
}: {
  template: LabelTemplate;
  onSelect: (t: LabelTemplate) => void;
}) {
  return (
    <button
      onClick={() => onSelect(template)}
      className="card-interactive p-3.5 text-left flex flex-col gap-2 w-full"
    >
      <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center", typeColor[template.type] + "/15")}>
        <div className={clsx("w-2 h-2 rounded-full", typeColor[template.type])} />
      </div>
      <div>
        <p className="text-sm font-medium text-ink-primary truncate">{template.name}</p>
        <p className="text-xs text-ink-muted mt-0.5">
          {template.shelfLifeDays}d · {template.category}
        </p>
      </div>
    </button>
  );
}

/* ── Add new card ── */
function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card-interactive p-3.5 text-left flex flex-col gap-2 w-full border-dashed"
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5">
        <Plus size={14} className="text-ink-muted" />
      </div>
      <div>
        <p className="text-sm font-medium text-ink-muted">Add new</p>
        <p className="text-xs text-ink-faint mt-0.5">Create label</p>
      </div>
    </button>
  );
}

/* ── Recent row ── */
function RecentRow({
  job,
  onReprint,
}: {
  job: import("@/lib/types").PrintJob;
  onReprint: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-app-border last:border-0">
      <div className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-primary truncate">
          {job.templateName} × {job.copies}
        </p>
        <p className="text-xs text-ink-muted mt-0.5">
          {job.labelType} · {format(new Date(job.printedAt), "HH:mm")}
        </p>
      </div>
      <button
        onClick={onReprint}
        className="text-xs text-ink-faint border border-app-border px-2.5 py-1 rounded
                   hover:text-brand-light hover:border-brand/30 transition-colors"
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
  const pinnedTmpl = templates.filter((tmpl) => tmpl.pinned).slice(0, 3);
  const recentJobs = printJobs.slice(0, 4);
  const today      = new Date().toISOString().slice(0, 10);
  const todayCount = printJobs.filter((j) => j.printedAt.startsWith(today)).reduce((sum, j) => sum + j.copies, 0);
  const expiring   = 0;

  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate | null>(null);
  const lastPrint = recentJobs[0]
    ? format(new Date(recentJobs[0].printedAt), "HH:mm")
    : "—";

  const profileLabel = t(`profile_${settings.profile}` as Parameters<typeof t>[0], lang);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-5 pb-0 flex-shrink-0">
        <div>
          <p className="section-label mb-0.5">{profileLabel} {t("home_profile", lang)}</p>
          <h1 className="text-xl font-medium text-ink-primary">{t("home_greeting", lang)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-brand text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-light inline-block" />
            Brother QL-800 · {t("online", lang)}
          </span>
          {settings.operatorName && (
            <div className="w-8 h-8 rounded-full bg-app-surface border border-app-border
                            flex items-center justify-center text-xs text-ink-muted">
              {settings.operatorName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2.5 px-6 mt-4 flex-shrink-0">
        <StatCard value={todayCount} label={t("home_printed_today", lang)} />
        <StatCard value={expiring}   label={t("home_expiring", lang)} accent />
        <StatCard value={templates.length} label={t("home_saved", lang)} />
        <StatCard value={lastPrint}  label={t("home_last_print", lang)} />
      </div>

      {/* Quick access */}
      <div className="px-6 mt-5 flex-shrink-0">
        <p className="section-label mb-2.5">{t("home_quick_access", lang)}</p>
        <div className="grid grid-cols-4 gap-2">
          {pinnedTmpl.slice(0, 3).map((tmpl) => (
            <QuickCard key={tmpl.id} template={tmpl} onSelect={setSelectedTemplate} />
          ))}
          <AddCard onClick={() => navigate("/labels")} />
        </div>
      </div>

      {/* Recent prints */}
      <div className="px-6 mt-5 flex-shrink-0">
        <p className="section-label mb-2">{t("home_recent", lang)}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-2">
        {recentJobs.length === 0 ? (
          <p className="text-sm text-ink-muted py-4 text-center">No prints yet today</p>
        ) : (
          recentJobs.map((job) => {
            const tmpl = templates.find((t) => t.id === job.templateId);
            return (
              <RecentRow
                key={job.id}
                job={job}
                onReprint={() => tmpl && setSelectedTemplate(tmpl)}
              />
            );
          })
        )}
      </div>

      {/* Print button */}
      <div className="px-6 pb-5 pt-2 flex-shrink-0">
        <button
          onClick={() => navigate("/labels")}
          className="btn-primary w-full py-3 text-base rounded-lg"
        >
          <Printer size={16} />
          {t("home_new_job", lang)}
        </button>
      </div>

      {/* Print modal */}
      {selectedTemplate && (
        <PrintModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </div>
  );
}
