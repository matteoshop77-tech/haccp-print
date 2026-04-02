import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
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

function SettingRow({
  label,
  sub,
  right,
}: {
  label: string;
  sub?:  string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-app-surface
                    border border-app-border rounded-lg">
      <div>
        <p className="text-sm text-ink-primary">{label}</p>
        {sub && <p className="text-xs text-ink-muted mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const sections = [
  { key: "profile",      group: "General" },
  { key: "language",     group: "General" },
  { key: "appearance",   group: "General" },
  { key: "device",       group: "Printer" },
  { key: "label_size",   group: "Printer" },
  { key: "license",      group: "Account" },
  { key: "subscription", group: "Account" },
  { key: "haccp_export", group: "Data" },
  { key: "backup",       group: "Data" },
] as const;

type SectionKey = typeof sections[number]["key"];

/* ── Device / Printer section ── */
function DeviceSection() {
  const settings   = useStore((s) => s.settings);
  const update     = useStore((s) => s.updateSettings);

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

      {/* Printer list */}
      <div className="flex flex-col gap-2">
        {loading && (
          <p className="text-sm text-ink-muted px-1">Scanning printers…</p>
        )}

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

      {/* Refresh button */}
      <button
        onClick={loadPrinters}
        disabled={loading}
        className="btn-ghost self-start text-sm"
      >
        {loading ? "Scanning…" : "↻ Refresh list"}
      </button>

      {/* Current selection info */}
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

export default function SettingsPage() {
  const lang     = useStore((s) => s.settings.language);
  const settings = useStore((s) => s.settings);
  const update   = useStore((s) => s.updateSettings);
  const license  = useStore((s) => s.license);

  const [active, setActive] = useState<SectionKey>("profile");

  const profiles: IndustryProfile[] = ["restaurant", "hotel", "bakery", "pharmacy", "custom"];
  const groups = [...new Set(sections.map((s) => s.group))];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left nav */}
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
                  {t(`settings_${s.key}` as Parameters<typeof t>[0], lang)}
                </button>
              ))}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">

        {/* ── Industry profile ── */}
        {active === "profile" && (
          <>
            <div>
              <h2 className="text-lg font-medium text-ink-primary">
                {t("settings_profile", lang)}
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                {t("settings_profile_sub", lang)}
              </p>
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
                  <Toggle
                    value={settings.autoCalculateExpiry}
                    onChange={(v) => update({ autoCalculateExpiry: v })}
                  />
                }
              />
              <SettingRow
                label={t("settings_haccp_log", lang)}
                sub={t("settings_haccp_log_sub", lang)}
                right={
                  <Toggle
                    value={settings.haccpLogEnabled}
                    onChange={(v) => update({ haccpLogEnabled: v })}
                  />
                }
              />
            </div>
          </>
        )}

        {/* ── Language ── */}
        {active === "language" && (
          <>
            <h2 className="text-lg font-medium text-ink-primary">
              {t("settings_language", lang)}
            </h2>
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

        {/* ── Appearance ── */}
        {active === "appearance" && (
          <>
            <h2 className="text-lg font-medium text-ink-primary">
              {t("settings_appearance", lang)}
            </h2>
            <SettingRow
              label={t("settings_dark_mode", lang)}
              right={
                <Toggle
                  value={settings.theme === "dark"}
                  onChange={(v) => update({ theme: v ? "dark" : "light" })}
                />
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

        {/* ── Device ── */}
        {active === "device" && <DeviceSection />}

        {/* ── License ── */}
        {active === "license" && (
          <>
            <h2 className="text-lg font-medium text-ink-primary">
              {t("settings_license", lang)}
            </h2>
            {license ? (
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
            ) : (
              <div className="card px-4 py-4">
                <p className="text-sm text-ink-muted mb-3">No license activated.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter license key…"
                    className="input flex-1 text-sm"
                  />
                  <button className="btn-primary px-4 text-sm">Activate</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Other sections placeholder ── */}
        {!["profile", "language", "appearance", "device", "license"].includes(active) && (
          <div>
            <h2 className="text-lg font-medium text-ink-primary mb-2">
              {t(`settings_${active}` as Parameters<typeof t>[0], lang)}
            </h2>
            <p className="text-sm text-ink-muted">Coming soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}