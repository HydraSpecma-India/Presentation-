"use client";

import { useState, type FormEvent } from "react";
import { Button, errorTextClasses, inputClasses, labelClasses } from "@/components/brand";
import { supabaseBrowser } from "@/lib/supabase/client";

export function ResetForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("The password needs at least 8 characters.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (err) setError(err.message);
    else window.location.assign("/");
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
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
      </div>
      {error && (
        <p role="alert" className={errorTextClasses}>
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy}>
        Save password
      </Button>
    </form>
  );
}
