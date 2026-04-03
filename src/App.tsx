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
    // Check if there is already an active session
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (session?.user) {
        setAuth(session.user, session);
        await loadTrialStart(session.user.id);
        await loadFromCloud(session.user.id);
      }
      setChecking(false);
    });

    // Listen for login / logout events
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setAuth(session.user, session);
        await loadTrialStart(session.user.id);
        await loadFromCloud(session.user.id);
      } else {
        clearAuth();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadTrialStart(userId: string) {
    const { data } = await supabase
      .from("accounts")
      .select("trial_started_at")
      .eq("id", userId)
      .single();
    if (data?.trial_started_at) {
      setTrialStart(data.trial_started_at);
    }
  }

  // While checking session → blank screen (avoid flash)
  if (checking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-app-bg">
        <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  // Not logged in → show auth screen
  if (!user) {
    return <AuthPage />;
  }

  // Logged in → show the app
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