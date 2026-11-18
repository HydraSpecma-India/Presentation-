import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/SignInForm";
import { AccessMessage, BrandMark } from "@/components/brand";
import { APP_NAME } from "@/lib/app";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNext } from "@/lib/auth/safe-next";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-brand-black p-6">
      <BrandMark variant="onblack" />
      <AccessMessage title={APP_NAME}>
        <p>
          Sign in with your HydraSpecma work email to build and export the board meeting report.
        </p>
        <SignInForm
          next={next}
          initialError={
            error === "link"
              ? "That link has expired or was already used. Sign in, or request a new link."
              : undefined
          }
        />
      </AccessMessage>
    </div>
  );
}
