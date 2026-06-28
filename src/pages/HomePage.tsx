import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays } from "date-fns";
import { Search, Plus, Minus, Printer, Pin, Pencil, Trash2, X, Eye, Wand2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";
import type { LabelTemplate, LabelType } from "@/lib/types";
import { printLabel } from "@/lib/printService";
import { LabelForm, type LabelFormData } from "@/components/labels/LabelForm";
import { PrintModal } from "@/components/labels/PrintModal";
import { QuickCustomPrintDialog } from "@/components/labels/QuickCustomPrintDialog";
import clsx from "clsx";

const typeDot: Record<LabelType, string> = {
  ervenyesseg:   "#6BCBA8",
  bontas:        "#E8B96A",
  termek_leiras: "#7AADE8",
  custom:        "#A89FE8",
};

const typeKey: Record<LabelType, Parameters<typeof t>[0]> = {
  ervenyesseg:   "type_ervenyesseg",
  bontas:        "type_bontas",
  termek_leiras: "type_termek_leiras",
  custom:        "type_custom",
};

/* ─────── Copies editor (compact) — click-to-edit number ─────── */
function CopiesEditor({ value, onChange, accentColor }: {
  value:        number;
  onChange:     (n: number) => void;
  accentColor?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    const parsed = parseInt(draft.replace(/\D/g, ""), 10);
    const next   = Number.isFinite(parsed) ? Math.max(1, Math.min(999, parsed)) : value;
    if (next !== value) onChange(next);
    setEditing(false);
  };

  const btnBg     = accentColor ? "rgba(212,133,10,0.12)" : "rgba(0,0,0,0.06)";
  const iconColor = accentColor ?? undefined;

  return (
    <>
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
        style={{ background: btnBg }}
      >
        <Minus size={9} style={iconColor ? { color: iconColor } : undefined}
          className={iconColor ? undefined : "text-ink-secondary"} />
      </button>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter")  commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="text-xs font-semibold text-center tabular-nums text-ink-primary bg-transparent border-0 outline-none"
          style={{ width: "28px" }}
        />
      ) : (
        <button
          onClick={startEdit}
          className="text-xs font-semibold text-center tabular-nums text-ink-primary rounded hover:bg-black/[0.06]"
          style={{ width: "28px" }}
        >
          {value}
        </button>
      )}

      <button
        onClick={() => onChange(Math.min(999, value + 1))}
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
        style={{ background: btnBg }}
      >
        <Plus size={9} style={iconColor ? { color: iconColor } : undefined}
          className={iconColor ? undefined : "text-ink-secondary"} />
      </button>
    </>
  );
}

/* ─────── Sort toggle — segmented control ─────── */
type SortMode = "az" | "most_used";

function SortToggle({ value, onChange }: {
  value:    SortMode;
  onChange: (v: SortMode) => void;
}) {
  const options: { value: SortMode; label: string }[] = [
    { value: "az",        label: "A-Z" },
    { value: "most_used", label: "Most used" },
  ];
  return (
    <div className="flex items-center bg-app-elevated border border-app-border rounded-md p-0.5 text-xs flex-shrink-0">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "px-2.5 py-1 rounded font-medium transition-colors",
            value === opt.value
              ? "bg-app-surface text-ink-primary shadow-sm"
              : "text-ink-muted hover:text-ink-secondary"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ─────── Quick filter slot — filters on category (exact, case-insensitive) ─────── */
function QuickFilterSlot({
  filter, active, onApply, onSave, onRemove,
}: {
  filter:   string | null;
  active:   boolean;
  onApply:  () => void;
  onSave:   (text: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (filter) {
    return (
      <div className={clsx(
        "flex items-center gap-1 rounded-full border text-sm pl-3 pr-1 py-1 transition-colors",
        active
          ? "bg-brand text-white border-brand"
          : "bg-app-surface text-ink-secondary border-app-border hover:border-brand hover:text-brand"
      )}>
        <button onClick={onApply} className="font-medium truncate max-w-[140px]">
          {filter}
        </button>
        <button
          onClick={onRemove}
          className={clsx(
            "rounded-full w-5 h-5 flex items-center justify-center transition-colors flex-shrink-0",
            active ? "hover:bg-white/20" : "hover:bg-coral/15 hover:text-coral"
          )}
          title="Remove"
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  if (editing) {
    const commit = () => {
      const trimmed = draft.trim();
      if (trimmed) onSave(trimmed);
      setDraft("");
      setEditing(false);
    };
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setDraft(""); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter")  commit();
          if (e.key === "Escape") { setDraft(""); setEditing(false); }
        }}
        placeholder="Category name…"
        className="rounded-full border border-brand bg-app-surface text-sm px-3 py-1.5 outline-none w-[160px]"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="rounded-full border border-dashed border-app-border text-sm px-3 py-1.5 text-ink-muted hover:border-brand hover:text-brand transition-colors"
    >
      + Add shortcut
    </button>
  );
}

/* ─────── Bontás card — compact, fixed first slot ─────── */
function BontasCard({ lang, onPrinted }: {
  lang:      "en" | "hu";
  onPrinted: () => void;
}) {
  const today       = format(new Date(), "dd.MM.yyyy");
  const [copies, setCopies]   = useState(1);
  const [loading, setLoading] = useState(false);
  const settings    = useStore((s) => s.settings);
  const addPrintJob = useStore((s) => s.addPrintJob);

  const handlePrint = async () => {
    setLoading(true);
    const now      = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const bontasTemplate: LabelTemplate = {
      id:            "bontas-fixed",
      name:          t("type_bontas", lang),
      category:      t("type_bontas", lang),
      type:          "bontas",
      shelfLifeDays: 0,
      description:   null,
      allergens:     null,
      profile:       settings.profile,
      pinned:        false,
      printCount:    0,
      createdAt:     now.toISOString(),
      updatedAt:     now.toISOString(),
      lastCopies:    1,
    };
    const result = await printLabel(bontasTemplate, copies, now, lang, settings.printerName);
    setLoading(false);
    if (!result.success) return;
    if (settings.haccpLogEnabled) {
      addPrintJob({
        templateId:   "bontas-fixed",
        templateName: t("type_bontas", lang),
        labelType:    "bontas",
        copies,
        preparedDate: todayStr,
        expiryDate:   todayStr,
        operatorName: settings.operatorName || null,
      });
    }
    onPrinted();
  };

  return (
    <div className="rounded-lg p-2.5 flex flex-col justify-between gap-2"
      style={{ background: "#FDF3E3", border: "1px solid #E8B96A" }}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#E8B96A" }} />
          <p className="text-xs font-semibold text-ink-primary truncate leading-tight">
            {lang === "hu" ? "Bontás napja" : "Opening date"}
          </p>
        </div>
        <span className="flex-shrink-0 font-medium" style={{ fontSize: "10px", color: "#D4850A" }}>
          {t("type_bontas", lang)}
        </span>
      </div>
      <p style={{ fontSize: "10px", color: "#C8943A" }}>{today}</p>
      <div className="flex items-center gap-1">
        <CopiesEditor value={copies} onChange={setCopies} accentColor="#D4850A" />
        <button
          onClick={handlePrint}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded font-semibold text-white ml-0.5 disabled:opacity-50"
          style={{ background: "#D4850A", fontSize: "10px" }}
        >
          <Printer size={9} />
          {loading ? "…" : t("print_btn", lang)}
        </button>
      </div>
    </div>
  );
}

/* ─────── Compact label card ─────── */
function HomeLabelCard({
  template, lang, onEdit, onPin, onDelete, onPreview, onPrinted,
}: {
  template:  LabelTemplate;
  lang:      "en" | "hu";
  onEdit:    (t: LabelTemplate) => void;
  onPin:     (id: string, v: boolean) => void;
  onDelete:  (id: string) => void;
  onPreview: (t: LabelTemplate) => void;
  onPrinted: (templateName: string) => void;
}) {
  const settings         = useStore((s) => s.settings);
  const addPrintJob      = useStore((s) => s.addPrintJob);
  const updateLastCopies = useStore((s) => s.updateLastCopies);

  const [copies, setCopies]   = useState(template.lastCopies ?? 1);
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    const now    = new Date();
    const result = await printLabel(template, copies, now, lang, settings.printerName);
    setLoading(false);
    if (!result.success) return;

    if (settings.haccpLogEnabled) {
      addPrintJob({
        templateId:   template.id,
        templateName: template.name,
        labelType:    template.type,
        copies,
        preparedDate: format(now, "yyyy-MM-dd"),
        expiryDate:   format(addDays(now, template.shelfLifeDays), "yyyy-MM-dd"),
        operatorName: settings.operatorName || null,
      });
    }
    if (copies !== template.lastCopies) {
      updateLastCopies(template.id, copies);
    }
    onPrinted(template.name);
  };

  return (
    <div className="card p-2.5 flex flex-col justify-between gap-2 group relative">
      {/* Top row: dot + name + (type label OR hover actions) */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeDot[template.type] }} />
          <p className="text-xs font-semibold text-ink-primary truncate leading-tight">{template.name}</p>
        </div>
        <span
          className="text-ink-muted flex-shrink-0 flex items-center gap-1 group-hover:invisible [@media(hover:none)]:invisible"
          style={{ fontSize: "10px" }}
        >
          {template.pinned && <Pin size={9} className="text-brand" />}
          {t(typeKey[template.type], lang)}
        </span>
      </div>

      {/* Days · Category */}
      <p className="text-ink-muted truncate" style={{ fontSize: "10px" }}>
        {template.shelfLifeDays}d · {template.category}
      </p>

      {/* Qty + Preview + Print */}
      <div className="flex items-center gap-1">
        <CopiesEditor value={copies} onChange={setCopies} />
        <button
          onClick={() => onPreview(template)}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded border border-app-border text-ink-secondary font-medium hover:border-brand hover:text-brand transition-colors ml-0.5"
          style={{ fontSize: "10px" }}
        >
          <Eye size={9} />
          {t("print_preview", lang)}
        </button>
        <button
          onClick={handlePrint}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-white font-semibold disabled:opacity-50"
          style={{ background: "#1D9E75", fontSize: "10px" }}
        >
          <Printer size={9} />
          {loading ? "…" : t("print_btn", lang)}
        </button>
      </div>

      {/* Hover action overlay — replaces type label */}
      <div
        className="absolute top-2 right-2 flex items-center gap-0.5 bg-app-surface rounded px-0.5
                   opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
      >
        <button
          onClick={() => onPin(template.id, !template.pinned)}
          className={clsx(
            "w-5 h-5 rounded flex items-center justify-center transition-colors",
            template.pinned ? "text-brand bg-brand-muted" : "text-ink-muted hover:text-brand hover:bg-brand-muted"
          )}
        >
          <Pin size={10} />
        </button>
        <button
          onClick={() => onEdit(template)}
          className="w-5 h-5 rounded flex items-center justify-center text-ink-muted hover:text-amber hover:bg-amber-muted transition-colors"
        >
          <Pencil size={10} />
        </button>
        <button
          onClick={() => onDelete(template.id)}
          className="w-5 h-5 rounded flex items-center justify-center text-ink-muted hover:text-coral hover:bg-coral-muted transition-colors"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

/* ─────── Home page ─────── */
export default function HomePage() {
  const navigate           = useNavigate();
  const lang               = useStore((s) => s.settings.language);
  const settings           = useStore((s) => s.settings);
  const templates          = useStore((s) => s.templates);
  const pinTemplate        = useStore((s) => s.pinTemplate);
  const deleteTemplate     = useStore((s) => s.deleteTemplate);
  const addTemplate        = useStore((s) => s.addTemplate);
  const updateTemplate     = useStore((s) => s.updateTemplate);
  const updateQuickFilters = useStore((s) => s.updateQuickFilters);

  const [search, setSearch]             = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sortMode, setSortMode]         = useState<SortMode>("az");
  const [showForm, setShowForm]         = useState(false);
  const [showQuickCustom, setShowQuickCustom] = useState(false);
  const [editTarget, setEditTarget]     = useState<LabelTemplate | null>(null);
  const [selected, setSelected]         = useState<LabelTemplate | null>(null);
  const [toast, setToast]               = useState("");

  const quickFilters = settings.quickFilters ?? [];
  const slots: (string | null)[] = [
    quickFilters[0] ?? null,
    quickFilters[1] ?? null,
    quickFilters[2] ?? null,
  ];

  const searchLower = search.toLowerCase();
  let filtered = templates.filter((tmpl) =>
    !searchLower || tmpl.name.toLowerCase().includes(searchLower)
  );

  if (activeFilter) {
    const af = activeFilter.toLowerCase();
    filtered = filtered.filter((tmpl) => tmpl.category.toLowerCase() === af);
  }

  const sorted = filtered.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sortMode === "most_used" && a.printCount !== b.printCount) {
      return b.printCount - a.printCount;
    }
    return a.name.localeCompare(b.name, "hu", { sensitivity: "base" });
  });

  const handleSaveNew = (data: LabelFormData) => {
    addTemplate(data);
    setShowForm(false);
  };

  const handleSaveEdit = (data: LabelFormData) => {
    if (!editTarget) return;
    updateTemplate(editTarget.id, data);
    setEditTarget(null);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const saveSlot = (idx: number, text: string) => {
    const next = [...quickFilters];
    next[idx] = text;
    updateQuickFilters(next.filter(Boolean).slice(0, 3));
  };

  const removeSlot = (idx: number) => {
    const removed = quickFilters[idx];
    if (activeFilter === removed) setActiveFilter(null);
    const next = quickFilters.filter((_, i) => i !== idx);
    updateQuickFilters(next);
  };

  const toggleFilter = (filter: string) => {
    setActiveFilter((cur) => (cur === filter ? null : filter));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-app-border">
        <div className="min-w-0">
          <h1 className="text-xl font-medium text-ink-primary">{t("nav_home", lang)}</h1>
          {settings.printerName ? (
            <p className="text-xs text-ink-muted mt-0.5 truncate">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand mr-1.5 align-middle" />
              {settings.printerName} · {t("printer_ready", lang)}
            </p>
          ) : (
            <button
              onClick={() => navigate("/settings")}
              className="text-xs mt-0.5 font-medium"
              style={{ color: "#B91C1C" }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: "#B91C1C" }} />
              {t("printer_no_driver", lang)}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowQuickCustom(true)}
            className="btn-ghost py-1.5 px-3 text-sm rounded-md"
          >
            <Wand2 size={14} />
            {t("home_quick_custom", lang)}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary py-1.5 px-3 text-sm rounded-md"
          >
            <Plus size={14} />
            {t("home_add_new", lang)}
          </button>
        </div>
      </div>

      {/* Search + sort */}
      <div className="px-6 py-3 flex-shrink-0 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search", lang)}
            className="input pl-8 pr-8 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md text-ink-muted hover:text-ink-primary hover:bg-app-elevated"
              title="Clear"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <SortToggle value={sortMode} onChange={setSortMode} />
      </div>

      {/* Quick filter slots */}
      <div className="px-6 pb-3 flex flex-wrap gap-2 flex-shrink-0">
        {slots.map((filter, idx) => (
          <QuickFilterSlot
            key={idx}
            filter={filter}
            active={!!filter && activeFilter === filter}
            onApply={() => filter && toggleFilter(filter)}
            onSave={(text) => saveSlot(idx, text)}
            onRemove={() => removeSlot(idx)}
          />
        ))}
      </div>

      {/* Grid — 4 columns */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-4 gap-2">
          <BontasCard lang={lang} onPrinted={() => showToast(`${t("type_bontas", lang)} ✓`)} />
          {sorted.length === 0 ? (
            <div className="col-span-full text-sm text-center py-8 text-ink-muted">
              {t("labels_none", lang)}
            </div>
          ) : (
            sorted.map((tmpl) => (
              <HomeLabelCard
                key={tmpl.id}
                template={tmpl}
                lang={lang}
                onEdit={setEditTarget}
                onPin={pinTemplate}
                onDelete={deleteTemplate}
                onPreview={setSelected}
                onPrinted={(name) => showToast(`${name} ✓`)}
              />
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <LabelForm
          template={null}
          onSave={handleSaveNew}
          onClose={() => setShowForm(false)}
        />
      )}
      {editTarget && (
        <LabelForm
          template={editTarget}
          onSave={handleSaveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
      {selected && (
        <PrintModal template={selected} onClose={() => setSelected(null)} />
      )}
      {showQuickCustom && (
        <QuickCustomPrintDialog
          onClose={() => setShowQuickCustom(false)}
          onPrinted={() => showToast(`${t("qcp_title", lang)} ✓`)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: "#1D9E75" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
