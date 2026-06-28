import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";
import type {
  AppSettings,
  LabelTemplate,
  PrintJob,
  License,
  ConnectedAppLite,
} from "@/lib/types";

const defaultSettings: AppSettings = {
  profile:             "restaurant",
  language:            "en",
  theme:               "light",
  operatorName:        "",
  printerName:         null,
  autoCalculateExpiry: true,
  haccpLogEnabled:     true,
  quickFilters:        [],
};

interface AppStore {
  userId:     string | null;
  settings:   AppSettings;
  templates:  LabelTemplate[];
  printJobs:  PrintJob[];
  license:    License | null;
  categories: string[];
  loaded:     boolean;

  // Integration (M3): connected apps + template→app visibility map.
  connectedApps:      ConnectedAppLite[];
  templateVisibility: Record<string, string[]>; // templateId → connected_app_id[]

  loadFromCloud:      (userId: string) => Promise<void>;
  updateSettings:     (partial: Partial<AppSettings>) => void;
  updateQuickFilters: (filters: string[]) => void;
  addTemplate:        (t: Omit<LabelTemplate, "id" | "createdAt" | "updatedAt" | "printCount" | "lastCopies">, visibleToAppIds?: string[]) => void;
  updateTemplate:     (id: string, partial: Partial<LabelTemplate>, visibleToAppIds?: string[]) => void;
  updateLastCopies:   (templateId: string, copies: number) => void;
  deleteTemplate:     (id: string) => void;
  pinTemplate:        (id: string, pinned: boolean) => void;
  assignVisibilityBulk: (templateIds: string[], appIds: string[]) => void;
  unassignVisibility: (templateId: string, appId: string) => void;
  refreshConnectedApps: () => Promise<void>;
  addPrintJob:        (job: Omit<PrintJob, "id" | "printedAt">) => void;
  setLicense:         (l: License | null) => void;
  removeLicense:      () => Promise<void>;
  addCategory:        (name: string) => void;
  removeCategory:     (name: string) => void;
  resetStore:         () => void;
}

interface SupabaseError {
  error: { message: string } | null;
}

interface SupabaseResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export const useStore = create<AppStore>()((set, get) => ({
  userId:     null,
  settings:   defaultSettings,
  templates:  [],
  printJobs:  [],
  license:    null,
  categories: [],
  loaded:     false,
  connectedApps:      [],
  templateVisibility: {},

  loadFromCloud: async (userId: string) => {
    set({ userId });
    console.log("loadFromCloud called with userId:", userId);

    try {
      const queries = Promise.allSettled([
        supabase.from("settings").select("*").eq("id", userId).single(),
        supabase.from("templates").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("print_jobs").select("*").eq("user_id", userId).order("printed_at", { ascending: false }),
        supabase.from("categories").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("accounts").select("license_key, license_plan, license_expires_at, activated_at").eq("id", userId).single(),
        supabase.from("connected_apps").select("id, org_name, created_at").eq("account_id", userId).is("revoked_at", null).order("created_at", { ascending: true }),
        supabase.from("template_visibility").select("template_id, connected_app_id").eq("account_id", userId),
      ]);

      // Difesa in profondità: se anche una query Supabase resta appesa
      // (lock auth, rete morta, ecc.) il timeout evita lo spinner infinito.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("loadFromCloud timeout after 10s")), 10_000)
      );

      const [
        settingsResult,
        templatesResult,
        printJobsResult,
        categoriesResult,
        accountResult,
        connectedAppsResult,
        visibilityResult,
      ] = await Promise.race([queries, timeout]);

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
      const connectedAppsRows =
        connectedAppsResult.status === "fulfilled" ? connectedAppsResult.value.data : null;
      const visibilityRows =
        visibilityResult.status === "fulfilled" ? visibilityResult.value.data : null;

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
      if (connectedAppsResult.status === "rejected")
        console.error("connected_apps load error:", connectedAppsResult.reason);
      if (visibilityResult.status === "rejected")
        console.error("template_visibility load error:", visibilityResult.reason);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settings: AppSettings = settingsRow ? {
        profile:             (settingsRow as any).profile             ?? "restaurant",
        language:            (settingsRow as any).language            ?? "en",
        theme:               (settingsRow as any).theme               ?? "light",
        operatorName:        (settingsRow as any).operator_name       ?? "",
        printerName:         (settingsRow as any).printer_name        ?? null,
        autoCalculateExpiry: (settingsRow as any).auto_calculate_expiry ?? true,
        haccpLogEnabled:     (settingsRow as any).haccp_log_enabled   ?? true,
        quickFilters:        (settingsRow as any).quick_filters       ?? [],
      } : defaultSettings;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const templates: LabelTemplate[] = ((templatesRows ?? []) as any[]).map((r) => ({
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
        lastCopies:    r.last_copies   ?? 1,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const printJobs: PrintJob[] = ((printJobsRows ?? []) as any[]).map((r) => ({
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const categories: string[] = ((categoriesRows ?? []) as any[]).map((r) => r.name);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountRowAny = accountRow as any;
      const license: License | null =
        accountRowAny?.license_key
          ? {
              key:         accountRowAny.license_key,
              plan:        accountRowAny.license_plan ?? "basic",
              expiresAt:   accountRowAny.license_expires_at ?? "",
              deviceId:    "",
              activatedAt: accountRowAny.activated_at ?? "",
            }
          : null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connectedApps: ConnectedAppLite[] = ((connectedAppsRows ?? []) as any[]).map((r) => ({
        id:        r.id,
        orgName:   r.org_name,
        createdAt: r.created_at,
      }));

      const templateVisibility: Record<string, string[]> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of ((visibilityRows ?? []) as any[])) {
        if (!templateVisibility[r.template_id]) templateVisibility[r.template_id] = [];
        templateVisibility[r.template_id].push(r.connected_app_id);
      }

      set({ settings, templates, printJobs, categories, license, connectedApps, templateVisibility, loaded: true });

    } catch (e) {
      console.error("loadFromCloud unexpected error:", e);
      set({ loaded: true });
    }
  },

  updateSettings: (partial) => {
    const previousSettings = get().settings;
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
      quick_filters:         merged.quickFilters,
      updated_at:            new Date().toISOString(),
    }).then(({ error }: SupabaseError) => {
      if (error) {
        console.error("updateSettings failed, rolling back:", error);
        set({ settings: previousSettings });
      }
    });
  },

  updateQuickFilters: (filters) => {
    get().updateSettings({ quickFilters: filters });
  },

  addTemplate: (tmpl, visibleToAppIds) => {
    const { userId, templates: previousTemplates } = get();
    console.log("addTemplate called, userId:", userId);
    if (!userId) return;
    const now = new Date().toISOString();
    const id  = crypto.randomUUID();
    set((s) => ({
      templates: [
        ...s.templates,
        { ...tmpl, id, createdAt: now, updatedAt: now, printCount: 0, lastCopies: 1 },
      ],
      // Optimistic visibility for the new template. The DB rows are written only
      // AFTER the template row commits (template_visibility.template_id FK).
      templateVisibility:
        visibleToAppIds && visibleToAppIds.length > 0
          ? { ...s.templateVisibility, [id]: [...visibleToAppIds] }
          : s.templateVisibility,
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
      last_copies:     1,
      created_at:      now,
      updated_at:      now,
    }).then(({ data, error }: SupabaseResult<unknown>) => {
      console.log("templates insert result:", { data, error });
      if (error) {
        console.error("addTemplate failed, rolling back:", error);
        set((s) => {
          const nextVis = { ...s.templateVisibility };
          delete nextVis[id];
          return { templates: previousTemplates, templateVisibility: nextVis };
        });
        return;
      }
      // Template committed → now safe to write visibility rows (FK satisfied).
      if (visibleToAppIds && visibleToAppIds.length > 0) {
        const rows = visibleToAppIds.map((appId) => ({
          template_id:      id,
          connected_app_id: appId,
          account_id:       userId,
        }));
        supabase.from("template_visibility").insert(rows).then(({ error: vErr }: SupabaseError) => {
          if (vErr) console.error("addTemplate visibility insert failed:", vErr);
        });
      }
    });
  },

  updateTemplate: (id, partial, visibleToAppIds) => {
    const { userId, templates: previousTemplates } = get();
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
    }).eq("id", id).eq("user_id", userId ?? "").then(({ error }: SupabaseError) => {
      if (error) {
        console.error("updateTemplate failed, rolling back:", error);
        set({ templates: previousTemplates });
      }
    });

    // Visibility diff (R11): incremental insert/delete, never wipe + reinsert.
    // Only runs when the caller passed visibleToAppIds; otherwise behavior is
    // identical to before (additive, backward compatible).
    if (visibleToAppIds !== undefined) {
      const current  = get().templateVisibility[id] ?? [];
      const target   = visibleToAppIds;
      const toAdd    = target.filter((a) => !current.includes(a));
      const toRemove = current.filter((a) => !target.includes(a));

      set((s) => ({
        templateVisibility: { ...s.templateVisibility, [id]: [...target] },
      }));

      if (toAdd.length > 0 && userId) {
        const rows = toAdd.map((appId) => ({
          template_id:      id,
          connected_app_id: appId,
          account_id:       userId,
        }));
        supabase.from("template_visibility").insert(rows).then(({ error }: SupabaseError) => {
          if (error) console.error("updateTemplate visibility insert failed:", error);
        });
      }
      if (toRemove.length > 0) {
        supabase.from("template_visibility").delete()
          .eq("template_id", id)
          .in("connected_app_id", toRemove)
          .then(({ error }: SupabaseError) => {
            if (error) console.error("updateTemplate visibility delete failed:", error);
          });
      }
    }
  },

  updateLastCopies: (templateId, copies) => {
    const { userId, templates: previousTemplates } = get();
    if (!userId) return;
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === templateId ? { ...t, lastCopies: copies } : t
      ),
    }));
    supabase
      .from("templates")
      .update({ last_copies: copies })
      .eq("id", templateId)
      .eq("user_id", userId)
      .then(({ error }: SupabaseError) => {
        if (error) {
          console.error("updateLastCopies failed, rolling back:", error);
          set({ templates: previousTemplates });
        }
      });
  },

  deleteTemplate: (id) => {
    const { userId, templates: previousTemplates } = get();
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
    supabase.from("templates").delete()
      .eq("id", id)
      .eq("user_id", userId ?? "")
      .then(({ error }: SupabaseError) => {
        if (error) {
          console.error("deleteTemplate failed, rolling back:", error);
          set({ templates: previousTemplates });
        }
      });
  },

  pinTemplate: (id, pinned) => {
    const { userId, templates: previousTemplates } = get();
    set((s) => ({
      templates: s.templates.map((t) => (t.id === id ? { ...t, pinned } : t)),
    }));
    supabase
      .from("templates")
      .update({ pinned })
      .eq("id", id)
      .eq("user_id", userId ?? "")
      .then(({ error }: SupabaseError) => {
        if (error) {
          console.error("pinTemplate failed, rolling back:", error);
          set({ templates: previousTemplates });
        } else {
          console.log("pinTemplate success — id:", id, "pinned:", pinned);
        }
      });
  },

  assignVisibilityBulk: (templateIds, appIds) => {
    const { userId } = get();
    if (!userId || templateIds.length === 0 || appIds.length === 0) return;

    const nextVis = { ...get().templateVisibility };
    const rows: { template_id: string; connected_app_id: string; account_id: string }[] = [];

    for (const tId of templateIds) {
      const merged = [...(nextVis[tId] ?? [])];
      for (const aId of appIds) {
        if (!merged.includes(aId)) {
          merged.push(aId);
          rows.push({ template_id: tId, connected_app_id: aId, account_id: userId });
        }
      }
      nextVis[tId] = merged;
    }

    set({ templateVisibility: nextVis });

    if (rows.length > 0) {
      supabase.from("template_visibility").insert(rows).then(({ error }: SupabaseError) => {
        if (error) console.error("assignVisibilityBulk failed:", error);
      });
    }
  },

  unassignVisibility: (templateId, appId) => {
    const { userId } = get();
    if (!userId) return;
    set((s) => ({
      templateVisibility: {
        ...s.templateVisibility,
        [templateId]: (s.templateVisibility[templateId] ?? []).filter((a) => a !== appId),
      },
    }));
    supabase.from("template_visibility").delete()
      .eq("template_id", templateId)
      .eq("connected_app_id", appId)
      .then(({ error }: SupabaseError) => {
        if (error) console.error("unassignVisibility failed:", error);
      });
  },

  // Re-query active connected apps (e.g. after a revoke in Settings) so the UI
  // reflects the change without an app restart (M5 bug fix 2).
  refreshConnectedApps: async () => {
    const { userId } = get();
    if (!userId) return;
    const { data, error } = await supabase
      .from("connected_apps")
      .select("id, org_name, created_at")
      .eq("account_id", userId)
      .is("revoked_at", null)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("refreshConnectedApps failed:", error.message);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connectedApps: ConnectedAppLite[] = ((data ?? []) as any[]).map((r) => ({
      id:        r.id,
      orgName:   r.org_name,
      createdAt: r.created_at,
    }));
    set({ connectedApps });
  },

  addPrintJob: (job) => {
    const { userId, printJobs: previousPrintJobs, templates: previousTemplates } = get();
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
    }).then(({ data, error }: SupabaseResult<unknown>) => {
      console.log("print_jobs insert result:", { data, error });
      if (error) {
        console.error("addPrintJob failed, rolling back:", error);
        set({ printJobs: previousPrintJobs, templates: previousTemplates });
      }
    });
  },

  setLicense: (l) => {
    const previousLicense = get().license;
    set({ license: l ?? null });
    const { userId } = get();
    // null = clear locale-only (per la persistenza esiste removeLicense).
    if (!userId || !l) return;
    supabase.from("accounts").update({
      license_key:        l.key,
      license_plan:       l.plan,
      license_expires_at: l.expiresAt,
      activated_at:       l.activatedAt,
    }).eq("id", userId).then(({ error }: SupabaseError) => {
      if (error) {
        console.error("setLicense failed, rolling back:", error);
        set({ license: previousLicense });
      }
    });
  },

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
    const { userId, categories: previousCategories } = get();
    console.log("addCategory called, userId:", userId);
    if (!userId) return;
    const trimmed = name.trim();
    if (previousCategories.includes(trimmed)) return;
    set((s) => ({ categories: [...s.categories, trimmed] }));
    supabase.from("categories").insert({
      user_id: userId,
      name:    trimmed,
    }).then(({ data, error }: SupabaseResult<unknown>) => {
      console.log("categories insert result:", { data, error });
      if (error) {
        console.error("addCategory failed, rolling back:", error);
        set({ categories: previousCategories });
      }
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
      connectedApps:      [],
      templateVisibility: {},
    });
  },
}));