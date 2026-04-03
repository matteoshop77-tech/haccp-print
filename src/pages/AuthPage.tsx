import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Mode = "login" | "register";

export default function AuthPage() {
  const [mode, setMode]       = useState<Mode>("login");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [info, setInfo]       = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setInfo("Account created! Check your email to confirm, then log in.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }

    setLoading(false);
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-app-bg">
      <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-surface p-8 shadow-sm">

        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <svg width="44" height="44" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="14" fill="#D6EDE4"/>
            <rect x="10" y="10" width="44" height="44" rx="10" fill="#1D9E75"/>
            <rect x="18" y="19" width="28" height="5" rx="2.5" fill="#F0FAF6"/>
            <rect x="18" y="29" width="19" height="5" rx="2.5" fill="rgba(240,250,246,0.55)"/>
            <rect x="18" y="39" width="23" height="5" rx="2.5" fill="rgba(240,250,246,0.55)"/>
          </svg>
        </div>

        <h1 className="text-center text-lg font-semibold text-ink-primary mb-1">
          HACC<span style={{ color: "#1D9E75" }}>Print</span>
        </h1>
        <p className="text-center text-sm text-ink-muted mb-6">
          {mode === "login" ? "Sign in to your account" : "Create your account — 14 days free"}
        </p>

        {/* Email */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-ink-secondary mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {/* Password */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-ink-secondary mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="••••••••"
            className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {/* Error / Info */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
            {info}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ background: "#1D9E75" }}
        >
          {loading
            ? "Please wait…"
            : mode === "login"
            ? "Sign in"
            : "Create account"}
        </button>

        {/* Toggle mode */}
        <p className="mt-4 text-center text-xs text-ink-muted">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => { setMode("register"); setError(null); setInfo(null); }}
                className="font-medium"
                style={{ color: "#1D9E75" }}
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(null); setInfo(null); }}
                className="font-medium"
                style={{ color: "#1D9E75" }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}