import type { Metadata } from "next";
import { AccessMessage, AppFooter, Card, PageTitle, StatusBadge } from "@/components/brand";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MemberForm } from "@/components/members/MemberForm";
import { requireUser } from "@/lib/auth/guards";
import { hasRole } from "@/lib/auth/roles";
import { removeMember } from "@/lib/members/actions";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Members" };

type Member = { email: string; role: string; added_by: string | null; created_at: string };

export default async function MembersPage() {
  const user = await requireUser();
  const isAdmin = hasRole(user.role, "admin");
  let members: Member[] = [];
  if (isAdmin) {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("mr_members")
      .select("email, role, added_by, created_at")
      .order("email");
    members = (data ?? []) as Member[];
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="max-w-[1040px] mx-auto px-4 sm:px-6 py-[26px]">
        {!isAdmin ? (
          <AccessMessage eyebrow="403" title="Admins only">
            Only app admins can manage members.
          </AccessMessage>
        ) : (
          <>
            <PageTitle eyebrow="Access" title="Members">
              People need a member entry before they can open reports. Viewers can read and export,
              editors can also create and change reports, admins can delete reports and manage this
              list.
            </PageTitle>
            <Card className="p-5 mb-8">
              <MemberForm />
            </Card>
            <Card>
              <ul className="divide-y divide-line">
                {members.map((m) => (
                  <li key={m.email} className="flex flex-wrap items-center gap-4 px-5 py-3">
                    <span className="flex-1 min-w-[240px] font-mono text-sm text-brand-black">
                      {m.email}
                    </span>
                    <StatusBadge
                      tone={m.role === "admin" ? "blue" : m.role === "editor" ? "green" : "neutral"}
                    >
                      {m.role}
                    </StatusBadge>
                    {m.email !== user.email.toLowerCase() && (
                      <form action={removeMember}>
                        <input type="hidden" name="email" value={m.email} />
                        <button
                          type="submit"
                          className="text-xs uppercase tracking-[0.08em] text-ink-dark hover:text-status-redorange underline decoration-brand-yellow underline-offset-4 cursor-pointer"
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
            <p className="text-xs text-ink-dark mt-4">
              New people create their own password on the sign-in page with their work email. Their
              access starts as soon as their address is on this list.
            </p>
          </>
        )}
      </main>
      <AppFooter />
    </>
  );
}
