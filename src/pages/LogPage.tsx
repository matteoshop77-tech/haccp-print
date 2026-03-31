import { useState } from "react";
import { format } from "date-fns";
import { FileDown, Search } from "lucide-react";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";

export default function LogPage() {
  const lang     = useStore((s) => s.settings.language);
  const jobs     = useStore((s) => s.printJobs);
  const [search, setSearch] = useState("");

  const filtered = jobs.filter((j) =>
    j.templateName.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const header = "Date,Time,Product,Type,Copies,Prepared,Expiry,Operator";
    const rows = jobs.map((j) => [
      format(new Date(j.printedAt), "yyyy-MM-dd"),
      format(new Date(j.printedAt), "HH:mm"),
      j.templateName,
      j.labelType,
      j.copies,
      j.preparedDate,
      j.expiryDate,
      j.operatorName ?? "",
    ].join(","));
    const csv = [header, ...rows].join("\n");
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
        <h1 className="text-xl font-medium text-ink-primary">
          {t("nav_log", lang)}
        </h1>
        <button onClick={exportCSV} className="btn-ghost py-1.5 px-3 text-sm rounded-md">
          <FileDown size={14} />
          Export CSV
        </button>
      </div>

      {/* Search */}
      <div className="px-6 py-3 flex-shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search", lang)}
            className="input pl-8 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-12">
            {jobs.length === 0 ? "No prints logged yet." : "No results."}
          </p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-app-border">
                {["Date", "Time", "Product", "Type", "Copies", "Expiry", "Operator"].map((h) => (
                  <th key={h} className="text-left py-2 pr-4 text-xs text-ink-muted font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr key={job.id} className="border-b border-app-border/50 hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-4 text-ink-muted text-xs">
                    {format(new Date(job.printedAt), "dd.MM.yyyy")}
                  </td>
                  <td className="py-2.5 pr-4 text-ink-muted text-xs">
                    {format(new Date(job.printedAt), "HH:mm")}
                  </td>
                  <td className="py-2.5 pr-4 text-ink-primary font-medium">
                    {job.templateName}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="badge-brand text-2xs">
                      {t(`type_${job.labelType}` as Parameters<typeof t>[0], lang)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-ink-secondary">{job.copies}</td>
                  <td className="py-2.5 pr-4 text-brand-light text-xs">{job.expiryDate}</td>
                  <td className="py-2.5 text-ink-muted text-xs">{job.operatorName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
