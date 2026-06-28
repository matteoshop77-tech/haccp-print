import { useState } from "react";
import { Check } from "lucide-react";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";
import type { LabelType } from "@/lib/types";
import clsx from "clsx";

const typeDot: Record<LabelType, string> = {
  ervenyesseg:   "#6BCBA8",
  bontas:        "#E8B96A",
  termek_leiras: "#7AADE8",
  custom:        "#A89FE8",
};

/* ── Bulk panel: assign visibility to unassigned labels (M3) ──
 * Rendered below the connected-apps list. Lists templates with NO visibility
 * row, lets the owner search + multi-select them and assign to one or more
 * connected apps in one shot. Assigned labels drop out of the list via the
 * store's reactive templateVisibility update. Hidden when no apps connected. */
export default function UnassignedLabelsPanel({ lang }: { lang: "en" | "hu" }) {
  const templates            = useStore((s) => s.templates);
  const templateVisibility   = useStore((s) => s.templateVisibility);
  const connectedApps        = useStore((s) => s.connectedApps);
  const assignVisibilityBulk = useStore((s) => s.assignVisibilityBulk);

  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo]     = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState("");

  if (connectedApps.length === 0) return null;

  // A label counts as "assigned" only if it is visible to at least one ACTIVE
  // app. Visibility rows toward revoked apps don't keep it out of the bulk panel.
  const activeAppIds = new Set(connectedApps.map((a) => a.id));
  const isAssigned = (id: string) =>
    (templateVisibility[id] ?? []).some((appId) => activeAppIds.has(appId));
  // System templates (e.g. "Bontás napja") are always auto-assigned and not user-
  // managed → never list them here, even though they're technically always assigned.
  const unassigned = templates.filter((tmpl) => !tmpl.isSystemTemplate && !isAssigned(tmpl.id));
  const searchLower = search.toLowerCase();
  const visible = unassigned.filter(
    (tmpl) => !searchLower || tmpl.name.toLowerCase().includes(searchLower)
  );

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAssign = (id: string) =>
    setAssignTo((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectAllVisible = () => setSelected(new Set(visible.map((tmpl) => tmpl.id)));
  const clearSelection   = () => setSelected(new Set());

  const canApply = selected.size > 0 && assignTo.length > 0;

  const apply = () => {
    if (!canApply) return;
    const count = selected.size;
    const apps = assignTo.length;
    assignVisibilityBulk([...selected], assignTo);
    setSelected(new Set());
    setAssignTo([]);
    setSearch("");
    setSuccessMsg(
      t("connected_apps_unassigned_success", lang)
        .replace("{count}", String(count))
        .replace("{apps}", String(apps))
    );
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div className="pt-5 mt-1 border-t border-app-border flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-ink-primary">
          {t("connected_apps_unassigned_title", lang)}
        </h3>
        <p className="text-xs text-ink-muted mt-0.5">
          {t("connected_apps_unassigned_sub", lang)}
        </p>
      </div>

      {successMsg && (
        <p className="text-xs text-brand-light bg-brand-muted border border-brand/20 rounded-md px-3 py-2">
          {successMsg} ✓
        </p>
      )}

      {unassigned.length === 0 ? (
        <div className="px-4 py-5 bg-app-surface border border-app-border rounded-lg text-center">
          <p className="text-sm text-ink-muted">{t("connected_apps_unassigned_empty", lang)}</p>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("connected_apps_unassigned_search_placeholder", lang)}
            className="input text-sm"
          />

          <div className="flex items-center gap-3 text-xs">
            <button onClick={selectAllVisible} className="text-brand-light hover:underline">
              {t("connected_apps_unassigned_select_all", lang)}
            </button>
            <button onClick={clearSelection} className="text-ink-muted hover:underline">
              {t("connected_apps_unassigned_clear", lang)}
            </button>
            <span className="text-ink-muted ml-auto tabular-nums">
              {selected.size} / {visible.length}
            </span>
          </div>

          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {visible.map((tmpl) => {
              const checked = selected.has(tmpl.id);
              return (
                <button
                  key={tmpl.id}
                  onClick={() => toggleSelect(tmpl.id)}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors",
                    checked
                      ? "border-brand/40 bg-brand-muted/40"
                      : "border-app-border bg-app-surface hover:border-app-border-hover"
                  )}
                >
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border"
                    style={checked
                      ? { background: "#1D9E75", borderColor: "#1D9E75" }
                      : { borderColor: "#d4d4d4" }}
                  >
                    {checked && <Check size={11} className="text-white" />}
                  </span>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeDot[tmpl.type] }} />
                  <span className="text-sm text-ink-primary truncate flex-1">{tmpl.name}</span>
                  <span className="text-ink-muted flex-shrink-0" style={{ fontSize: "10px" }}>
                    {t(`type_${tmpl.type}` as Parameters<typeof t>[0], lang)}
                  </span>
                </button>
              );
            })}
            {visible.length === 0 && (
              <p className="text-xs text-ink-muted px-1 py-2">—</p>
            )}
          </div>

          <div className="pt-2 border-t border-app-border">
            <p className="section-label mb-2">{t("connected_apps_unassigned_assign_to", lang)}</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {connectedApps.map((app) => {
                const checked = assignTo.includes(app.id);
                return (
                  <button
                    key={app.id}
                    onClick={() => toggleAssign(app.id)}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors",
                      checked
                        ? "bg-brand text-white border-brand"
                        : "bg-app-surface border-app-border text-ink-secondary hover:border-brand hover:text-brand"
                    )}
                    style={checked ? { background: "#1D9E75", borderColor: "#1D9E75" } : undefined}
                  >
                    {checked && <Check size={12} />}
                    {app.orgName}
                  </button>
                );
              })}
            </div>
            <button
              onClick={apply}
              disabled={!canApply}
              className="btn-primary self-start text-sm disabled:opacity-50"
            >
              {t("connected_apps_unassigned_apply", lang)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
