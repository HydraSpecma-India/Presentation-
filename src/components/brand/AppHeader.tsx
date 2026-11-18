// Synced from webdev-coding-templates/brand/react/AppHeader.tsx. Make shared changes there, then run npm run generate.
import type { ReactNode } from "react";

/**
 * White page header with a hairline bottom border, as in the design system's website kit.
 * Takes slots rather than links so it works with any router: pass `brand` (usually
 * <BrandMark> wrapped in your <Link>), `nav` and `actions`.
 */
export function AppHeader({
  brand,
  nav,
  actions,
}: {
  brand: ReactNode;
  nav?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 bg-surface border-b border-line">
      <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {brand}
          {nav && <nav className="flex items-center gap-6">{nav}</nav>}
        </div>
        {actions && <div className="flex items-center gap-4">{actions}</div>}
      </div>
    </header>
  );
}

const NAV_LINK_BASE = "text-[13px] font-normal uppercase tracking-[0.1em] pb-1 border-b-2";

/** Classes for a header nav link; pass `active` for the current page (yellow underline). */
export const navLinkClasses = (active = false) =>
  active
    ? `${NAV_LINK_BASE} text-brand-black border-brand-yellow`
    : `${NAV_LINK_BASE} text-ink border-transparent hover:text-brand-black`;
