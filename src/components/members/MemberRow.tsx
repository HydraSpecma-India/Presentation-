"use client";

import { useState } from "react";
import { StatusBadge, inputClasses } from "@/components/brand";
import { generateTempPassword } from "@/lib/auth/password";
import {
  removeMember,
  resetMemberPassword,
  setMemberRole,
  type MemberResult,
} from "@/lib/members/actions";
import { TempPasswordNotice } from "./TempPasswordNotice";

const linkBtn =
  "text-xs uppercase tracking-[0.08em] text-ink-dark hover:text-brand-black underline decoration-brand-yellow underline-offset-4 cursor-pointer disabled:opacity-40";

export function MemberRow({
  email,
  role,
  mustChange,
  isSelf,
}: {
  email: string;
  role: string;
  mustChange: boolean;
  isSelf: boolean;
}) {
  const [current, setCurrent] = useState(role);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [result, setResult] = useState<MemberResult | null>(null);

  async function run(fn: () => Promise<MemberResult>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    setResult(res);
    return res;
  }

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex-1 min-w-[240px] font-mono text-sm text-brand-black">{email}</span>
        {mustChange && <StatusBadge tone="orange">Temporary password</StatusBadge>}
        <select
          aria-label={`Role of ${email}`}
          className={`${inputClasses} mt-0! w-32`}
          value={current}
          disabled={busy || isSelf}
          onChange={async (e) => {
            const next = e.target.value;
            const res = await run(() => setMemberRole(email, next));
            if (res.ok) setCurrent(next);
          }}
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="button"
          className={linkBtn}
          disabled={busy}
          onClick={() => run(() => resetMemberPassword(email, generateTempPassword()))}
        >
          Reset password
        </button>
        {!isSelf &&
          (confirmRemove ? (
            <span className="flex items-center gap-3 text-xs">
              <button
                type="button"
                className={`${linkBtn} text-status-redorange`}
                disabled={busy}
                onClick={() => run(() => removeMember(email))}
              >
                Yes, remove access
              </button>
              <button type="button" className={linkBtn} onClick={() => setConfirmRemove(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className={linkBtn} onClick={() => setConfirmRemove(true)}>
              Remove
            </button>
          ))}
      </div>
      {result && !result.ok && (
        <p role="alert" className="text-xs text-status-redorange mt-2">
          {result.error}
        </p>
      )}
      {result?.ok && result.password && (
        <div className="mt-2">
          <TempPasswordNotice message={result.message} password={result.password} />
        </div>
      )}
    </li>
  );
}
