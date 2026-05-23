import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { invoke }       from "@tauri-apps/api/core";
import { AppShell }     from "@/components/layout/AppShell";
import HomePage         from "@/pages/HomePage";
import LabelsPage       from "@/pages/LabelsPage";
import LogPage          from "@/pages/LogPage";
import SettingsPage     from "@/pages/SettingsPage";
import CategoriesPage   from "@/pages/CategoriesPage";
import AuthPage         from "@/pages/AuthPage";
import { supabase }     from "@/lib/supabaseClient";
import { useAuthStore } from "@/lib/authStore";
import { useStore }     from "@/store/useStore";
import UpdateChecker from "@/components/UpdateChecker";

export default function App() {
  const { user, setAuth, setTrialStart, setOrganizationName, clearAuth } = useAuthStore();
  const { loadFromCloud, resetStore, loaded } = useStore();
  const [checking, setChecking] = useState(true);

  // Effetto 1 — solo stato auth. Niente await Supabase qui dentro: il
  // callback gira dentro al lock di GoTrueClient e qualsiasi query
  // si appenderebbe (deadlock → spinner infinito).
  useEffect(() => {
    let mounted = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session?.user) {
        setAuth(session.user, session);
        setChecking(false);
      } else if (event === "INITIAL_SESSION") {
        // Nessuna sessione all'avvio → AuthPage.
        setChecking(false);
      } else if (event === "SIGNED_OUT") {
        resetStore();
        clearAuth();
        setChecking(false);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setAuth(session.user, session);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Effetto 2 — caricamento dati fuori dal lock auth. Dipende da user?.id
  // così loadFromCloud parte una volta sola per utente (sia per sessione
  // ripristinata sia per login fresco).
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    async function loadAccountData(userId: string) {
      try {
        const { data } = await supabase
          .from("accounts")
          .select("trial_started_at, organization_name")
          .eq("id", userId)
          .single();
        if (mounted) {
          if (data?.trial_started_at) setTrialStart(data.trial_started_at);
          if (data?.organization_name) setOrganizationName(data.organization_name);
        }
      } catch (e) {
        console.error("loadAccountData error:", e);
      }
    }

    // Zero-config: al primo avvio, se nessuna stampante è salvata, ne scelgo
    // automaticamente una (priorità: QL-800 > QL-* > Brother).
    async function autoPickPrinterIfMissing() {
      const { settings, updateSettings } = useStore.getState();
      if (settings.printerName) return;
      try {
        const found = await invoke<string | null>("find_brother_printer");
        if (mounted && found) updateSettings({ printerName: found });
      } catch (e) {
        console.log("autoPickPrinter skipped:", e);
      }
    }

    (async () => {
      await Promise.allSettled([
        loadAccountData(user.id),
        loadFromCloud(user.id),
      ]);
      if (!mounted) return;
      await autoPickPrinterIfMissing();
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  // Spinner finché non sappiamo lo stato auth, e — se loggato — finché
  // i dati non sono pronti. loadFromCloud setta `loaded:true` in successo,
  // errore o timeout (10s), quindi questa condizione non si appende mai.
  if (checking || (user && !loaded)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-app-bg">
        <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/"           element={<HomePage />} />
          <Route path="/labels"     element={<LabelsPage />} />
          <Route path="/log"        element={<LogPage />} />
          <Route path="/settings"   element={<SettingsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
        </Routes>
      </AppShell>
      <UpdateChecker />
    </BrowserRouter>
  );
}