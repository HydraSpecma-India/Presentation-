import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/auth/PasswordForm";
import { AccessMessage, BrandMark } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "New password" };

// Landing page of the "Forgot password" email link.
export default async function ResetPage() {
  if (!(await getCurrentUser())) redirect("/signin?error=link");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-brand-black p-6">
      <BrandMark variant="onblack" />
      <AccessMessage title="Choose a new password">
        <PasswordForm />
      </AccessMessage>
    </div>
  );
}
