import { useState } from "react";
import { format, isToday, isThisWeek } from "date-fns";
import { FileDown, Search, FileText } from "lucide-react";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";
import type { PrintJob } from "@/lib/types";
import clsx from "clsx";

const typeColors: Record<string, { bg: string; text: string }> = {
  ervenyesseg:   { bg: "rgba(29,158,117,0.12)",  text: "#0F7A5A" },
  bontas:        { bg: "rgba(212,133,10,0.12)",   text: "#A86800" },
  termek_leiras: { bg: "rgba(46,123,196,0.12)",   text: "#1A5FA0" },
  custom:        { bg: "rgba(107,99,204,0.12)",   text: "#4A44AA" },
};

type Filter = "all" | "today" | "week";

function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 rounded-lg border border-app-border bg-app-surface">
      <span className="text-xl font-medium text-ink-primary">{value}</span>
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  );
}

function JobRow({ job, lang }: { job: PrintJob; lang: "en" | "hu" }) {
  const colors = typeColors[job.labelType] ?? typeColors.custom;
  return (
    <tr className="border-b border-app-border hover:bg-black/[0.02] transition-colors">
      <td className="py-3 pr-4 text-xs text-ink-muted">
        {format(new Date(job.printedAt), "dd.MM.yyyy")}
      </td>
      <td className="py-3 pr-4 text-xs text-ink-muted">
        {format(new Date(job.printedAt), "HH:mm")}
      </td>
      <td className="py-3 pr-4">
        <span className="text-sm font-medium text-ink-primary">
          {job.templateName}
        </span>
      </td>
      <td className="py-3 pr-4">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: colors.bg, color: colors.text }}>
          {t(`type_${job.labelType}` as Parameters<typeof t>[0], lang)}
        </span>
      </td>
      <td className="py-3 pr-4 text-sm font-medium text-ink-secondary">
        ×{job.copies}
      </td>
      <td className="py-3 pr-4 text-xs text-brand">
        {job.labelType === "bontas" || job.labelType === "custom"
          ? "—"
          : job.expiryDate ?? "—"}
      </td>
      <td className="py-3 text-xs text-ink-muted">
        {job.operatorName ?? "—"}
      </td>
    </tr>
  );
}

export default function LogPage() {
  const lang = useStore((s) => s.settings.language);
  const jobs = useStore((s) => s.printJobs);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filterJobs = (j: PrintJob) => {
    const date = new Date(j.printedAt);
    if (filter === "today") return isToday(date);
    if (filter === "week")  return isThisWeek(date, { weekStartsOn: 1 });
    return true;
  };

  const filtered = jobs
    .filter(filterJobs)
    .filter((j) => j.templateName.toLowerCase().includes(search.toLowerCase()));

  const todayCount = jobs.filter((j) => isToday(new Date(j.printedAt))).reduce((s, j) => s + j.copies, 0);
  const weekCount  = jobs.filter((j) => isThisWeek(new Date(j.printedAt), { weekStartsOn: 1 })).reduce((s, j) => s + j.copies, 0);
  const totalCount = jobs.reduce((s, j) => s + j.copies, 0);

  const exportCSV = () => {
    const header = "Date,Time,Product,Type,Copies,Prepared,Expiry,Operator";
    const rows = jobs.map((j) => [
      format(new Date(j.printedAt), "yyyy-MM-dd"),
      format(new Date(j.printedAt), "HH:mm"),
      `"${j.templateName}"`,
      j.labelType,
      j.copies,
      j.preparedDate,
      j.expiryDate,
      j.operatorName ?? "",
    ].join(","));
    const csv  = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `haccp-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filterKeys: { key: Filter; label: Parameters<typeof t>[0] }[] = [
    { key: "all",   label: "log_filter_all" },
    { key: "today", label: "log_filter_today" },
    { key: "week",  label: "log_filter_week" },
  ];

  const colHeaders: Parameters<typeof t>[0][] = [
    "log_col_date", "log_col_time", "log_col_product",
    "log_col_type", "log_col_copies", "log_col_expiry", "log_col_operator",
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-app-border">
        <h1 className="text-xl font-medium text-ink-primary">{t("nav_log", lang)}</h1>
        <button onClick={exportCSV} className="btn-ghost py-1.5 px-3 text-sm rounded-md">
          <FileDown size={14} />
          {t("log_export_csv", lang)}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 px-6 pt-4 flex-shrink-0">
        <StatCard value={todayCount} label={t("log_printed_today", lang)} />
        <StatCard value={weekCount}  label={t("log_this_week", lang)} />
        <StatCard value={totalCount} label={t("log_total", lang)} />
      </div>

      {/* Filtri + ricerca */}
      <div className="flex items-center gap-3 px-6 pt-3 pb-1 flex-shrink-0">
        <div className="flex gap-1 p-0.5 rounded-lg border border-app-border bg-app-surface">
          {filterKeys.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={clsx(
                "px-3 py-1.5 rounded-md text-xs transition-colors",
                filter === key
                  ? "bg-brand text-white"
                  : "text-ink-secondary hover:text-ink-primary"
              )}
            >
              {t(label, lang)}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search", lang)}
            className="input pl-8 text-sm py-1.5"
          />
        </div>
      </div>

      {/* Tabella */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText size={32} className="text-ink-faint" />
            <p className="text-sm text-ink-muted">
              {jobs.length === 0 ? t("log_empty", lang) : t("log_no_results", lang)}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-app-border">
                {colHeaders.map((h) => (
                  <th key={h} className="text-left py-2 pr-4 font-medium section-label">
                    {t(h, lang)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <JobRow key={job.id} job={job} lang={lang} />
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}