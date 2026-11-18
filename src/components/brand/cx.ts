// Synced from webdev-coding-templates/brand/react/cx.ts. Make shared changes there, then run npm run generate.
/** Joins class names, skipping falsy values. Dependency-free so brand components work in any React stack. */
export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");
