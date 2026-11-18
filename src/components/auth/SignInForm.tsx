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

// There is no self sign-up: accounts are created by an app admin on the Members page.
type Mode = "signin" | "forgot";

const TITLES: Record<Mode, string> = {
  signin: "Sign in",
  forgot: "Reset password",
};

const linkClasses =
  "underline decoration-brand-yellow underline-offset-4 text-ink-dark hover:text-brand-black cursor-pointer";

export function SignInForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    if (mode === "signin" && !password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    const supabase = supabaseBrowser();
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: addr, password });
        if (err) throw new Error("Wrong email or password, or the account does not exist yet.");
        window.location.assign(safeNext(next));
        return;
      }
      const target = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset")}`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(addr, {
        redirectTo: target,
      });
      if (err) throw err;
      setInfo("If that address has an account, a reset link is on its way.");
      setMode("signin");
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
      {mode === "signin" && (
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
            autoComplete="current-password"
            required
          />
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
        {mode === "signin" ? (
          <button type="button" className={linkClasses} onClick={() => setMode("forgot")}>
            Forgot password
          </button>
        ) : (
          <button type="button" className={linkClasses} onClick={() => setMode("signin")}>
            Back to sign in
          </button>
        )}
      </div>
      <p className={helpTextClasses}>
        No account yet? Ask the app admin to add you. Accounts are created on the Users page.
      </p>
    </form>
  );
}
