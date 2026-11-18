import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AccessMessage, AppFooter } from "@/components/brand";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { requireUser } from "@/lib/auth/guards";

export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/account/password");

  if (!user.role) {
    return (
      <>
        <SiteHeader user={user} />
        <main className="max-w-[1040px] mx-auto px-4 sm:px-6 py-[26px]">
          <AccessMessage title="Access pending">
            You are signed in as {user.email}, but you are not a member of this app yet. Ask the app
            admin to add you on the Users page.
          </AccessMessage>
        </main>
        <AppFooter />
      </>
    );
  }
  return <>{children}</>;
}
