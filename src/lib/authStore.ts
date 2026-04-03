import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user:        User | null;
  session:     Session | null;
  trialStart:  string | null;   // ISO date da accounts.trial_started_at
  setAuth:     (user: User | null, session: Session | null) => void;
  setTrialStart: (date: string | null) => void;
  clearAuth:   () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user:        null,
  session:     null,
  trialStart:  null,

  setAuth: (user, session) => set({ user, session }),
  setTrialStart: (date) => set({ trialStart: date }),
  clearAuth: () => set({ user: null, session: null, trialStart: null }),
}));