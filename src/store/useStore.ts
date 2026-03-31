import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppSettings,
  LabelTemplate,
  PrintJob,
  License,
} from "@/lib/types";
import { format } from "date-fns";

/* ── Default settings ── */
const defaultSettings: AppSettings = {
  profile:              "restaurant",
  language:             "en",
  theme:                "dark",
  operatorName:         "",
  printerName:          null,
  autoCalculateExpiry:  true,
  haccpLogEnabled:      true,
};

/* ── Demo templates ── */
const demoTemplates: LabelTemplate[] = [
  {
    id: "demo-1",
    name: "Tiramisù",
    type: "ervenyesseg",
    category: "Dessert",
    description: "Mascarpone, uova, savoiardi, caffè, cacao",
    shelfLifeDays: 3,
    allergens: "Glutén, Tojás, Tejszármazék",
    profile: "restaurant",
    pinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    printCount: 24,
  },
  {
    id: "demo-2",
    name: "Lasagna classica",
    type: "bontas",
    category: "Pasta",
    description: null,
    shelfLifeDays: 1,
    allergens: "Glutén, Tojás, Tej",
    profile: "restaurant",
    pinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    printCount: 18,
  },
  {
    id: "demo-3",
    name: "Panna cotta",
    type: "termek_leiras",
    category: "Dessert",
    description: "Tejszín, cukor, vanília, zselatin",
    shelfLifeDays: 2,
    allergens: "Tejszármazék",
    profile: "restaurant",
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    printCount: 9,
  },
  {
    id: "demo-4",
    name: "Crema catalana",
    type: "ervenyesseg",
    category: "Dessert",
    description: null,
    shelfLifeDays: 2,
    allergens: "Tojás, Tejszármazék",
    profile: "restaurant",
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    printCount: 6,
  },
  {
    id: "demo-5",
    name: "Ragù bolognese",
    type: "bontas",
    category: "Sauce",
    description: null,
    shelfLifeDays: 1,
    allergens: "Glutén, Tej",
    profile: "restaurant",
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    printCount: 31,
  },
];

/* ── Store interface ── */
interface AppStore {
  settings:   AppSettings;
  templates:  LabelTemplate[];
  printJobs:  PrintJob[];
  license:    License | null;

  /* Settings actions */
  updateSettings: (partial: Partial<AppSettings>) => void;

  /* Template actions */
  addTemplate:    (t: Omit<LabelTemplate, "id" | "createdAt" | "updatedAt" | "printCount">) => void;
  updateTemplate: (id: string, partial: Partial<LabelTemplate>) => void;
  deleteTemplate: (id: string) => void;
  pinTemplate:    (id: string, pinned: boolean) => void;

  /* Print actions */
  addPrintJob: (job: Omit<PrintJob, "id" | "printedAt">) => void;

  /* License */
  setLicense: (l: License) => void;

  /* Helpers */
  pinnedTemplates:  () => LabelTemplate[];
  recentPrintJobs:  (n?: number) => PrintJob[];
  todayPrintCount:  () => number;
  expiringTomorrow: () => number;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      settings:  defaultSettings,
      templates: demoTemplates,
      printJobs: [],
      license:   null,

      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),

      addTemplate: (tmpl) => {
        const now = new Date().toISOString();
        set((s) => ({
          templates: [
            ...s.templates,
            { ...tmpl, id: crypto.randomUUID(), createdAt: now, updatedAt: now, printCount: 0 },
          ],
        }));
      },

      updateTemplate: (id, partial) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, ...partial, updatedAt: new Date().toISOString() } : t
          ),
        })),

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      pinTemplate: (id, pinned) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? { ...t, pinned } : t)),
        })),

      addPrintJob: (job) => {
        const fullJob: PrintJob = {
          ...job,
          id:        crypto.randomUUID(),
          printedAt: new Date().toISOString(),
        };
        set((s) => ({
          printJobs: [fullJob, ...s.printJobs],
          templates: s.templates.map((t) =>
            t.id === job.templateId
              ? { ...t, printCount: t.printCount + job.copies }
              : t
          ),
        }));
      },

      setLicense: (l) => set({ license: l }),

      pinnedTemplates: () =>
        get().templates.filter((t) => t.pinned).slice(0, 8),

      recentPrintJobs: (n = 5) => get().printJobs.slice(0, n),

      todayPrintCount: () => {
        const today = format(new Date(), "yyyy-MM-dd");
        return get().printJobs
          .filter((j) => j.printedAt.startsWith(today))
          .reduce((sum, j) => sum + j.copies, 0);
      },

      expiringTomorrow: () => {
        const tomorrow = format(
          new Date(Date.now() + 86_400_000),
          "yyyy-MM-dd"
        );
        return get().printJobs.filter((j) => j.expiryDate === tomorrow).length;
      },
    }),
    { name: "haccp-print-store" }
  )
);
