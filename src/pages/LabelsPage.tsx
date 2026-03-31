import { useState } from "react";
import { Search, Plus, Pin, Trash2, Pencil, X, Check } from "lucide-react";
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

/* ── Form per creare / modificare etichetta ── */
function LabelForm({
  initial,
  onSave,
  onCancel,
  lang,
}: {
  initial?: LabelTemplate;
  onSave: (data: Omit<LabelTemplate, "id" | "createdAt" | "updatedAt" | "printCount">) => void;
  onCancel: () => void;
  lang: "en" | "hu";
}) {
  const [name, setName]               = useState(initial?.name ?? "");
  const [category, setCategory]       = useState(initial?.category ?? "");
  const [type, setType]               = useState<LabelType>(initial?.type ?? "ervenyesseg");
  const [shelfLife, setShelfLife]     = useState(String(initial?.shelfLifeDays ?? ""));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [allergens, setAllergens]     = useState(initial?.allergens ?? "");

  const types: { value: LabelType; label: string }[] = [
    { value: "ervenyesseg",   label: "Érvényes" },
    { value: "bontas",        label: "Bontás" },
    { value: "termek_leiras", label: "Termék leírás" },
    { value: "custom",        label: "Custom" },
  ];

  const handleSubmit = () => {
    if (!name.trim() || !category.trim() || !shelfLife) return;
    onSave({
      name:          name.trim(),
      category:      category.trim(),
      type,
      shelfLifeDays: parseInt(shelfLife),
      description:   description.trim() || null,
      allergens:     allergens.trim() || null,
      profile:       "restaurant" as IndustryProfile,
      pinned:        initial?.pinned ?? false,
    });
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div className="bg-app-bg border border-app-border rounded-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-app-border">
          <h2 className="text-lg font-medium text-ink-primary">
            {initial ? "Edit label" : "New label"}
          </h2>
          <button onClick={onCancel} className="nav-item w-7 h-7">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Nome */}
          <div>
            <label className="section-label mb-1.5 block">Product name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Tiramisù"
            />
          </div>

          {/* Categoria */}
          <div>
            <label className="section-label mb-1.5 block">Category</label>
            <input
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="es. Dessert"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="section-label mb-1.5 block">Label type</label>
            <div className="grid grid-cols-2 gap-2">
              {types.map((tp) => (
                <button
                  key={tp.value}
                  onClick={() => setType(tp.value)}
                  className={clsx(
                    "py-2 px-3 rounded-lg border text-sm transition-colors text-left",
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

          {/* Giorni */}
          <div>
            <label className="section-label mb-1.5 block">Shelf life (days)</label>
            <input
              className="input"
              type="number"
              min={1}
              value={shelfLife}
              onChange={(e) => setShelfLife(e.target.value)}
              placeholder="es. 3"
            />
          </div>

          {/* Descrizione */}
          <div>
            <label className="section-label mb-1.5 block">Description (optional)</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ingredienti, note..."
            />
          </div>

          {/* Allergeni */}
          <div>
            <label className="section-label mb-1.5 block">Allergens (optional)</label>
            <input
              className="input"
              value={allergens}
              onChange={(e) => setAllergens(e.target.value)}
              placeholder="es. Glutén, Tej"
            />
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onCancel} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !category.trim() || !shelfLife}
            className="btn-primary flex-[2]"
          >
            <Check size={15} />
            {initial ? "Save changes" : "Create label"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Card singola etichetta ── */
function LabelCard({
  template,
  lang,
  onPrint,
  onPin,
  onDelete,
  onEdit,
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
            <p className="text-xs text-ink-secondary">
              {template.category} · {template.shelfLifeDays}d
            </p>
          </div>
        </div>

        {/* Azioni — sempre visibili su mobile, hover su desktop */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPin(template.id, !template.pinned)}
            className={clsx(
              "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
              template.pinned
                ? "text-brand-light bg-brand-muted"
                : "text-ink-muted hover:text-ink-secondary hover:bg-white/5 opacity-0 group-hover:opacity-100"
            )}
            title={template.pinned ? "Unpin" : "Pin to home"}
          >
            <Pin size={13} />
          </button>
          <button
            onClick={() => onEdit(template)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-ink-muted
                       hover:text-ink-secondary hover:bg-white/5 transition-colors
                       opacity-0 group-hover:opacity-100"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-ink-muted
                       hover:text-coral hover:bg-coral/10 transition-colors
                       opacity-0 group-hover:opacity-100"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {template.description && (
        <p className="text-xs text-ink-secondary leading-relaxed line-clamp-2">
          {template.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>
          {t(`type_${template.type}` as Parameters<typeof t>[0], lang)} · printed {template.printCount}×
        </span>
        <button
          onClick={() => onPrint(template)}
          className="btn-primary py-1.5 px-3 text-xs rounded-md"
        >
          Print
        </button>
      </div>
    </div>
  );
}

/* ── Pagina Labels ── */
export default function LabelsPage() {
  const lang           = useStore((s) => s.settings.language);
  const templates      = useStore((s) => s.templates);
  const pinTemplate    = useStore((s) => s.pinTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const addTemplate    = useStore((s) => s.addTemplate);
  const updateTemplate = useStore((s) => s.updateTemplate);

  const [search,      setSearch]      = useState("");
  const [selected,    setSelected]    = useState<LabelTemplate | null>(null);
  const [showForm,    setShowForm]    = useState(false);
  const [editTarget,  setEditTarget]  = useState<LabelTemplate | null>(null);

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

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-app-border">
        <h1 className="text-xl font-medium text-ink-primary">
          {t("nav_labels", lang)}
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary py-1.5 px-3 text-sm rounded-md"
        >
          <Plus size={14} />
          {t("home_add_new", lang)}
        </button>
      </div>

      {/* Search */}
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

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <p className="text-sm text-center py-12" style={{ color: "rgba(255,255,255,0.28)" }}>
            No labels found.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((tmpl) => (
              <LabelCard
                key={tmpl.id}
                template={tmpl}
                lang={lang}
                onPrint={setSelected}
                onPin={pinTemplate}
                onDelete={deleteTemplate}
                onEdit={setEditTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Print modal */}
      {selected && (
        <PrintModal template={selected} onClose={() => setSelected(null)} />
      )}

      {/* Form nuova etichetta */}
      {showForm && (
        <LabelForm
          lang={lang}
          onSave={handleSaveNew}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Form modifica etichetta */}
      {editTarget && (
        <LabelForm
          initial={editTarget}
          lang={lang}
          onSave={handleSaveEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}