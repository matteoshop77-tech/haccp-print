import { useState } from "react";
import { X, Check, Minus, Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import { t } from "@/lib/i18n";
import type { LabelTemplate, LabelType, IndustryProfile } from "@/lib/types";
import clsx from "clsx";

const typeActiveClass: Record<string, string> = {
  ervenyesseg:   "border-brand/40 bg-brand/10 text-brand-light",
  termek_leiras: "border-sky/40 bg-sky/10 text-sky",
  custom:        "border-violet/40 bg-violet/10 text-violet",
};

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

export type LabelFormData = Omit<
  LabelTemplate,
  "id" | "createdAt" | "updatedAt" | "printCount" | "lastCopies"
>;

interface LabelFormProps {
  template: LabelTemplate | null;
  onSave:   (data: LabelFormData) => void;
  onClose:  () => void;
}

export function LabelForm({ template, onSave, onClose }: LabelFormProps) {
  const lang = useStore((s) => s.settings.language);

  const [type, setType]               = useState<LabelType>(template?.type ?? "ervenyesseg");
  const [name, setName]               = useState(template?.name ?? "");
  const [category, setCategory]       = useState(template?.category ?? "");
  const [shelfLife, setShelfLife]     = useState(template?.shelfLifeDays ?? 1);
  const [description, setDescription] = useState(template?.description ?? "");
  const [allergens, setAllergens]     = useState(template?.allergens ?? "");

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
      pinned:        template?.pinned ?? false,
    });
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}>
      <div className="bg-app-surface border border-app-border rounded-xl w-full max-w-md mx-4 overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-app-border">
          <h2 className="text-lg font-medium text-ink-primary">
            {template ? t("labels_form_edit", lang) : t("labels_form_new", lang)}
          </h2>
          <button onClick={onClose} className="nav-item w-7 h-7"><X size={15} /></button>
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
          <button onClick={onClose} className="btn-ghost flex-1">{t("cancel", lang)}</button>
          <button onClick={handleSubmit} disabled={!isValid} className="btn-primary flex-[2]">
            <Check size={15} />
            {template ? t("labels_form_save", lang) : t("labels_form_create", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
