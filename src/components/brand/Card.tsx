// Synced from webdev-coding-templates/brand/react/Card.tsx. Make shared changes there, then run npm run generate.
import type { ReactNode } from "react";
import { cx } from "./cx";

type CardProps = { children: ReactNode; className?: string };

export function Card({ children, className }: CardProps) {
  return <div className={cx("bg-surface border border-line", className)}>{children}</div>;
}

/** Card with a 4px yellow bar on the left, for KPI tiles and highlighted panels. */
export function AccentCard({ children, className }: CardProps) {
  return <Card className={cx("border-l-4 border-l-brand-yellow", className)}>{children}</Card>;
}
