import { useState } from "react";
import { format, isToday, isThisWeek } from "date-fns";
import { FileDown, Search, FileText } from "lucide-react";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";
import type { PrintJob } from "@/lib/types";
import clsx from "clsx";

const typeColors: Record<string, { bg: string; text: string }> = {
  ervenyesseg:   { bg: "rgba(29,158,117,0.12)",  text: "#5DCAA5" },
  bontas:        { bg: "rgba(239,159,39,0.12)",   text: "#EF9F27" },
  termek_leiras: { bg: "rgba(55,138,221,0.12)",   text: "#378ADD" },
  custom:        { bg: "rgba(127,119,221,0.12)",  text: "#7F77DD" },
};

const typeLabels: Record<string, string> = {
  ervenyesseg:   "Érvényes",
  bontas:        "Bontás",
  termek_leiras: "Termék leírás",
  custom:        "Custom",
};

type Filter = "all" | "today" | "week";

function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 rounded-lg border border-app-border bg-app-surface">
      <span className="text-xl font-medium text-ink-primary">{value}</span>
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>{label}</span>
    </div>
  );
}

function JobRow({ job, lang }: { job: PrintJob; lang: "en" | "hu" }) {
  const colors = typeColors[job.labelType] ?? typeColors.custom;
  return (
    <tr className="border-b hover:bg-white/[0.02] transition-colors"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <td className="py-3 pr-4 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
        {format(new Date(job.printedAt), "dd.MM.yyyy")}
      </td>
      <td className="py-3 pr-4 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
        {format(new Date(job.printedAt), "HH:mm")}
      </td>
      <td className="py-3 pr-4">
        <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.92)" }}>
          {job.templateName}
        </span>
      </td>
      <td className="py-3 pr-4">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: colors.bg, color: colors.text }}>
          {typeLabels[job.labelType] ?? job.labelType}
        </span>
      </td>
      <td className="py-3 pr-4 text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
        ×{job.copies}
      </td>
      <td className="py-3 pr-4 text-xs" style={{ color: "#5DCAA5" }}>
        {job.expiryDate !== job.preparedDate ? job.expiryDate : "—"}
      </td>
      <td className="py-3 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
        {job.operatorName ?? "—"}
      </td>
    </tr>
  );
}

export default function LogPage() {
  const lang   = useStore((s) => s.settings.language);
  const jobs   = useStore((s) => s.printJobs);

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

  const todayCount  = jobs.filter((j) => isToday(new Date(j.printedAt))).reduce((s, j) => s + j.copies, 0);
  const weekCount   = jobs.filter((j) => isThisWeek(new Date(j.printedAt), { weekStartsOn: 1 })).reduce((s, j) => s + j.copies, 0);
  const totalCount  = jobs.reduce((s, j) => s + j.copies, 0);

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

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-app-border">
        <h1 className="text-xl font-medium text-ink-primary">{t("nav_log", lang)}</h1>
        <button onClick={exportCSV} className="btn-ghost py-1.5 px-3 text-sm rounded-md">
          <FileDown size={14} />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 px-6 pt-4 flex-shrink-0">
        <StatCard value={todayCount} label="Printed today" />
        <StatCard value={weekCount}  label="This week" />
        <StatCard value={totalCount} label="Total" />
      </div>

      {/* Filtri + ricerca */}
      <div className="flex items-center gap-3 px-6 pt-3 pb-1 flex-shrink-0">
        <div className="flex gap-1 p-0.5 rounded-lg border border-app-border bg-app-surface">
          {(["all", "today", "week"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-3 py-1.5 rounded-md text-xs transition-colors",
                filter === f
                  ? "bg-brand text-white"
                  : "text-ink-secondary hover:text-ink-primary"
              )}
            >
              {f === "all" ? "All" : f === "today" ? "Today" : "This week"}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "rgba(255,255,255,0.28)" }} />
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
            <FileText size={32} style={{ color: "rgba(255,255,255,0.1)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.28)" }}>
              {jobs.length === 0 ? "No prints logged yet." : "No results for this filter."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                {["Date", "Time", "Product", "Type", "Copies", "Expiry", "Operator"].map((h) => (
                  <th key={h} className="text-left py-2 pr-4 font-medium"
                    style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {h}
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