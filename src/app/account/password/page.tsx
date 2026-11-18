import type { Metadata } from "next";
import { PasswordForm } from "@/components/auth/PasswordForm";
import { AccessMessage, BrandMark } from "@/components/brand";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-brand-black p-6">
      <BrandMark variant="onblack" />
      <AccessMessage
        eyebrow={user.mustChangePassword ? "First sign-in" : "Account"}
        title="Change password"
      >
        <p>
          {user.mustChangePassword
            ? "You signed in with a temporary password. Choose your own password to continue."
            : `Choose a new password for ${user.email}.`}
        </p>
        <PasswordForm />
      </AccessMessage>
    </div>
  );
}
