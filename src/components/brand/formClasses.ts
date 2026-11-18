// Synced from webdev-coding-templates/brand/react/formClasses.ts. Make shared changes there, then run npm run generate.
// Brand styling for native form controls, as class strings so they work on <input>, <select>,
// <textarea> and on shadcn/Radix components alike. Per the design system: UPPERCASE medium
// labels, Roboto Light values, 2px radius, yellow border + soft yellow ring on focus.
export const labelClasses = "block text-[11px] font-medium uppercase tracking-[0.08em] text-ink";

export const inputClasses =
  "mt-1.5 w-full border border-line bg-surface px-3 py-2.5 text-sm font-light normal-case " +
  "tracking-normal text-brand-black rounded-sm placeholder:text-ink-muted transition-colors " +
  "duration-150 ease-standard focus:outline-none focus:border-brand-yellow " +
  "focus:ring-[3px] focus:ring-brand-yellow/25 disabled:bg-surface-muted disabled:text-ink-dark " +
  "aria-invalid:border-status-redorange";

export const checkboxClasses = "h-4 w-4 accent-brand-yellow";

/** Help text under a field. Uses ink-dark, not ink-muted, so small text keeps AA contrast. */
export const helpTextClasses = "text-[11px] text-ink-dark mt-1";

export const errorTextClasses = "text-xs text-status-redorange mt-1";
