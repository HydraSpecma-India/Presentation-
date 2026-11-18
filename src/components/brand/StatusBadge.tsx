// Synced from webdev-coding-templates/brand/react/StatusBadge.tsx. Make shared changes there, then run npm run generate.
import type { ReactNode } from "react";
import { cx } from "./cx";

export type StatusTone = "green" | "orange" | "redorange" | "blue" | "neutral";

// Tone colours go on the border and dot only. The label stays ink-coloured, because some status
// colours (orange: 2.4:1 on white) are too light for text. Pill shape: the guide reserves
// full rounding for chips and tags.
const TONE_CLASSES: Record<StatusTone, { border: string; dot: string }> = {
  green: { border: "border-status-green", dot: "bg-status-green" },
  orange: { border: "border-status-orange", dot: "bg-status-orange" },
  redorange: { border: "border-status-redorange", dot: "bg-status-redorange" },
  blue: { border: "border-status-blue", dot: "bg-status-blue" },
  neutral: { border: "border-line", dot: "bg-ink-muted" },
};

/** Outlined status pill. Always pair colour with text. */
export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  const { border, dot } = TONE_CLASSES[tone];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 border bg-surface px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink rounded-full",
        border,
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
      {children}
    </span>
  );
}
