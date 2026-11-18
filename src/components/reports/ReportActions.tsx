"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteReport, duplicateReport } from "@/lib/reports/actions";

const linkBtn =
  "text-xs uppercase tracking-[0.08em] text-ink-dark hover:text-brand-black underline decoration-brand-yellow underline-offset-4 cursor-pointer disabled:opacity-40";

export function ReportActions({
  id,
  title,
  canEdit,
  canDelete,
}: {
  id: string;
  title: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function run(
    fn: () => Promise<{ ok: boolean; id?: string; error?: string }>,
    openNew: boolean,
  ) {
    setBusy(true);
    setError("");
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Failed.");
    else if (openNew && res.id) router.push(`/reports/${res.id}`);
    else router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-4">
      {canEdit && (
        <button
          type="button"
          className={linkBtn}
          disabled={busy}
          onClick={() => run(() => duplicateReport(id), true)}
        >
          Duplicate
        </button>
      )}
      {canDelete &&
        (confirming ? (
          <span className="flex items-center gap-3 text-xs">
            <span className="text-ink-dark">Delete “{title}”?</span>
            <button
              type="button"
              className={`${linkBtn} text-status-redorange`}
              disabled={busy}
              onClick={() => run(() => deleteReport(id), false)}
            >
              Yes, delete
            </button>
            <button type="button" className={linkBtn} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className={linkBtn} onClick={() => setConfirming(true)}>
            Delete
          </button>
        ))}
      {error && (
        <span role="alert" className="text-xs text-status-redorange">
          {error}
        </span>
      )}
    </div>
  );
}
