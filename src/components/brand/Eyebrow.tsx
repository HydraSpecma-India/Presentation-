// Synced from webdev-coding-templates/brand/react/Eyebrow.tsx. Make shared changes there, then run npm run generate.
import { Skew } from "./Skew";

/**
 * The guide's signature "section tag": a yellow box skewed 10°, Roboto Medium, UPPERCASE.
 * Use for section numbers (02.1), categories and labels above titles. Not for buttons.
 */
export function Eyebrow({ children }: { children: string }) {
  return (
    <Skew
      as="span"
      className="bg-brand-yellow text-brand-black text-xs font-medium leading-none tracking-[0.12em] uppercase px-3 py-1.5 mb-4"
    >
      {children}
    </Skew>
  );
}
