// Synced from webdev-coding-templates/brand/react/Skew.tsx. Make shared changes there, then run npm run generate.
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cx } from "./cx";

type SkewProps<T extends ElementType> = {
  as?: T;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

/**
 * The HydraSpecma skewX(-10deg) motif used by the logo mark, eyebrow tags, primary buttons and
 * badges. The inner span counter-skews so the text stays upright; that two-element structure is
 * why this is a component rather than a utility class.
 */
export function Skew<T extends ElementType = "div">({
  as,
  className,
  children,
  ...rest
}: SkewProps<T>) {
  const As = (as ?? "div") as ElementType;
  return (
    // transform-gpu gives the skewed box its own layer, fixing jagged edges in Chromium.
    <As className={cx("inline-block -skew-x-[10deg] transform-gpu", className)} {...rest}>
      <span className="inline-block skew-x-[10deg]">{children}</span>
    </As>
  );
}
