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
  removeLicense:   () => Promise<void>;
  addCategory:     (name: string) => void;
  removeCategory:  (name: string) => void;
  resetStore:      () => void;
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

    try {
      const [
        settingsResult,
        templatesResult,
        printJobsResult,
        categoriesResult,
        accountResult,
      ] = await Promise.allSettled([
        supabase.from("settings").select("*").eq("id", userId).single(),
        supabase.from("templates").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("print_jobs").select("*").eq("user_id", userId).order("printed_at", { ascending: false }),
        supabase.from("categories").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("accounts").select("license_key, license_plan, license_expires_at, activated_at").eq("id", userId).single(),
      ]);

      const settingsRow =
        settingsResult.status === "fulfilled" ? settingsResult.value.data : null;
      const templatesRows =
        templatesResult.status === "fulfilled" ? templatesResult.value.data : null;
      const printJobsRows =
        printJobsResult.status === "fulfilled" ? printJobsResult.value.data : null;
      const categoriesRows =
        categoriesResult.status === "fulfilled" ? categoriesResult.value.data : null;
      const accountRow =
        accountResult.status === "fulfilled" ? accountResult.value.data : null;

      if (settingsResult.status === "rejected")
        console.error("settings load error:", settingsResult.reason);
      if (templatesResult.status === "rejected")
        console.error("templates load error:", templatesResult.reason);
      if (printJobsResult.status === "rejected")
        console.error("print_jobs load error:", printJobsResult.reason);
      if (categoriesResult.status === "rejected")
        console.error("categories load error:", categoriesResult.reason);
      if (accountResult.status === "rejected")
        console.error("account load error:", accountResult.reason);

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

      // Ricostruisce la licenza dai dati di accounts se presente
      const license: License | null =
        accountRow?.license_key
          ? {
              key:         accountRow.license_key,
              plan:        accountRow.license_plan ?? "basic",
              expiresAt:   accountRow.license_expires_at ?? "",
              deviceId:    "",   // non lo salviamo su DB, non è necessario
              activatedAt: accountRow.activated_at ?? "",
            }
          : null;

      set({ settings, templates, printJobs, categories, license, loaded: true });

    } catch (e) {
      console.error("loadFromCloud unexpected error:", e);
      set({ loaded: true });
    }
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
      }).then(({ error }) => {
      if (error) console.error("updateSettings error:", error);
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
    const { userId } = get();
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
    }).eq("id", id).eq("user_id", userId ?? "").then(({ error }) => {
      if (error) console.error("updateTemplate error:", error);
    });
  },

  deleteTemplate: (id) => {
    const { userId } = get();
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
    supabase.from("templates").delete()
      .eq("id", id)
      .eq("user_id", userId ?? "")
      .then(({ error }) => {
        if (error) console.error("deleteTemplate error:", error);
      });
  },

  pinTemplate: (id, pinned) => {
    const { userId } = get();
    set((s) => ({
      templates: s.templates.map((t) => (t.id === id ? { ...t, pinned } : t)),
    }));
    supabase
      .from("templates")
      .update({ pinned })
      .eq("id", id)
      .eq("user_id", userId ?? "")
      .then(({ error }) => {
        if (error) console.error("pinTemplate error:", error);
        else console.log("pinTemplate success — id:", id, "pinned:", pinned);
      });
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

  removeLicense: async () => {
    const { userId } = get();
    set({ license: null });
    if (!userId) return;
    await supabase
      .from("accounts")
      .update({
        license_key:        null,
        license_plan:       null,
        license_expires_at: null,
        activated_at:       null,
      })
      .eq("id", userId);
  },

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

  resetStore: () => {
    set({
      userId:     null,
      settings:   defaultSettings,
      templates:  [],
      printJobs:  [],
      license:    null,
      categories: [],
      loaded:     false,
    });
  },
}));