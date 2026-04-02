import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppSettings,
  LabelTemplate,
  PrintJob,
  License,
} from "@/lib/types";

const defaultCategories = [
  "Dessert", "Pasta", "Meat", "Fish", "Sauces",
  "Soup", "Appetizer", "Bread", "Beverages", "Other",
];

const defaultSettings: AppSettings = {
  profile:             "restaurant",
  language:            "en",
  theme:               "light",
  operatorName:        "",
  printerName:         null,
  autoCalculateExpiry: true,
  haccpLogEnabled:     true,
};

const demoTemplates: LabelTemplate[] = [
  {
    id: "demo-1",
    name: "Tiramisù",
    type: "ervenyesseg",
    category: "Dessert",
    description: "Mascarpone, eggs, ladyfingers, coffee, cocoa",
    shelfLifeDays: 3,
    allergens: "Gluten, Eggs, Dairy",
    profile: "restaurant",
    pinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    printCount: 24,
  },
  {
    id: "demo-2",
    name: "Classic Lasagna",
    type: "bontas",
    category: "Pasta",
    description: null,
    shelfLifeDays: 1,
    allergens: "Gluten, Eggs, Dairy",
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
    description: "Cream, sugar, vanilla, gelatin",
    shelfLifeDays: 2,
    allergens: "Dairy",
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
    allergens: "Eggs, Dairy",
    profile: "restaurant",
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    printCount: 6,
  },
  {
    id: "demo-5",
    name: "Bolognese ragù",
    type: "bontas",
    category: "Sauces",
    description: null,
    shelfLifeDays: 1,
    allergens: "Gluten, Dairy",
    profile: "restaurant",
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    printCount: 31,
  },
];

interface AppStore {
  settings:   AppSettings;
  templates:  LabelTemplate[];
  printJobs:  PrintJob[];
  license:    License | null;
  categories: string[];

  updateSettings:  (partial: Partial<AppSettings>) => void;
  addTemplate:     (t: Omit<LabelTemplate, "id" | "createdAt" | "updatedAt" | "printCount">) => void;
  updateTemplate:  (id: string, partial: Partial<LabelTemplate>) => void;
  deleteTemplate:  (id: string) => void;
  pinTemplate:     (id: string, pinned: boolean) => void;
  addPrintJob:     (job: Omit<PrintJob, "id" | "printedAt">) => void;
  setLicense:      (l: License) => void;
  addCategory:     (name: string) => void;
  removeCategory:  (name: string) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      settings:   defaultSettings,
      templates:  demoTemplates,
      printJobs:  [],
      license:    null,
      categories: defaultCategories,

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

      addCategory: (name) =>
        set((s) => ({
          categories: s.categories.includes(name)
            ? s.categories
            : [...s.categories, name.trim()],
        })),

      removeCategory: (name) =>
        set((s) => ({
          categories: s.categories.filter((c) => c !== name),
        })),
    }),
    { name: "haccp-print-store" }
  )
);