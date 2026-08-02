"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Lock, Mail, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function SignInPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function routeAfterAuth(userId: string) {
    // Existing users with a completed profile go straight to the dashboard;
    // brand-new accounts finish onboarding first.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    router.push(profile ? "/dashboard" : "/onboarding");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      // 1. Try to sign in.
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError && signInData.user) {
        await routeAfterAuth(signInData.user.id);
        return;
      }

      // 2. On any sign-in failure, fall back to creating the account (demo mode).
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (signUpData.user && signUpData.session) {
        await routeAfterAuth(signUpData.user.id);
        return;
      }

      if (signUpData.user && !signUpData.session) {
        setInfo("Account created. Please confirm your email address, then sign in.");
        return;
      }

      setError("Unable to sign in. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-center" style={{ fontSize: "1.5rem" }}>
        HoD Productivity Platform
      </h1>
      <p className="text-sm text-muted text-center mt-2 mb-6">
        Sign in to your leadership workspace
      </p>

      {error && (
        <div
          className="flex items-start gap-2 rounded-md border px-3 py-2.5 mb-4 text-sm"
          style={{
            background: "var(--color-error-bg)",
            borderColor: "var(--color-error)",
            color: "var(--color-error)",
          }}
          role="alert"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {info && (
        <div
          className="flex items-start gap-2 rounded-md border px-3 py-2.5 mb-4 text-sm"
          style={{
            background: "var(--color-info-bg)",
            borderColor: "var(--color-info)",
            color: "var(--color-info)",
          }}
          role="status"
        >
          <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{info}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="form-label">
            Email address
          </label>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className={cn("form-input", "pl-9")}
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={cn("form-input", "pl-9")}
              disabled={loading}
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <p className="text-xs text-muted text-center mt-5 leading-relaxed">
        Demo: use any email/password to create an account. New accounts are guided through a short
        onboarding.
      </p>
    </div>
  );
}
