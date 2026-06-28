import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { t } from "@/lib/i18n";

// One active row of connected_apps. Mirrors the columns created in M0
// (see INTEGRATION-PLAN.md section 5.1). The raw token is never available here
// — only token_prefix, for display.
interface ConnectedApp {
  id: string;
  org_name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

/* ── Connected apps (Integrations) ──
 * View + revoke only. The /connect flow is initiated by the external app
 * (Planivo), NOT from HACCPrint — so there is intentionally NO create form here
 * (INTEGRATION-PLAN.md section 9.1). The owner session is already authenticated,
 * so RLS automatically scopes the query to account_id = auth.uid(). */
export default function ConnectedAppsSection({ lang }: { lang: "en" | "hu" }) {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokedMsg, setRevokedMsg] = useState(false);

  const loadApps = async () => {
    setError("");
    const { data, error } = await supabase
      .from("connected_apps")
      .select("id, org_name, token_prefix, created_at, last_used_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setApps([]);
    } else {
      setApps((data ?? []) as ConnectedApp[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleRevoke = async (id: string) => {
    const confirmed = window.confirm(t("connected_apps_revoke_confirm", lang));
    if (!confirmed) return;

    setRevokingId(id);
    setError("");
    const { error } = await supabase
      .from("connected_apps")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    setRevokingId(null);

    if (error) {
      setError(error.message);
      return;
    }
    setRevokedMsg(true);
    setTimeout(() => setRevokedMsg(false), 3000);
    await loadApps();
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "hu" ? "hu-HU" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-medium text-ink-primary">
          {t("connected_apps_title", lang)}
        </h2>
        <p className="text-xs text-ink-muted mt-1">{t("connected_apps_sub", lang)}</p>
      </div>

      {loading && (
        <p className="text-sm text-ink-muted px-1">
          {lang === "hu" ? "Betöltés…" : "Loading…"}
        </p>
      )}

      {error && (
        <p className="text-xs text-coral bg-coral-muted border border-coral/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {revokedMsg && (
        <p className="text-xs text-brand-light bg-brand-muted border border-brand/20 rounded-md px-3 py-2">
          {t("connected_apps_revoked", lang)} ✓
        </p>
      )}

      {!loading && !error && apps.length === 0 && (
        <div className="px-4 py-6 bg-app-surface border border-app-border rounded-lg text-center">
          <p className="text-sm text-ink-muted">{t("connected_apps_empty", lang)}</p>
        </div>
      )}

      {!loading && apps.length > 0 && (
        <div className="flex flex-col gap-2">
          {apps.map((app) => (
            <div
              key={app.id}
              className="px-4 py-4 bg-app-surface border border-app-border rounded-lg flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Org avatar */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: "#1D9E75" }}
                >
                  {app.org_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-primary truncate">
                    {app.org_name}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5 font-mono truncate">
                    {app.token_prefix}…
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {t("connected_apps_connected_on", lang)} {fmtDate(app.created_at)}
                    {" · "}
                    {t("connected_apps_last_used", lang)}:{" "}
                    {app.last_used_at
                      ? fmtDate(app.last_used_at)
                      : t("connected_apps_never_used", lang)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleRevoke(app.id)}
                disabled={revokingId === app.id}
                className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 flex-shrink-0"
                style={{
                  borderColor: "#FECACA",
                  color: "#B91C1C",
                  background: "#FEF2F2",
                }}
              >
                {revokingId === app.id
                  ? lang === "hu"
                    ? "Visszavonás…"
                    : "Revoking…"
                  : t("connected_apps_revoke", lang)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
