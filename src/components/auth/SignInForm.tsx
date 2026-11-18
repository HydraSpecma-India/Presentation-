"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  errorTextClasses,
  helpTextClasses,
  inputClasses,
  labelClasses,
} from "@/components/brand";
import { isAllowedEmail } from "@/lib/auth/roles";
import { safeNext } from "@/lib/auth/safe-next";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "forgot";

const TITLES: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create account",
  forgot: "Reset password",
};

export function SignInForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [info, setInfo] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    const addr = email.trim().toLowerCase();
    if (!isAllowedEmail(addr)) {
      setError("Use your @hydraspecma.com work address.");
      return;
    }
    if (mode !== "forgot" && password.length < 8) {
      setError("The password needs at least 8 characters.");
      return;
    }
    setBusy(true);
    const supabase = supabaseBrowser();
    const callback = (target: string) =>
      `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: addr, password });
        if (err) throw err;
        window.location.assign(safeNext(next));
        return;
      }
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email: addr,
          password,
          options: {
            emailRedirectTo: callback("/"),
            data: { full_name: name.trim() || addr.split("@")[0], app_name: "management-report" },
          },
        });
        if (err) throw err;
        if (data.session) {
          window.location.assign("/");
          return;
        }
        setInfo("Check your inbox and open the confirmation link, then sign in here.");
        setMode("signin");
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(addr, {
          redirectTo: callback("/auth/reset"),
        });
        if (err) throw err;
        setInfo("If that address has an account, a reset link is on its way.");
        setMode("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
      <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-dark">
        {TITLES[mode]}
      </h2>
      {mode === "signup" && (
        <div>
          <label htmlFor="name" className={labelClasses}>
            Full name
          </label>
          <input
            id="name"
            className={inputClasses}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
      )}
      <div>
        <label htmlFor="email" className={labelClasses}>
          Work email
        </label>
        <input
          id="email"
          type="email"
          className={inputClasses}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="firstname.lastname@hydraspecma.com"
          required
        />
      </div>
      {mode !== "forgot" && (
        <div>
          <label htmlFor="password" className={labelClasses}>
            Password
          </label>
          <input
            id="password"
            type="password"
            className={inputClasses}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />
          {mode === "signup" && <p className={helpTextClasses}>At least 8 characters.</p>}
        </div>
      )}
      {error && (
        <p role="alert" className={errorTextClasses}>
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="text-xs text-status-green">
          {info}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy} className="w-full">
        {busy ? "Please wait…" : TITLES[mode]}
      </Button>
      <div className="flex flex-wrap justify-between gap-3 text-xs">
        {mode !== "signin" ? (
          <button
            type="button"
            className="underline decoration-brand-yellow underline-offset-4 text-ink-dark hover:text-brand-black"
            onClick={() => setMode("signin")}
          >
            Back to sign in
          </button>
        ) : (
          <>
            <button
              type="button"
              className="underline decoration-brand-yellow underline-offset-4 text-ink-dark hover:text-brand-black"
              onClick={() => setMode("signup")}
            >
              Create an account
            </button>
            <button
              type="button"
              className="underline decoration-brand-yellow underline-offset-4 text-ink-dark hover:text-brand-black"
              onClick={() => setMode("forgot")}
            >
              Forgot password
            </button>
          </>
        )}
      </div>
    </form>
  );
}
