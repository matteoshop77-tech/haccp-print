import { useState } from "react";
import { Search, Plus, Pin, Trash2, Pencil, X, Check, Minus, Printer } from "lucide-react";
import { format } from "date-fns";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";
import type { LabelTemplate, LabelType, IndustryProfile } from "@/lib/types";
import { PrintModal } from "@/components/labels/PrintModal";
import { printLabel } from "@/lib/printService";
import clsx from "clsx";

const typeColor: Record<string, string> = {
  ervenyesseg:   "bg-brand",
  bontas:        "bg-amber",
  termek_leiras: "bg-sky",
  custom:        "bg-violet",
};

const typeBg: Record<string, string> = {
  ervenyesseg:   "bg-brand",
  bontas:        "bg-amber",
  termek_leiras: "bg-sky",
  custom:        "bg-violet",
};

const typeActiveClass: Record<string, string> = {
  ervenyesseg:   "border-brand/40 bg-brand/10 text-brand-light",
  termek_leiras: "border-sky/40 bg-sky/10 text-sky",
  custom:        "border-violet/40 bg-violet/10 text-violet",
};

function BontasCard({ onPrint, lang }: { onPrint: (copies: number) => void; lang: "en" | "hu" }) {
  const today = format(new Date(), "dd.MM.yyyy");
  const [copies, setCopies] = useState(1);
  return (
    <div
      className="col-span-2 flex items-center justify-between px-4 py-3 rounded-lg mb-1"
      style={{ background: "#D4850A", borderColor: "#B8720A" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.20)" }}>
          <div className="w-2.5 h-2.5 rounded-full bg-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{t("type_bontas", lang)}</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>
            {today} — {lang === "hu" ? "automatikus dátum" : "today's date, automatic"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCopies((c) => Math.max(1, c - 1))}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors text-white"
          style={{ background: "rgba(255,255,255,0.20)" }}
        >
          <Minus size={12} />
        </button>
        <span className="text-sm font-semibold w-5 text-center tabular-nums text-white">
          {copies}
        </span>
        <button
          onClick={() => setCopies((c) => Math.min(200, c + 1))}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors text-white"
          style={{ background: "rgba(255,255,255,0.20)" }}
        >
          <Plus size={12} />
        </button>
        <button
          onClick={() => onPrint(copies)}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-colors ml-1 text-amber"
          style={{ background: "white" }}
        >
          <Printer size={12} />
          {t("print_btn", lang)}
        </button>
      </div>
    </div>
  );
}

function CategorySelect({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: "en" | "hu" }) {
  const categories = useStore((s) => s.categories);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input"
      style={{ appearance: "auto" }}
    >
      <option value="">{t("labels_select_category", lang)}</option>
      {categories.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
}

function LabelForm({
  initial, onSave, onCancel, lang,
}: {
  initial?: LabelTemplate;
  onSave: (data: Omit<LabelTemplate, "id" | "createdAt" | "updatedAt" | "printCount">) => void;
  onCancel: () => void;
  lang: "en" | "hu";
}) {
  const [type, setType]               = useState<LabelType>(initial?.type ?? "ervenyesseg");
  const [name, setName]               = useState(initial?.name ?? "");
  const [category, setCategory]       = useState(initial?.category ?? "");
  const [shelfLife, setShelfLife]     = useState(initial?.shelfLifeDays ?? 1);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [allergens, setAllergens]     = useState(initial?.allergens ?? "");

  const types: { value: LabelType; labelKey: Parameters<typeof t>[0] }[] = [
    { value: "ervenyesseg",   labelKey: "type_ervenyesseg" },
    { value: "termek_leiras", labelKey: "type_termek_leiras" },
    { value: "custom",        labelKey: "type_custom" },
  ];

  const isValid =
    type === "custom"
      ? name.trim().length > 0 && description.trim().length > 0
      : name.trim() && category.trim() && shelfLife > 0 &&
        (type !== "termek_leiras" || description.trim());

  const handleSubmit = () => {
    if (!isValid) return;
    onSave({
      name:          name.trim() || "Custom",
      category:      type === "custom" ? "Custom" : category.trim(),
      type,
      shelfLifeDays: type === "custom" ? 1 : shelfLife,
      description:   description.trim() || null,
      allergens:     type === "termek_leiras" ? (allergens.trim() || null) : null,
      profile:       "restaurant" as IndustryProfile,
      pinned:        initial?.pinned ?? false,
    });
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}>
      <div className="bg-app-surface border border-app-border rounded-xl w-full max-w-md mx-4 overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-app-border">
          <h2 className="text-lg font-medium text-ink-primary">
            {initial ? t("labels_form_edit", lang) : t("labels_form_new", lang)}
          </h2>
          <button onClick={onCancel} className="nav-item w-7 h-7"><X size={15} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="section-label mb-2 block">{t("labels_form_type", lang)}</label>
            <div className="grid grid-cols-3 gap-2">
              {types.map((tp) => (
                <button
                  key={tp.value}
                  onClick={() => setType(tp.value)}
                  className={clsx(
                    "py-2.5 px-3 rounded-lg border text-sm transition-colors text-center",
                    type === tp.value
                      ? typeActiveClass[tp.value]
                      : "border-app-border bg-app-elevated text-ink-secondary hover:border-app-border-hover"
                  )}
                >
                  {t(tp.labelKey, lang)}
                </button>
              ))}
            </div>
          </div>

          {type === "custom" && (
            <>
              <div>
                <label className="section-label mb-1.5 block">
                  {t("labels_form_name", lang)} <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Allergy notice"
                />
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  {t("labels_form_text", lang)} <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <textarea
                  className="input resize-none"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Write the label text..."
                  style={{ lineHeight: "1.6" }}
                />
              </div>
            </>
          )}

          {type === "ervenyesseg" && (
            <>
              <div>
                <label className="section-label mb-1.5 block">
                  {t("labels_form_product", lang)} <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tiramisù" />
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  {t("labels_form_category", lang)} <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <CategorySelect value={category} onChange={setCategory} lang={lang} />
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  {t("labels_form_shelf", lang)} <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShelfLife((d) => Math.max(1, d - 1))}
                    className="w-7 h-7 rounded-lg bg-app-elevated border border-app-border flex items-center justify-center text-brand hover:border-brand hover:bg-brand-muted transition-colors flex-shrink-0">
                    <Minus size={14} />
                  </button>
                  <span className="text-base font-medium text-ink-primary w-12 text-center tabular-nums">
                    {shelfLife} {shelfLife === 1 ? t("day", lang) : t("days", lang)}
                  </span>
                  <button onClick={() => setShelfLife((d) => Math.min(365, d + 1))}
                    className="w-7 h-7 rounded-lg bg-app-elevated border border-app-border flex items-center justify-center text-brand hover:border-brand hover:bg-brand-muted transition-colors flex-shrink-0">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </>
          )}

          {type === "termek_leiras" && (
            <>
              <div>
                <label className="section-label mb-1.5 block">
                  {t("labels_form_product", lang)} <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Panna cotta" />
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  {t("labels_form_category", lang)} <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <CategorySelect value={category} onChange={setCategory} lang={lang} />
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  {t("labels_form_shelf", lang)} <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShelfLife((d) => Math.max(1, d - 1))}
                    className="w-7 h-7 rounded-lg bg-app-elevated border border-app-border flex items-center justify-center text-brand hover:border-brand hover:bg-brand-muted transition-colors flex-shrink-0">
                    <Minus size={14} />
                  </button>
                  <span className="text-base font-medium text-ink-primary w-12 text-center tabular-nums">
                    {shelfLife} {shelfLife === 1 ? t("day", lang) : t("days", lang)}
                  </span>
                  <button onClick={() => setShelfLife((d) => Math.min(365, d + 1))}
                    className="w-7 h-7 rounded-lg bg-app-elevated border border-app-border flex items-center justify-center text-brand hover:border-brand hover:bg-brand-muted transition-colors flex-shrink-0">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  {t("labels_form_description", lang)} <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ingredients, notes..." />
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  {t("labels_form_allergens", lang)} <span className="text-ink-secondary normal-case" style={{ fontSize: "10px" }}>({t("labels_form_optional", lang)})</span>
                </label>
                <input className="input" value={allergens} onChange={(e) => setAllergens(e.target.value)} placeholder="e.g. Gluten, Milk" />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-app-border">
          <button onClick={onCancel} className="btn-ghost flex-1">{t("cancel", lang)}</button>
          <button onClick={handleSubmit} disabled={!isValid} className="btn-primary flex-[2]">
            <Check size={15} />
            {initial ? t("labels_form_save", lang) : t("labels_form_create", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

function LabelCard({
  template, lang, onPrint, onPin, onDelete, onEdit,
}: {
  template: LabelTemplate;
  lang: "en" | "hu";
  onPrint:  (t: LabelTemplate) => void;
  onPin:    (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onEdit:   (t: LabelTemplate) => void;
}) {
  return (
    <div className="card p-4 flex flex-col gap-3 group relative">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center opacity-15", typeBg[template.type])}>
            <div className={clsx("w-2.5 h-2.5 rounded-full", typeColor[template.type])} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-primary truncate">{template.name}</p>
            <p className="text-xs text-ink-secondary">{template.category} · {template.shelfLifeDays}d</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPin(template.id, !template.pinned)}
            className={clsx(
              "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
              template.pinned
                ? "text-brand bg-brand-muted"
                : "text-ink-muted hover:text-brand hover:bg-brand-muted"
            )}
          >
            <Pin size={13} />
          </button>
          <button
            onClick={() => onEdit(template)}
            className="flex items-center justify-center w-7 h-7 rounded-md transition-colors
                       text-ink-muted hover:text-amber hover:bg-amber-muted"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="flex items-center justify-center w-7 h-7 rounded-md transition-colors
                       text-ink-muted hover:text-coral hover:bg-coral-muted"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {template.description && (
        <p className="text-xs text-ink-secondary leading-relaxed line-clamp-2">{template.description}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className={clsx(
          "text-xs px-2 py-0.5 rounded-full font-medium",
          template.type === "ervenyesseg"   && "bg-brand/10 text-brand-light",
          template.type === "bontas"        && "bg-amber/10 text-amber",
          template.type === "termek_leiras" && "bg-sky/10 text-sky",
          template.type === "custom"        && "bg-violet/10 text-violet",
        )}>
          {t(`type_${template.type}` as Parameters<typeof t>[0], lang)}
        </span>
        <button onClick={() => onPrint(template)} className="btn-primary py-1.5 px-3 text-xs rounded-md">
          {t("print_btn", lang)}
        </button>
      </div>
    </div>
  );
}

export default function LabelsPage() {
  const lang           = useStore((s) => s.settings.language);
  const templates      = useStore((s) => s.templates);
  const pinTemplate    = useStore((s) => s.pinTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const addTemplate    = useStore((s) => s.addTemplate);
  const updateTemplate = useStore((s) => s.updateTemplate);
  const addPrintJob    = useStore((s) => s.addPrintJob);
  const settings       = useStore((s) => s.settings);

  const [search,        setSearch]        = useState("");
  const [selected,      setSelected]      = useState<LabelTemplate | null>(null);
  const [showForm,      setShowForm]      = useState(false);
  const [editTarget,    setEditTarget]    = useState<LabelTemplate | null>(null);
  const [bontasToast,   setBontasToast]   = useState(false);

  const filtered = templates.filter((tmpl) =>
    tmpl.name.toLowerCase().includes(search.toLowerCase()) ||
    tmpl.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveNew = (data: Omit<LabelTemplate, "id" | "createdAt" | "updatedAt" | "printCount">) => {
    addTemplate(data);
    setShowForm(false);
  };

  const handleSaveEdit = (data: Omit<LabelTemplate, "id" | "createdAt" | "updatedAt" | "printCount">) => {
    if (!editTarget) return;
    updateTemplate(editTarget.id, data);
    setEditTarget(null);
  };

  const handleBontasPrint = async (copies: number) => {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");

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
    };

    await printLabel(bontasTemplate, copies, now, lang, settings.printerName);

    if (settings.haccpLogEnabled) {
      addPrintJob({
        templateId:   "bontas-fixed",
        templateName: t("type_bontas", lang),
        labelType:    "bontas",
        copies,
        preparedDate: today,
        expiryDate:   today,
        operatorName: settings.operatorName || null,
      });
    }
    setBontasToast(true);
    setTimeout(() => setBontasToast(false), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-app-border">
        <h1 className="text-xl font-medium text-ink-primary">{t("nav_labels", lang)}</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary py-1.5 px-3 text-sm rounded-md">
          <Plus size={14} />
          {t("home_add_new", lang)}
        </button>
      </div>

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

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <BontasCard onPrint={handleBontasPrint} lang={lang} />
          {filtered.length === 0 ? (
            <div className="col-span-2 text-sm text-center py-8 text-ink-muted">
              {t("labels_none", lang)}
            </div>
          ) : (
            filtered.map((tmpl) => (
              <LabelCard
                key={tmpl.id}
                template={tmpl}
                lang={lang}
                onPrint={setSelected}
                onPin={pinTemplate}
                onDelete={deleteTemplate}
                onEdit={setEditTarget}
              />
            ))
          )}
        </div>

        {bontasToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "#D4850A" }}>
            {t("type_bontas", lang)} ✓
          </div>
        )}
      </div>

      {selected && <PrintModal template={selected} onClose={() => setSelected(null)} />}
      {showForm && <LabelForm onSave={handleSaveNew} onCancel={() => setShowForm(false)} lang={lang} />}
      {editTarget && <LabelForm initial={editTarget} onSave={handleSaveEdit} onCancel={() => setEditTarget(null)} lang={lang} />}
    </div>
  );
}