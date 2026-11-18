"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  errorTextClasses,
  helpTextClasses,
  inputClasses,
  labelClasses,
} from "@/components/brand";
import { passwordProblem } from "@/lib/auth/password";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Sets the signed-in user's own password and clears the "must change password" flag. */
export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== repeat) return setError("The two passwords are not the same.");
    setBusy(true);
    setError("");
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setBusy(false);
      return setError(err.message);
    }
    await supabase.rpc("mr_password_changed");
    window.location.assign("/");
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
      <div>
        <label htmlFor="pw" className={labelClasses}>
          New password
        </label>
        <input
          id="pw"
          type="password"
          className={inputClasses}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <p className={helpTextClasses}>At least 8 characters, with letters and a number.</p>
      </div>
      <div>
        <label htmlFor="pw2" className={labelClasses}>
          Repeat new password
        </label>
        <input
          id="pw2"
          type="password"
          className={inputClasses}
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      {error && (
        <p role="alert" className={errorTextClasses}>
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
