import { NavLink, useLocation } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";
import {
  LayoutGrid,
  Tag,
  FileText,
  Settings,
} from "lucide-react";
import clsx from "clsx";

/* ── Logo mark ── */
function LogoMark() {
  return (
    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand mb-4 flex-shrink-0">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3"  y="3"  width="6" height="6" rx="1.5" fill="white" opacity="0.95"/>
        <rect x="11" y="3"  width="6" height="6" rx="1.5" fill="white" opacity="0.45"/>
        <rect x="3"  y="11" width="6" height="6" rx="1.5" fill="white" opacity="0.45"/>
        <rect x="11" y="11" width="6" height="6" rx="1.5" fill="white" opacity="0.95"/>
      </svg>
    </div>
  );
}

/* ── Nav item ── */
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

/* ── App shell ── */
interface AppShellProps {
  children: React.ReactNode;
}
export function AppShell({ children }: AppShellProps) {
  const lang = useStore((s) => s.settings.language);

  return (
    <div className="flex h-screen overflow-hidden bg-app-bg text-ink-primary">
      {/* Sidebar */}
      <aside className="flex flex-col items-center w-16 py-5 bg-app-sidebar border-r border-app-border flex-shrink-0">
        <LogoMark />
        <nav className="flex flex-col gap-1.5 flex-1">
          <SideNavItem
            to="/"
            icon={<LayoutGrid size={18} />}
            label={t("nav_home", lang)}
          />
          <SideNavItem
            to="/labels"
            icon={<Tag size={18} />}
            label={t("nav_labels", lang)}
          />
          <SideNavItem
            to="/log"
            icon={<FileText size={18} />}
            label={t("nav_log", lang)}
          />
        </nav>
        {/* Settings at bottom */}
        <SideNavItem
          to="/settings"
          icon={<Settings size={18} />}
          label={t("nav_settings", lang)}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
