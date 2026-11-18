// Synced from webdev-coding-templates/brand/react/UserBadge.tsx. Make shared changes there, then run npm run generate.
import type { ReactNode } from "react";

const initials = (name: string) =>
  name
    .split(/[\s.@]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Signed-in user's initials and name. Put your stack's sign-out control in `children`. */
export function UserBadge({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px] text-ink-dark">
      <span className="hidden sm:inline">{name}</span>
      <div
        className="w-[30px] h-[30px] rounded-full bg-brand-black text-brand-yellow flex items-center justify-center text-xs font-medium"
        aria-hidden
      >
        {initials(name)}
      </div>
      {children}
    </div>
  );
}
