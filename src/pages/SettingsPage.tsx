import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useAuthStore } from "@/lib/authStore";
import { supabase } from "@/lib/supabaseClient";
import { t } from "@/lib/i18n";
import type { IndustryProfile } from "@/lib/types";
import clsx from "clsx";

const profileEmoji: Record<IndustryProfile, string> = {
  restaurant: "🍽",
  hotel:      "🏨",
  bakery:     "🥐",
  pharmacy:   "💊",
  custom:     "⚙",
};

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={clsx(
        "toggle-track w-9 h-5",
        value ? "bg-brand" : "bg-white/10"
      )}
    >
      <div className={clsx(
        "toggle-thumb left-0.5",
        value ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  );
}

function SettingRow({ label, sub, right }: {
  label: string;
  sub?:  string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-app-surface border border-app-border rounded-lg">
      <div>
        <p className="text-sm text-ink-primary">{label}</p>
        {sub && <p className="text-xs text-ink-muted mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const sections = [
  { key: "account",      group: "Account" },
  { key: "license",      group: "Account" },
  { key: "profile",      group: "General" },
  { key: "language",     group: "General" },
  { key: "appearance",   group: "General" },
  { key: "device",       group: "Printer" },
  { key: "label_size",   group: "Printer" },
  { key: "subscription", group: "Account" },
  { key: "haccp_export", group: "Data" },
  { key: "backup",       group: "Data" },
] as const;

type SectionKey = typeof sections[number]["key"];

/* ── Account Section ── */
function AccountSection({ lang }: { lang: "en" | "hu" }) {
  const { user } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-medium text-ink-primary">Account</h2>
        <p className="text-xs text-ink-muted mt-1">
          {lang === "hu" ? "A bejelentkezett fiók adatai." : "Your signed-in account details."}
        </p>
      </div>

      {/* User info card */}
      <div className="px-4 py-4 bg-app-surface border border-app-border rounded-lg flex items-center gap-4">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ background: "#1D9E75" }}
        >
          {user?.email?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink-primary truncate">
            {user?.email ?? "—"}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">
            {lang === "hu" ? "Bejelentkezve" : "Signed in"}
          </p>
        </div>
      </div>

      {/* Sign out */}
      <div className="px-4 py-4 bg-app-surface border border-app-border rounded-lg flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink-primary">
            {lang === "hu" ? "Kijelentkezés" : "Sign out"}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">
            {lang === "hu"
              ? "Kilép a fiókból ezen az eszközön."
              : "Sign out of your account on this device."}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          disabled={loggingOut}
          className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            borderColor: "#FECACA",
            color:       "#B91C1C",
            background:  "#FEF2F2",
          }}
        >
          {loggingOut
            ? (lang === "hu" ? "Kilépés…" : "Signing out…")
            : (lang === "hu" ? "Kijelentkezés" : "Sign out")}
        </button>
      </div>
    </div>
  );
}

/* ── Device / Printer section ── */
function DeviceSection() {
  const settings = useStore((s) => s.settings);
  const update   = useStore((s) => s.updateSettings);

  const [printers,  setPrinters]  = useState<string[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const loadPrinters = async () => {
    setLoading(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const list = await invoke<string[]>("list_printers");
      setPrinters(list);
    } catch {
      setPrinters([]);
    } finally {
      setLoading(false);
      setRefreshed(true);
    }
  };

  useEffect(() => { loadPrinters(); }, []);

  const selected = settings.printerName;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-ink-primary">Printer Setup</h2>
        <p className="text-xs text-ink-muted mt-1">
          Select the printer HACCPrint will use for label printing.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {loading && <p className="text-sm text-ink-muted px-1">Scanning printers…</p>}
        {!loading && printers.length === 0 && refreshed && (
          <p className="text-sm text-ink-muted px-1">
            No printers found. Make sure the Brother QL-800 driver is installed.
          </p>
        )}
        {printers.map((name) => {
          const isBrother  = name.toLowerCase().includes("brother");
          const isSelected = selected === name;
          return (
            <button
              key={name}
              onClick={() => update({ printerName: name })}
              className={clsx(
                "flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors",
                isSelected
                  ? "border-brand/40 bg-brand-muted/40"
                  : "border-app-border bg-app-surface hover:border-app-border-hover"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{isBrother ? "🖨️" : "🖨"}</span>
                <div>
                  <p className="text-sm font-medium text-ink-primary">{name}</p>
                  {isBrother && name.toLowerCase().includes("ql-800") && (
                    <p className="text-xs text-brand-light mt-0.5">Recommended</p>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="w-4 h-4 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <button onClick={loadPrinters} disabled={loading} className="btn-ghost self-start text-sm">
        {loading ? "Scanning…" : "↻ Refresh list"}
      </button>
      {selected && (
        <div className="px-4 py-3 bg-app-surface border border-app-border rounded-lg">
          <p className="text-xs text-ink-muted">Active printer</p>
          <p className="text-sm font-medium text-ink-primary mt-0.5">{selected}</p>
        </div>
      )}
      {!selected && refreshed && printers.length > 0 && (
        <p className="text-xs text-ink-muted px-1">
          No printer selected — HACCPrint will auto-detect a Brother printer.
        </p>
      )}
    </div>
  );
}

/* ── HACCP Export Section ── */
function HaccpExportSection({ lang }: { lang: "en" | "hu" }) {
  const jobs = useStore((s) => s.printJobs);
  const [from, setFrom] = useState("");
  const [to,   setTo]   = useState("");

  const filteredJobs = jobs.filter((j) => {
    const date = j.printedAt.slice(0, 10);
    if (from && date < from) return false;
    if (to   && date > to)   return false;
    return true;
  });

  const exportCSV = () => {
    const header = "Date,Time,Product,Type,Copies,Prepared,Expiry,Operator";
    const rows = filteredJobs.map((j) => [
      j.printedAt.slice(0, 10),
      j.printedAt.slice(11, 16),
      `"${j.templateName}"`,
      j.labelType,
      j.copies,
      j.preparedDate,
      j.expiryDate ?? "",
      j.operatorName ?? "",
    ].join(","));
    const csv  = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `haccp-export-${from || "all"}-${to || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-medium text-ink-primary">{t("settings_haccp_export", lang)}</h2>
        <p className="text-xs text-ink-muted mt-1">
          {lang === "hu"
            ? "Exportáld a nyomtatási naplót CSV formátumban HACCP ellenőrzéshez."
            : "Export your print log as CSV for HACCP compliance inspection."}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="section-label mb-1.5 block">{lang === "hu" ? "Kezdő dátum" : "From"}</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input text-sm" />
          </div>
          <div className="flex-1">
            <label className="section-label mb-1.5 block">{lang === "hu" ? "Záró dátum" : "To"}</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input text-sm" />
          </div>
        </div>
        <div className="px-4 py-3 bg-app-surface border border-app-border rounded-lg">
          <p className="text-xs text-ink-muted">{lang === "hu" ? "Rekordok száma" : "Records to export"}</p>
          <p className="text-sm font-medium text-ink-primary mt-0.5">
            {filteredJobs.length} {lang === "hu" ? "nyomtatás" : "print jobs"}
          </p>
        </div>
        <button onClick={exportCSV} disabled={filteredJobs.length === 0} className="btn-primary self-start disabled:opacity-50">
          {lang === "hu" ? "CSV exportálása" : "Export CSV"}
        </button>
        {jobs.length === 0 && (
          <p className="text-xs text-ink-muted">
            {lang === "hu" ? "Még nincs rögzített nyomtatás." : "No print jobs logged yet."}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Backup Section ── */
function BackupSection({ lang }: { lang: "en" | "hu" }) {
  const store = useStore();
  const [importError, setImportError] = useState("");
  const [importOk,    setImportOk]    = useState(false);

  const exportBackup = () => {
    const data = {
      version:    1,
      exportedAt: new Date().toISOString(),
      templates:  store.templates,
      categories: store.categories,
      settings:   store.settings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `haccprint-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError("");
    setImportOk(false);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.templates || !data.categories || !data.settings) {
          setImportError(lang === "hu" ? "Érvénytelen backup fájl." : "Invalid backup file.");
          return;
        }
        data.templates.forEach((tmpl: any) => store.addTemplate(tmpl));
        data.categories.forEach((cat: string) => store.addCategory(cat));
        store.updateSettings(data.settings);
        setImportOk(true);
        setTimeout(() => setImportOk(false), 3000);
      } catch {
        setImportError(lang === "hu" ? "Nem sikerült beolvasni a fájlt." : "Could not read the file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-medium text-ink-primary">{t("settings_backup", lang)}</h2>
        <p className="text-xs text-ink-muted mt-1">
          {lang === "hu"
            ? "Mentsd el vagy töltsd vissza az összes adatot (címkék, kategóriák, beállítások)."
            : "Save or restore all your data (labels, categories, settings)."}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <div className="px-4 py-4 bg-app-surface border border-app-border rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink-primary">{lang === "hu" ? "Adatok exportálása" : "Export backup"}</p>
            <p className="text-xs text-ink-muted mt-0.5">{lang === "hu" ? "JSON fájl letöltése az összes adattal" : "Download a JSON file with all your data"}</p>
          </div>
          <button onClick={exportBackup} className="btn-primary px-4 text-sm">
            {lang === "hu" ? "Letöltés" : "Download"}
          </button>
        </div>
        <div className="px-4 py-4 bg-app-surface border border-app-border rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink-primary">{lang === "hu" ? "Adatok visszaállítása" : "Restore backup"}</p>
            <p className="text-xs text-ink-muted mt-0.5">{lang === "hu" ? "Töltsd fel a korábban mentett JSON fájlt" : "Upload a previously exported JSON file"}</p>
          </div>
          <label className="btn-ghost px-4 text-sm cursor-pointer">
            {lang === "hu" ? "Feltöltés" : "Upload"}
            <input type="file" accept=".json" onChange={importBackup} className="hidden" />
          </label>
        </div>
        {importError && (
          <p className="text-xs text-coral bg-coral-muted border border-coral/20 rounded-md px-3 py-2">{importError}</p>
        )}
        {importOk && (
          <p className="text-xs text-brand-light bg-brand-muted border border-brand/20 rounded-md px-3 py-2">
            {lang === "hu" ? "Visszaállítás sikeres ✓" : "Restore successful ✓"}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── License Section ── */
function LicenseSection({ lang }: { lang: "en" | "hu" }) {
  const license        = useStore((s) => s.license);
  const setLicense     = useStore((s) => s.setLicense);
  const removeLicense  = useStore((s) => s.removeLicense);
  const { user }       = useAuthStore();

  const [key,     setKey]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleActivate = async () => {
    if (!key.trim()) return;
    if (!user) return;
    setLoading(true);
    setError("");

    const { activateLicense } = await import("@/lib/licenseService");
    const result = await activateLicense(key.trim(), user.id);

    setLoading(false);

    if (!result.success || !result.license) {
      setError(result.error ?? "Activation failed.");
      return;
    }

    setLicense(result.license);
  };

  if (license) {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-lg font-medium text-ink-primary">
          {t("settings_license", lang)}
        </h2>
        <div className="card px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-brand-light">
              {t(`license_plan_${license.plan}` as Parameters<typeof t>[0], lang)}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">
              {t("license_renews", lang)} {license.expiresAt.slice(0, 10)} · 1 {t("license_device", lang)}
            </p>
          </div>
          <span className="badge-brand">{t("license_active", lang)}</span>
        </div>
        <button
          onClick={() => removeLicense()}
          className="btn-ghost self-start text-sm"
          style={{ color: "#E05C4A" }}
        >
          {lang === "hu" ? "Licenc eltávolítása" : "Remove license"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-medium text-ink-primary">
          {t("settings_license", lang)}
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          {lang === "hu"
            ? "Add meg a licenckulcsot a vásárlás után kapott emailből."
            : "Enter the license key you received after purchase."}
        </p>
      </div>
      <div className="card px-4 py-4 flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t("settings_no_license", lang)}</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t("settings_license_key", lang)}
            className="input flex-1 text-sm font-mono"
            onKeyDown={(e) => e.key === "Enter" && handleActivate()}
          />
          <button
            onClick={handleActivate}
            disabled={loading || !key.trim()}
            className="btn-primary px-4 text-sm disabled:opacity-50"
          >
            {loading
              ? (lang === "hu" ? "Aktiválás…" : "Activating…")
              : t("settings_activate", lang)}
          </button>
        </div>
        {error && (
          <p className="text-xs text-coral bg-coral-muted border border-coral/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}
      </div>
      <div className="px-4 py-3 bg-app-surface border border-app-border rounded-lg">
        <p className="text-xs text-ink-muted mb-2">
          {lang === "hu" ? "Még nincs licenced?" : "Don't have a license yet?"}
        </p>
        <a
          href="https://haccprint.lemonsqueezy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-brand-light hover:underline">
          {lang === "hu" ? "Vásárolj itt →" : "Buy here →"}
        </a>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const lang     = useStore((s) => s.settings.language);
  const settings = useStore((s) => s.settings);
  const update   = useStore((s) => s.updateSettings);

  const [active, setActive] = useState<SectionKey>("account");

  const profiles: IndustryProfile[] = ["restaurant", "hotel", "bakery", "pharmacy", "custom"];
  const groups = [...new Set(sections.map((s) => s.group))];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-48 border-r border-app-border py-5 flex flex-col gap-0.5 flex-shrink-0 overflow-y-auto">
        {groups.map((group) => (
          <div key={group}>
            <p className="section-label px-4 py-2 pt-4">{group}</p>
            {sections
              .filter((s) => s.group === group)
              .map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActive(s.key)}
                  className={clsx(
                    "w-full text-left px-4 py-2 text-sm transition-colors border-l-2",
                    active === s.key
                      ? "text-brand-light bg-brand-muted border-brand"
                      : "text-ink-muted border-transparent hover:text-ink-secondary hover:bg-white/5"
                  )}
                >
                  {s.key === "account"
                    ? (lang === "hu" ? "Fiók" : "Account")
                    : t(`settings_${s.key}` as Parameters<typeof t>[0], lang)}
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">

        {active === "account" && <AccountSection lang={lang} />}

        {active === "profile" && (
          <>
            <div>
              <h2 className="text-lg font-medium text-ink-primary">{t("settings_profile", lang)}</h2>
              <p className="text-xs text-ink-muted mt-1">{t("settings_profile_sub", lang)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {profiles.map((p) => (
                <button
                  key={p}
                  onClick={() => update({ profile: p })}
                  className={clsx(
                    "p-3.5 rounded-lg border text-left transition-colors",
                    settings.profile === p
                      ? "border-brand/40 bg-brand-muted/40"
                      : "border-app-border bg-app-surface hover:border-app-border-hover"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">{profileEmoji[p]}</span>
                    {settings.profile === p && (
                      <div className="w-4 h-4 rounded-full bg-brand flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-ink-primary">
                    {t(`profile_${p}` as Parameters<typeof t>[0], lang)}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {t(`profile_${p}_labels` as Parameters<typeof t>[0], lang)}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <SettingRow
                label={t("settings_auto_expiry", lang)}
                sub={t("settings_auto_expiry_sub", lang)}
                right={
                  <Toggle value={settings.autoCalculateExpiry} onChange={(v) => update({ autoCalculateExpiry: v })} />
                }
              />
              <SettingRow
                label={t("settings_haccp_log", lang)}
                sub={t("settings_haccp_log_sub", lang)}
                right={
                  <Toggle value={settings.haccpLogEnabled} onChange={(v) => update({ haccpLogEnabled: v })} />
                }
              />
            </div>
          </>
        )}

        {active === "language" && (
          <>
            <h2 className="text-lg font-medium text-ink-primary">{t("settings_language", lang)}</h2>
            <div className="flex gap-2">
              {(["en", "hu"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => update({ language: l })}
                  className={clsx(
                    "px-5 py-2.5 rounded-lg border text-sm transition-colors",
                    settings.language === l
                      ? "bg-brand-muted border-brand/40 text-brand-light"
                      : "bg-app-surface border-app-border text-ink-muted hover:border-app-border-hover"
                  )}
                >
                  {l === "en" ? "🇬🇧 English" : "🇭🇺 Magyar"}
                </button>
              ))}
            </div>
          </>
        )}

        {active === "appearance" && (
          <>
            <h2 className="text-lg font-medium text-ink-primary">{t("settings_appearance", lang)}</h2>
            <SettingRow
              label={t("settings_dark_mode", lang)}
              right={
                <Toggle value={settings.theme === "dark"} onChange={(v) => update({ theme: v ? "dark" : "light" })} />
              }
            />
            <SettingRow
              label={t("settings_operator", lang)}
              right={
                <input
                  type="text"
                  value={settings.operatorName}
                  onChange={(e) => update({ operatorName: e.target.value })}
                  placeholder="Name…"
                  className="input w-40 text-sm py-1.5"
                />
              }
            />
          </>
        )}

        {active === "device"       && <DeviceSection />}
        {active === "license"      && <LicenseSection lang={lang} />}
        {active === "haccp_export" && <HaccpExportSection lang={lang} />}
        {active === "backup"       && <BackupSection lang={lang} />}

        {!["account", "profile", "language", "appearance", "device", "license", "haccp_export", "backup"].includes(active) && (
          <div>
            <h2 className="text-lg font-medium text-ink-primary mb-2">
              {t(`settings_${active}` as Parameters<typeof t>[0], lang)}
            </h2>
            <p className="text-sm text-ink-muted">{t("settings_coming_soon", lang)}</p>
          </div>
        )}
      </div>
    </div>
  );
}