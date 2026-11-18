"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  errorTextClasses,
  helpTextClasses,
  inputClasses,
  labelClasses,
} from "@/components/brand";
import { generateTempPassword } from "@/lib/auth/password";
import { createUser, type MemberResult } from "@/lib/members/actions";
import { TempPasswordNotice } from "./TempPasswordNotice";

export function AddUserForm() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("editor");
  const [password, setPassword] = useState(generateTempPassword);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MemberResult | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createUser({ email, fullName, role, password });
    setBusy(false);
    setResult(res);
    if (res.ok) {
      setEmail("");
      setFullName("");
      setPassword(generateTempPassword());
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <h2 className="sm:col-span-2 text-[20px] font-medium text-brand-black">Add user</h2>
      <div>
        <label htmlFor="u-email" className={labelClasses}>
          Work email
        </label>
        <input
          id="u-email"
          type="email"
          required
          className={inputClasses}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="firstname.lastname@hydraspecma.com"
          autoComplete="off"
        />
      </div>
      <div>
        <label htmlFor="u-name" className={labelClasses}>
          Full name
        </label>
        <input
          id="u-name"
          className={inputClasses}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div>
        <label htmlFor="u-role" className={labelClasses}>
          Role
        </label>
        <select
          id="u-role"
          className={inputClasses}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="viewer">Viewer – open and export reports</option>
          <option value="editor">Editor – also create and change reports</option>
          <option value="admin">Admin – also delete reports and manage users</option>
        </select>
      </div>
      <div>
        <label htmlFor="u-pw" className={labelClasses}>
          Temporary password
        </label>
        <div className="flex gap-2 items-end">
          <input
            id="u-pw"
            className={`${inputClasses} font-mono`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPassword(generateTempPassword())}
            className="mt-1.5 whitespace-nowrap"
          >
            New
          </Button>
        </div>
        <p className={helpTextClasses}>
          The user must replace it with their own password at first sign-in.
        </p>
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Creating…" : "Create user"}
        </Button>
        {result && !result.ok && (
          <p role="alert" className={errorTextClasses}>
            {result.error}
          </p>
        )}
      </div>
      {result?.ok && (
        <div className="sm:col-span-2">
          <TempPasswordNotice message={result.message} password={result.password} />
        </div>
      )}
    </form>
  );
}
