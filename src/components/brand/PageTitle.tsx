// Synced from webdev-coding-templates/brand/react/PageTitle.tsx. Make shared changes there, then run npm run generate.
import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

/**
 * Standard page heading: optional section tag, a Roboto Light title and a lead paragraph in
 * Roboto Slab Light, as the guide sets headline + lead.
 */
export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="text-[32px] sm:text-[40px] leading-tight font-light text-brand-black">
        {title}
      </h1>
      {children && (
        <p className="font-slab font-light text-lg leading-relaxed tracking-[0.025em] text-brand-black mt-3 max-w-[68ch]">
          {children}
        </p>
      )}
    </div>
  );
}
