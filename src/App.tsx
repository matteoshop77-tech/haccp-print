import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

export default function App() {
  const { user, setAuth, setTrialStart, clearAuth } = useAuthStore();
  const { loadFromCloud } = useStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Flag per evitare aggiornamenti di stato dopo unmount
    let mounted = true;
    // Flag per evitare che onAuthStateChange faccia lavoro duplicato
    // mentre init() sta già gestendo la sessione
    let initDone = false;

    async function loadTrialStart(userId: string) {
      try {
        const { data } = await supabase
          .from("accounts")
          .select("trial_started_at")
          .eq("id", userId)
          .single();
        if (mounted && data?.trial_started_at) {
          setTrialStart(data.trial_started_at);
        }
      } catch (e) {
        console.error("loadTrialStart error:", e);
      }
    }

    async function init() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("getSession error:", error);
          // Sessione corrotta — puliamo e andiamo al login
          await supabase.auth.signOut();
          if (mounted) clearAuth();
          return;
        }

        const session = data.session;

        if (session?.user) {
          if (mounted) setAuth(session.user, session);
          // Carica i dati in parallelo, ma non crashare se uno fallisce
          await Promise.allSettled([
            loadTrialStart(session.user.id),
            loadFromCloud(session.user.id),
          ]);
        }
      } catch (e) {
        console.error("init error:", e);
        // In caso di errore grave, mostriamo il login
        if (mounted) clearAuth();
      } finally {
        initDone = true;
        if (mounted) setChecking(false);
      }
    }

    // Avvia il check della sessione
    init();

    // Il listener gestisce SOLO gli eventi che avvengono DOPO che init() è finito
    // (es: login manuale, logout, token refresh che scade)
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Ignoriamo gli eventi che arrivano durante init() — li gestisce già lui
      if (!initDone) return;
      if (!mounted) return;

      if (event === "SIGNED_IN" && session?.user) {
        setAuth(session.user, session);
        await Promise.allSettled([
          loadTrialStart(session.user.id),
          loadFromCloud(session.user.id),
        ]);
        setChecking(false);
      } else if (event === "SIGNED_OUT") {
        clearAuth();
        setChecking(false);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        // Aggiorna silenziosamente la sessione in store senza ricaricare i dati
        setAuth(session.user, session);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
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
    </BrowserRouter>
  );
}