import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user:             User | null;
  session:          Session | null;
  trialStart:       string | null;
  organizationName: string | null;
  setAuth:          (user: User | null, session: Session | null) => void;
  setTrialStart:    (date: string | null) => void;
  setOrganizationName: (name: string | null) => void;
  clearAuth:        () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user:             null,
  session:          null,
  trialStart:       null,
  organizationName: null,

  setAuth: (user, session) => set({ user, session }),
  setTrialStart: (date) => set({ trialStart: date }),
  setOrganizationName: (name) => set({ organizationName: name }),
  clearAuth: () => set({ user: null, session: null, trialStart: null, organizationName: null }),
}));