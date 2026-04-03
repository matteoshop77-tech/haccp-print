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
    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        console.log("getSession:", session?.user?.id ?? "no session");
        if (session?.user) {
          setAuth(session.user, session);
          await loadTrialStart(session.user.id);
          await loadFromCloud(session.user.id);
        }
      } catch (e) {
        console.error("init error:", e);
      } finally {
        setChecking(false);
      }
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("onAuthStateChange:", event, session?.user?.id);
      if (event === "SIGNED_IN" && session?.user) {
        setAuth(session.user, session);
        await loadTrialStart(session.user.id);
        await loadFromCloud(session.user.id);
        setChecking(false);
      } else if (event === "SIGNED_OUT") {
        clearAuth();
        setChecking(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadTrialStart(userId: string) {
    try {
      const { data } = await supabase
        .from("accounts")
        .select("trial_started_at")
        .eq("id", userId)
        .single();
      if (data?.trial_started_at) {
        setTrialStart(data.trial_started_at);
      }
    } catch (e) {
      console.error("loadTrialStart error:", e);
    }
  }

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