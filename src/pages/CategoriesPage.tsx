import { useState } from "react";
import { Plus, Trash2, Layers } from "lucide-react";
import { useStore } from "@/store/useStore";

export default function CategoriesPage() {
  const categories     = useStore((s) => s.categories);
  const addCategory    = useStore((s) => s.addCategory);
  const removeCategory = useStore((s) => s.removeCategory);
  const templates      = useStore((s) => s.templates);

  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addCategory(trimmed);
    setNewName("");
  };

  const usageCount = (cat: string) =>
    templates.filter((t) => t.category === cat).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-5 pb-4 flex-shrink-0 border-b border-app-border">
        <Layers size={18} className="text-brand-light" />
        <h1 className="text-xl font-medium text-ink-primary">Categories</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

        {/* Aggiungi nuova */}
        <div>
          <p className="section-label mb-3">Add category</p>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="es. Antipasto..."
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="btn-primary px-4"
            >
              <Plus size={15} />
              Add
            </button>
          </div>
        </div>

        {/* Lista categorie */}
        <div>
          <p className="section-label mb-3">
            {categories.length} {categories.length === 1 ? "category" : "categories"}
          </p>
          <div className="flex flex-col gap-2">
            {categories.map((cat) => {
              const count = usageCount(cat);
              return (
                <div
                  key={cat}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-app-border bg-app-surface"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-light flex-shrink-0" />
                    <span className="text-sm text-ink-primary">{cat}</span>
                    {count > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(29,158,117,0.12)", color: "#5DCAA5" }}>
                        {count} {count === 1 ? "label" : "labels"}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeCategory(cat)}
                    disabled={count > 0}
                    className="flex items-center justify-center w-7 h-7 rounded-md text-ink-muted
                               hover:text-coral hover:bg-coral/10 transition-colors
                               disabled:opacity-30 disabled:cursor-not-allowed"
                    title={count > 0 ? "In use — cannot delete" : "Delete"}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info */}
        <p className="text-xs text-ink-muted">
          Categories in use cannot be deleted. Remove the labels first.
        </p>

      </div>
    </div>
  );
}