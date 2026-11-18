// Synced from webdev-coding-templates/brand/react/FieldBox.tsx. Make shared changes there, then run npm run generate.
import type { ReactNode } from "react";

/** Read-only label/value pair with the brand's yellow left rule. */
export function FieldBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-surface-muted border-l-[3px] border-l-brand-yellow px-4 py-3">
      <div className="text-[11px] font-medium tracking-[0.08em] uppercase text-ink-dark">
        {label}
      </div>
      <div className="text-[15px] text-brand-black mt-1">{value}</div>
    </div>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">{children}</div>;
}
