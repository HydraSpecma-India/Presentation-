// Synced from webdev-coding-templates/brand/react/AccessMessage.tsx. Make shared changes there, then run npm run generate.
import type { ReactNode } from "react";
import { Card } from "./Card";
import { Eyebrow } from "./Eyebrow";

/** Centred message card for "access pending", "forbidden", sign-in and error states. */
export function AccessMessage({
  eyebrow = "HydraSpecma",
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card className="border-t-4 border-t-brand-yellow p-8 max-w-md w-full mx-auto">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="text-2xl font-light text-brand-black">{title}</h1>
      {children && <div className="text-sm text-ink mt-3">{children}</div>}
    </Card>
  );
}
