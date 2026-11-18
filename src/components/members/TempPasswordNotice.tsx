"use client";

import { useState } from "react";

/** Success message, optionally with a temporary password to hand over. Shown once only. */
export function TempPasswordNotice({ message, password }: { message: string; password?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      role="status"
      className="border-l-4 border-l-status-green bg-surface-muted px-4 py-3 text-sm text-ink"
    >
      <p>{message}</p>
      {password && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code className="font-mono text-base text-brand-black bg-surface border border-line px-3 py-1">
            {password}
          </code>
          <button
            type="button"
            className="text-xs uppercase tracking-[0.08em] text-ink-dark hover:text-brand-black underline decoration-brand-yellow underline-offset-4 cursor-pointer"
            onClick={() => {
              navigator.clipboard.writeText(password).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <span className="text-xs text-ink-dark">
            It is not stored anywhere readable and will not be shown again.
          </span>
        </div>
      )}
    </div>
  );
}
