import { NavLink, useLocation } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { useAuthStore } from "@/lib/authStore";
import { supabase } from "@/lib/supabaseClient";
import { t } from "@/lib/i18n";
import { LayoutGrid, Tag, FileText, Layers, Settings, Minus, Square, X, AlertTriangle } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { differenceInDays, parseISO } from "date-fns";
import clsx from "clsx";

function LogoMark() {
  return (
    <div className="flex items-center justify-center mb-4 flex-shrink-0">
      <svg width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="14" fill="#D6EDE4"/>
        <rect x="10" y="10" width="44" height="44" rx="10" fill="#1D9E75"/>
        <rect x="18" y="19" width="28" height="5" rx="2.5" fill="#F0FAF6"/>
        <rect x="18" y="29" width="19" height="5" rx="2.5" fill="rgba(240,250,246,0.55)"/>
        <rect x="18" y="39" width="23" height="5" rx="2.5" fill="rgba(240,250,246,0.55)"/>
      </svg>
    </div>
  );
}

function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between px-4 h-9 flex-shrink-0 border-b border-app-border select-none"
      style={{ background: "var(--color-app-sidebar, #ECEEE9)" }}
    >
      <div data-tauri-drag-region className="flex items-center gap-2.5">
        <svg width="16" height="16" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="14" fill="#D6EDE4"/>
          <rect x="10" y="10" width="44" height="44" rx="10" fill="#1D9E75"/>
          <rect x="18" y="19" width="28" height="5" rx="2.5" fill="#F0FAF6"/>
          <rect x="18" y="29" width="19" height="5" rx="2.5" fill="rgba(240,250,246,0.55)"/>
          <rect x="18" y="39" width="23" height="5" rx="2.5" fill="rgba(240,250,246,0.55)"/>
        </svg>
        <span data-tauri-drag-region className="text-xs font-semibold text-ink-secondary">
          HACC<span style={{ color: "#1D9E75" }}>Print</span>
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => getCurrentWindow().minimize()}
          className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-ink-muted"
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.07)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <Minus size={13} />
        </button>
        <button
          onClick={() => getCurrentWindow().toggleMaximize()}
          className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-ink-muted"
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.07)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => getCurrentWindow().close()}
          className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-ink-muted"
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,50,50,0.15)"; e.currentTarget.style.color = "#C04A28"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = ""; }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

interface NavItemProps {
  to:    string;
  icon:  React.ReactNode;
  label: string;
}

function SideNavItem({ to, icon, label }: NavItemProps) {
  const location = useLocation();
  const active   = location.pathname === to ||
    (to !== "/" && location.pathname.startsWith(to));

  return (
    <NavLink to={to} title={label}>
      <div className={clsx(active ? "nav-item-active" : "nav-item")}>
        {icon}
      </div>
    </NavLink>
  );
}

function TrialBanner() {
  const { trialStart } = useAuthStore();
  const license = useStore((s) => s.license);

  if (license) return null;
  if (!trialStart) return null;

  const daysSinceStart = differenceInDays(new Date(), parseISO(trialStart));
  const daysLeft       = 14 - daysSinceStart;
  const expired        = daysLeft <= 0;

  const level =
    expired       ? "expired"  :
    daysLeft <= 2 ? "critical" :
    daysLeft <= 5 ? "warning"  : "info";

  const styles = {
    info: {
      background:   "#FEFCE8",
      borderBottom: "1px solid #FEF08A",
      color:        "#A16207",
      padding:      "3px 16px",
      fontSize:     "11px",
    },
    warning: {
      background:   "#FFF7ED",
      borderBottom: "1px solid #FDBA74",
      color:        "#C2410C",
      padding:      "5px 16px",
      fontSize:     "12px",
    },
    critical: {
      background:   "#FEF2F2",
      borderBottom: "1px solid #FCA5A5",
      color:        "#B91C1C",
      padding:      "7px 16px",
      fontSize:     "13px",
    },
    expired: {
      background:   "#FEF2F2",
      borderBottom: "2px solid #EF4444",
      color:        "#991B1B",
      padding:      "7px 16px",
      fontSize:     "13px",
    },
  }[level];

  return (
    <div
      className="flex items-center gap-2 flex-shrink-0 font-medium"
      style={styles}
    >
      <AlertTriangle size={level === "info" ? 11 : 13} className="flex-shrink-0" />
      {expired ? (
        <>
          Your free trial has expired —{" "}
          <NavLink to="/settings" className="underline font-semibold">
            activate your license
          </NavLink>{" "}
          to keep using HACCPrint.
        </>
      ) : (
        <>
          Free trial: <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining</strong>
          {" — "}
          <NavLink to="/settings" className="underline">
            activate license
          </NavLink>
        </>
      )}
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const lang = useStore((s) => s.settings.language);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-app-bg text-ink-primary">
      <TitleBar />
      <TrialBanner />
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex flex-col items-center w-16 py-5 bg-app-sidebar border-r border-app-border flex-shrink-0">
          <LogoMark />
          <nav className="flex flex-col gap-1.5 flex-1">
            <SideNavItem to="/"           icon={<LayoutGrid size={18} />} label={t("nav_home", lang)} />
            <SideNavItem to="/labels"     icon={<Tag size={18} />}        label={t("nav_labels", lang)} />
            <SideNavItem to="/log"        icon={<FileText size={18} />}   label={t("nav_log", lang)} />
            <SideNavItem to="/categories" icon={<Layers size={18} />}     label="Categories" />
          </nav>
          <SideNavItem to="/settings" icon={<Settings size={18} />} label={t("nav_settings", lang)} />
        </aside>

        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}