"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, errorTextClasses, inputClasses, labelClasses } from "@/components/brand";
import { createReport } from "@/lib/reports/actions";

declare global {
  interface Window {
    HSCore?: { newProject: () => unknown };
  }
}

function loadCore() {
  return new Promise<void>((resolve, reject) => {
    if (window.HSCore) return resolve();
    const s = document.createElement("script");
    s.src = "/editor/core.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the report template."));
    document.head.appendChild(s);
  });
}

function defaultTitle() {
  const m = new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  return `Board meeting management report – ${m}`;
}

/** Starts a new report from the 52-page India template. */
export function NewReport() {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await loadCore();
      const res = await createReport(title, window.HSCore!.newProject());
      if (!res.ok) throw new Error(res.error);
      router.push(`/reports/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[260px]">
        <label htmlFor="newTitle" className={labelClasses}>
          New report name
        </label>
        <input
          id="newTitle"
          className={inputClasses}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
      </div>
      <Button type="submit" variant="primary" disabled={busy || !title.trim()}>
        {busy ? "Creating…" : "Create report"}
      </Button>
      {error && (
        <p role="alert" className={`${errorTextClasses} w-full`}>
          {error}
        </p>
      )}
    </form>
  );
}
