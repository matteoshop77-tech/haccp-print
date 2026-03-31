import { useState } from "react";
import { Search, Plus, Pin, Trash2, Pencil } from "lucide-react";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";
import type { LabelTemplate } from "@/lib/types";
import { PrintModal } from "@/components/labels/PrintModal";
import clsx from "clsx";

const typeColor: Record<string, string> = {
  ervenyesseg:   "bg-brand",
  bontas:        "bg-amber",
  termek_leiras: "bg-sky",
  custom:        "bg-violet",
};

const typeBg: Record<string, string> = {
  ervenyesseg:   "bg-brand/10",
  bontas:        "bg-amber/10",
  termek_leiras: "bg-sky/10",
  custom:        "bg-violet/10",
};

function LabelCard({
  template,
  lang,
  onPrint,
  onPin,
  onDelete,
}: {
  template: LabelTemplate;
  lang: "en" | "hu";
  onPrint:  (t: LabelTemplate) => void;
  onPin:    (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="card p-4 flex flex-col gap-3 group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", typeBg[template.type])}>
            <div className={clsx("w-2.5 h-2.5 rounded-full", typeColor[template.type])} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-primary truncate">{template.name}</p>
            <p className="text-xs text-ink-muted">
              {template.category} · {template.shelfLifeDays}d
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onPin(template.id, !template.pinned)}
            className={clsx(
              "nav-item w-7 h-7",
              template.pinned && "text-brand-light"
            )}
            title={template.pinned ? "Unpin" : "Pin to home"}
          >
            <Pin size={13} />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="nav-item w-7 h-7 hover:text-coral"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {template.description && (
        <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">
          {template.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-2xs text-ink-faint">
          {t(`type_${template.type}` as Parameters<typeof t>[0], lang)} ·{" "}
          printed {template.printCount}×
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

export default function LabelsPage() {
  const lang      = useStore((s) => s.settings.language);
  const templates = useStore((s) => s.templates);
  const pinTemplate    = useStore((s) => s.pinTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);

  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<LabelTemplate | null>(null);

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-app-border">
        <h1 className="text-xl font-medium text-ink-primary">
          {t("nav_labels", lang)}
        </h1>
        <button className="btn-primary py-1.5 px-3 text-sm rounded-md">
          <Plus size={14} />
          {t("home_add_new", lang)}
        </button>
      </div>

      {/* Search */}
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

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-12">No labels found.</p>
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
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <PrintModal template={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
