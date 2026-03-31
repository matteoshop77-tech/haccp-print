import { useState } from "react";
import { Search, Plus, Pin, Trash2, Pencil, X, Check, Minus, Printer } from "lucide-react";
import { format } from "date-fns";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";
import type { LabelTemplate, LabelType, IndustryProfile } from "@/lib/types";
import { PrintModal } from "@/components/labels/PrintModal";
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

function BontasCard({ onPrint }: { onPrint: (copies: number) => void }) {
  const today = format(new Date(), "dd.MM.yyyy");
  const [copies, setCopies] = useState(1);
  return (
    <div className="col-span-2 flex items-center justify-between px-4 py-3 rounded-lg border mb-1"
      style={{ background: "rgba(239,159,39,0.07)", borderColor: "rgba(239,159,39,0.25)" }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(239,159,39,0.15)" }}>
          <div className="w-2.5 h-2.5 rounded-full bg-amber" />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.92)" }}>Bontás napja</p>
          <p className="text-xs" style={{ color: "rgba(239,159,39,0.8)" }}>{today} — data odierna automatica</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCopies((c) => Math.max(1, c - 1))}
          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
          style={{ background: "rgba(239,159,39,0.1)", color: "#EF9F27", border: "0.5px solid rgba(239,159,39,0.25)" }}
        >
          <Minus size={12} />
        </button>
        <span className="text-sm font-medium w-5 text-center tabular-nums" style={{ color: "#EF9F27" }}>
          {copies}
        </span>
        <button
          onClick={() => setCopies((c) => Math.min(200, c + 1))}
          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
          style={{ background: "rgba(239,159,39,0.1)", color: "#EF9F27", border: "0.5px solid rgba(239,159,39,0.25)" }}
        >
          <Plus size={12} />
        </button>
        <button
          onClick={() => onPrint(copies)}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ml-1"
          style={{ background: "rgba(239,159,39,0.15)", color: "#EF9F27", border: "0.5px solid rgba(239,159,39,0.3)" }}
        >
          <Printer size={12} />
          Print
        </button>
      </div>
    </div>
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

  const types: { value: LabelType; label: string }[] = [
    { value: "ervenyesseg",   label: "Érvényes" },
    { value: "termek_leiras", label: "Termék leírás" },
    { value: "custom",        label: "Custom" },
  ];

  const isValid =
    type === "custom"
      ? description.trim().length > 0
      : name.trim() && category.trim() && shelfLife > 0 &&
        (type !== "termek_leiras" || description.trim());

  const handleSubmit = () => {
    if (!isValid) return;
    onSave({
      name:          type === "custom" ? "Custom" : name.trim(),
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
      style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="bg-app-bg border border-app-border rounded-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-app-border">
          <h2 className="text-lg font-medium text-ink-primary">
            {initial ? "Edit label" : "New label"}
          </h2>
          <button onClick={onCancel} className="nav-item w-7 h-7"><X size={15} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4">

          {/* Tipo — sempre visibile */}
          <div>
            <label className="section-label mb-2 block">Label type</label>
            <div className="grid grid-cols-3 gap-2">
              {types.map((tp) => (
                <button
                  key={tp.value}
                  onClick={() => setType(tp.value)}
                  className={clsx(
                    "py-2.5 px-3 rounded-lg border text-sm transition-colors text-center",
                    type === tp.value
                      ? "border-brand bg-brand-muted text-brand-light"
                      : "border-app-border bg-app-surface text-ink-secondary hover:border-app-border-hover"
                  )}
                >
                  {tp.label}
                </button>
              ))}
            </div>
          </div>

          {/* CUSTOM — solo testo libero */}
          {type === "custom" && (
            <div>
              <label className="section-label mb-1.5 block">
                Text <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
              </label>
              <textarea
                className="input resize-none"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scrivi il testo dell'etichetta..."
                style={{ lineHeight: "1.6" }}
              />
            </div>
          )}

          {/* ÉRVÉNYES — nome, categoria, giorni */}
          {type === "ervenyesseg" && (
            <>
              <div>
                <label className="section-label mb-1.5 block">
                  Product name <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Tiramisù" />
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  Category <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="es. Dessert" />
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  Eltartható (nap) <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShelfLife((d) => Math.max(1, d - 1))}
                    className="w-7 h-7 rounded-lg bg-app-surface border border-app-border
                               flex items-center justify-center text-brand-light
                               hover:border-brand hover:bg-brand-muted transition-colors flex-shrink-0"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-base font-medium text-ink-primary w-12 text-center tabular-nums">
                    {shelfLife} {shelfLife === 1 ? "day" : "days"}
                  </span>
                  <button
                    onClick={() => setShelfLife((d) => Math.min(365, d + 1))}
                    className="w-7 h-7 rounded-lg bg-app-surface border border-app-border
                               flex items-center justify-center text-brand-light
                               hover:border-brand hover:bg-brand-muted transition-colors flex-shrink-0"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TERMÉK LEÍRÁS — tutto */}
          {type === "termek_leiras" && (
            <>
              <div>
                <label className="section-label mb-1.5 block">
                  Product name <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Panna cotta" />
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  Category <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="es. Dessert" />
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  Eltartható (nap) <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShelfLife((d) => Math.max(1, d - 1))}
                    className="w-7 h-7 rounded-lg bg-app-surface border border-app-border
                               flex items-center justify-center text-brand-light
                               hover:border-brand hover:bg-brand-muted transition-colors flex-shrink-0"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-base font-medium text-ink-primary w-12 text-center tabular-nums">
                    {shelfLife} {shelfLife === 1 ? "day" : "days"}
                  </span>
                  <button
                    onClick={() => setShelfLife((d) => Math.min(365, d + 1))}
                    className="w-7 h-7 rounded-lg bg-app-surface border border-app-border
                               flex items-center justify-center text-brand-light
                               hover:border-brand hover:bg-brand-muted transition-colors flex-shrink-0"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  Description <span className="text-coral normal-case" style={{ fontSize: "10px" }}>*</span>
                </label>
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ingredienti, note..." />
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  Allergens <span className="text-ink-secondary normal-case" style={{ fontSize: "10px" }}>(optional)</span>
                </label>
                <input className="input" value={allergens} onChange={(e) => setAllergens(e.target.value)} placeholder="es. Glutén, Tej" />
              </div>
            </>
          )}

        </div>

        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-app-border">
          <button onClick={onCancel} className="btn-ghost flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={!isValid} className="btn-primary flex-[2]">
            <Check size={15} />
            {initial ? "Save changes" : "Create label"}
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
                ? "text-brand-light bg-brand-muted"
                : "text-ink-muted hover:text-ink-secondary hover:bg-white/5 opacity-0 group-hover:opacity-100"
            )}
          >
            <Pin size={13} />
          </button>
          <button
            onClick={() => onEdit(template)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-ink-muted
                       hover:text-ink-secondary hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-ink-muted
                       hover:text-coral transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {template.description && (
        <p className="text-xs text-ink-secondary leading-relaxed line-clamp-2">{template.description}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>
          {t(`type_${template.type}` as Parameters<typeof t>[0], lang)} · printed {template.printCount}×
        </span>
        <button onClick={() => onPrint(template)} className="btn-primary py-1.5 px-3 text-xs rounded-md">
          Print
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
  const [bontasPrinted, setBontasPrinted] = useState(false);

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

  const handleBontasPrint = (copies: number) => {
    const today = format(new Date(), "yyyy-MM-dd");
    if (settings.haccpLogEnabled) {
      addPrintJob({
        templateId:   "bontas-fixed",
        templateName: "Bontás napja",
        labelType:    "bontas",
        copies,
        preparedDate: today,
        expiryDate:   today,
        operatorName: settings.operatorName || null,
      });
    }
    setBontasPrinted(true);
    setTimeout(() => setBontasPrinted(false), 2000);
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
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.28)" }} />
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
          <BontasCard onPrint={handleBontasPrint} />
          {filtered.length === 0 ? (
            <div className="col-span-2 text-sm text-center py-8" style={{ color: "rgba(255,255,255,0.28)" }}>
              No labels found.
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

        {bontasPrinted && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "rgba(239,159,39,0.15)", color: "#EF9F27", border: "0.5px solid rgba(239,159,39,0.3)" }}>
            Bontás printed ✓
          </div>
        )}
      </div>

      {selected && <PrintModal template={selected} onClose={() => setSelected(null)} />}
      {showForm && <LabelForm lang={lang} onSave={handleSaveNew} onCancel={() => setShowForm(false)} />}
      {editTarget && <LabelForm initial={editTarget} lang={lang} onSave={handleSaveEdit} onCancel={() => setEditTarget(null)} />}
    </div>
  );
}