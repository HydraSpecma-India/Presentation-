import type { Metadata } from "next";
import { AccessMessage, AppFooter, Card, PageTitle } from "@/components/brand";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AddUserForm } from "@/components/members/AddUserForm";
import { MemberRow } from "@/components/members/MemberRow";
import { requireUser } from "@/lib/auth/guards";
import { hasRole } from "@/lib/auth/roles";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Members" };

type Member = { email: string; role: string; must_change_password: boolean };

export default async function MembersPage() {
  const user = await requireUser();
  const isAdmin = hasRole(user.role, "admin");
  let members: Member[] = [];
  if (isAdmin) {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("mr_members")
      .select("email, role, must_change_password")
      .order("email");
    members = (data ?? []) as Member[];
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="max-w-[1040px] mx-auto px-4 sm:px-6 py-[26px]">
        {!isAdmin ? (
          <AccessMessage eyebrow="403" title="Admins only">
            Only app admins can manage users.
          </AccessMessage>
        ) : (
          <>
            <PageTitle eyebrow="Access" title="Users">
              There is no self sign-up. Create an account here and hand over the temporary password;
              the user chooses their own password at first sign-in.
            </PageTitle>
            <Card className="p-5 mb-8">
              <AddUserForm />
            </Card>
            <h2 className="text-[28px] font-light mb-3">Members ({members.length})</h2>
            <Card>
              <ul className="divide-y divide-line">
                {members.map((m) => (
                  <MemberRow
                    key={m.email}
                    email={m.email}
                    role={m.role}
                    mustChange={m.must_change_password}
                    isSelf={m.email === user.email.toLowerCase()}
                  />
                ))}
              </ul>
            </Card>
            <p className="text-xs text-ink-dark mt-4">
              Removing someone only takes away access to this app. Their login stays, because other
              HydraSpecma apps in the same system may use it.
            </p>
          </>
        )}
      </main>
      <AppFooter />
    </>
  );
}
