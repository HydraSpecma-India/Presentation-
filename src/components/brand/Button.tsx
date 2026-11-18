// Synced from webdev-coding-templates/brand/react/Button.tsx. Make shared changes there, then run npm run generate.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "text";

// Per the design guide: square, UPPERCASE, Roboto Medium, +0.08em tracking. Hover darkens
// (never lightens); press nudges down 1px (never shrinks). No skew: that is for section tags.
// Border colour lives only in the variants: a base border-transparent would override them.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-brand-yellow text-brand-black hover:bg-brand-yellow-hover active:bg-brand-yellow-press",
  secondary: "border-transparent bg-brand-black text-white hover:bg-ink-dark",
  outline: "border-brand-black text-brand-black hover:bg-brand-black hover:text-white",
  ghost: "border-line text-ink hover:border-brand-black hover:text-brand-black",
  text: "border-transparent px-0! text-ink-dark hover:text-brand-black underline decoration-brand-yellow underline-offset-4",
};

const BASE =
  "inline-flex items-center justify-center gap-2 border px-[22px] py-3 " +
  "text-[13px] font-medium uppercase tracking-[0.08em] cursor-pointer transition-colors " +
  "duration-150 ease-standard active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed " +
  "disabled:active:translate-y-0";

/**
 * Button styling as a class string, for links that should look like buttons. Pass it to your
 * framework's own <Link> (next/link, @tanstack/react-router, react-router) so routing still works.
 */
export const buttonClasses = (variant: ButtonVariant = "ghost", className?: string) =>
  cx(BASE, VARIANT_CLASSES[variant], className);

type ButtonProps = {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function Button({
  variant = "ghost",
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, className)} {...rest}>
      {children}
    </button>
  );
}
