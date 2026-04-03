import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";
import type {
  AppSettings,
  LabelTemplate,
  PrintJob,
  License,
} from "@/lib/types";

const defaultSettings: AppSettings = {
  profile:             "restaurant",
  language:            "en",
  theme:               "light",
  operatorName:        "",
  printerName:         null,
  autoCalculateExpiry: true,
  haccpLogEnabled:     true,
};

interface AppStore {
  userId:     string | null;
  settings:   AppSettings;
  templates:  LabelTemplate[];
  printJobs:  PrintJob[];
  license:    License | null;
  categories: string[];
  loaded:     boolean;

  loadFromCloud:   (userId: string) => Promise<void>;
  updateSettings:  (partial: Partial<AppSettings>) => void;
  addTemplate:     (t: Omit<LabelTemplate, "id" | "createdAt" | "updatedAt" | "printCount">) => void;
  updateTemplate:  (id: string, partial: Partial<LabelTemplate>) => void;
  deleteTemplate:  (id: string) => void;
  pinTemplate:     (id: string, pinned: boolean) => void;
  addPrintJob:     (job: Omit<PrintJob, "id" | "printedAt">) => void;
  setLicense:      (l: License | null) => void;
  addCategory:     (name: string) => void;
  removeCategory:  (name: string) => void;
}

export const useStore = create<AppStore>()((set, get) => ({
  userId:     null,
  settings:   defaultSettings,
  templates:  [],
  printJobs:  [],
  license:    null,
  categories: [],
  loaded:     false,

  loadFromCloud: async (userId: string) => {
    set({ userId });
    console.log("loadFromCloud called with userId:", userId);

    const [
      { data: settingsRow },
      { data: templatesRows },
      { data: printJobsRows },
      { data: categoriesRows },
    ] = await Promise.all([
      supabase.from("settings").select("*").eq("id", userId).single(),
      supabase.from("templates").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("print_jobs").select("*").eq("user_id", userId).order("printed_at", { ascending: false }),
      supabase.from("categories").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    ]);

    console.log("loadFromCloud results:", { settingsRow, templatesRows, printJobsRows, categoriesRows });

    const settings: AppSettings = settingsRow ? {
      profile:             settingsRow.profile             ?? "restaurant",
      language:            settingsRow.language            ?? "en",
      theme:               settingsRow.theme               ?? "light",
      operatorName:        settingsRow.operator_name       ?? "",
      printerName:         settingsRow.printer_name        ?? null,
      autoCalculateExpiry: settingsRow.auto_calculate_expiry ?? true,
      haccpLogEnabled:     settingsRow.haccp_log_enabled   ?? true,
    } : defaultSettings;

    const templates: LabelTemplate[] = (templatesRows ?? []).map((r) => ({
      id:            r.id,
      name:          r.name,
      type:          r.type,
      category:      r.category,
      description:   r.description   ?? null,
      shelfLifeDays: r.shelf_life_days,
      allergens:     r.allergens     ?? null,
      profile:       r.profile,
      pinned:        r.pinned,
      printCount:    r.print_count,
      createdAt:     r.created_at,
      updatedAt:     r.updated_at,
    }));

    const printJobs: PrintJob[] = (printJobsRows ?? []).map((r) => ({
      id:           r.id,
      templateId:   r.template_id   ?? "",
      templateName: r.template_name,
      labelType:    r.label_type,
      copies:       r.copies,
      printedAt:    r.printed_at,
      preparedDate: r.prepared_date,
      expiryDate:   r.expiry_date,
      operatorName: r.operator_name ?? null,
    }));

    const categories: string[] = (categoriesRows ?? []).map((r) => r.name);

    set({ settings, templates, printJobs, categories, loaded: true });
  },

  updateSettings: (partial) => {
    set((s) => ({ settings: { ...s.settings, ...partial } }));
    const { userId, settings } = get();
    if (!userId) return;
    const merged = { ...settings, ...partial };
    supabase.from("settings").upsert({
      id:                    userId,
      profile:               merged.profile,
      language:              merged.language,
      theme:                 merged.theme,
      operator_name:         merged.operatorName,
      printer_name:          merged.printerName,
      auto_calculate_expiry: merged.autoCalculateExpiry,
      haccp_log_enabled:     merged.haccpLogEnabled,
      updated_at:            new Date().toISOString(),
    });
  },

  addTemplate: (tmpl) => {
    const { userId } = get();
    console.log("addTemplate called, userId:", userId);
    if (!userId) return;
    const now = new Date().toISOString();
    const id  = crypto.randomUUID();
    set((s) => ({
      templates: [
        ...s.templates,
        { ...tmpl, id, createdAt: now, updatedAt: now, printCount: 0 },
      ],
    }));
    supabase.from("templates").insert({
      id,
      user_id:         userId,
      name:            tmpl.name,
      type:            tmpl.type,
      category:        tmpl.category,
      description:     tmpl.description,
      shelf_life_days: tmpl.shelfLifeDays,
      allergens:       tmpl.allergens,
      profile:         tmpl.profile,
      pinned:          tmpl.pinned,
      print_count:     0,
      created_at:      now,
      updated_at:      now,
    }).then(({ data, error }) => {
      console.log("templates insert result:", { data, error });
    });
  },

  updateTemplate: (id, partial) => {
    const now = new Date().toISOString();
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === id ? { ...t, ...partial, updatedAt: now } : t
      ),
    }));
    const updated = get().templates.find((t) => t.id === id);
    if (!updated) return;
    supabase.from("templates").update({
      name:            updated.name,
      type:            updated.type,
      category:        updated.category,
      description:     updated.description,
      shelf_life_days: updated.shelfLifeDays,
      allergens:       updated.allergens,
      profile:         updated.profile,
      pinned:          updated.pinned,
      print_count:     updated.printCount,
      updated_at:      now,
    }).eq("id", id);
  },

  deleteTemplate: (id) => {
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
    supabase.from("templates").delete().eq("id", id);
  },

  pinTemplate: (id, pinned) => {
    set((s) => ({
      templates: s.templates.map((t) => (t.id === id ? { ...t, pinned } : t)),
    }));
    supabase.from("templates").update({ pinned }).eq("id", id);
  },

  addPrintJob: (job) => {
    const { userId } = get();
    if (!userId) return;
    const id  = crypto.randomUUID();
    const now = new Date().toISOString();
    const fullJob: PrintJob = { ...job, id, printedAt: now };
    set((s) => ({
      printJobs: [fullJob, ...s.printJobs],
      templates: s.templates.map((t) =>
        t.id === job.templateId
          ? { ...t, printCount: t.printCount + job.copies }
          : t
      ),
    }));
    supabase.from("print_jobs").insert({
      id,
      user_id:       userId,
      template_id:   job.templateId   || null,
      template_name: job.templateName,
      label_type:    job.labelType,
      copies:        job.copies,
      printed_at:    now,
      prepared_date: job.preparedDate,
      expiry_date:   job.expiryDate,
      operator_name: job.operatorName ?? null,
    }).then(({ data, error }) => {
      console.log("print_jobs insert result:", { data, error });
    });
  },

  setLicense: (l) => set({ license: l ?? null }),

  addCategory: (name) => {
    const { userId } = get();
    console.log("addCategory called, userId:", userId);
    if (!userId) return;
    const trimmed = name.trim();
    if (get().categories.includes(trimmed)) return;
    set((s) => ({ categories: [...s.categories, trimmed] }));
    supabase.from("categories").insert({
      user_id: userId,
      name:    trimmed,
    }).then(({ data, error }) => {
      console.log("categories insert result:", { data, error });
    });
  },

  removeCategory: (name) => {
    const { userId } = get();
    if (!userId) return;
    set((s) => ({ categories: s.categories.filter((c) => c !== name) }));
    supabase.from("categories").delete()
      .eq("user_id", userId)
      .eq("name", name);
  },
}));