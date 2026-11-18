// Synced from webdev-coding-templates/brand/react/BrandMark.tsx. Make shared changes there, then run npm run generate.
import { cx } from "./cx";

export type BrandMarkProps = {
  /** App name shown next to the logo, e.g. "Change Management". */
  subtitle?: string;
  /** `onblack` = the logo with yellow "Specma" for black backgrounds. */
  variant?: "positive" | "onblack";
  className?: string;
};

const LOGO_SRC = {
  positive: "/brand/hydraspecma-logo.png",
  onblack: "/brand/hydraspecma-logo-onblack.png",
} as const;

/**
 * HydraSpecma logo plus app name. Logo files are served from /brand/ (public/brand in each
 * template). Keep clear space of half the logo height around it: never crowd or recolour it.
 */
export function BrandMark({ subtitle, variant = "positive", className }: BrandMarkProps) {
  const onBlack = variant === "onblack";
  return (
    <div className={cx("flex items-center gap-4", className)}>
      <img
        src={LOGO_SRC[variant]}
        alt="HydraSpecma"
        className={onBlack ? "h-10 w-auto" : "h-7 w-auto"}
      />
      {subtitle && (
        <div
          className={cx(
            "text-xs font-medium uppercase tracking-[0.1em] border-l pl-4",
            onBlack ? "text-white border-ink-dark" : "text-brand-black border-line",
          )}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
