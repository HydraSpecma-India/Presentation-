import Link from "next/link";
import { AppFooter, Card, PageTitle, buttonClasses } from "@/components/brand";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { NewReport } from "@/components/reports/NewReport";
import { ReportActions } from "@/components/reports/ReportActions";
import { requireUser } from "@/lib/auth/guards";
import { hasRole } from "@/lib/auth/roles";
import { supabaseServer } from "@/lib/supabase/server";

type Row = {
  id: string;
  title: string;
  updated_at: string;
  updated_by_email: string | null;
  created_by_email: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

export default async function ReportsPage() {
  const user = await requireUser();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("mr_reports")
    .select("id, title, updated_at, updated_by_email, created_by_email")
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as Row[];
  const canEdit = hasRole(user.role, "editor");

  return (
    <>
      <SiteHeader user={user} />
      <main className="max-w-[1040px] mx-auto px-4 sm:px-6 py-[26px]">
        <PageTitle eyebrow="HSIN board meeting" title="Management reports">
          Each report follows the HySp board report layout. Fill it in page by page, add comments,
          tables, charts and images, then export it to PowerPoint.
        </PageTitle>

        {canEdit && (
          <Card className="p-5 mb-8">
            <NewReport />
          </Card>
        )}

        {error && (
          <p role="alert" className="text-sm text-status-redorange mb-4">
            Could not load reports: {error.message}
          </p>
        )}

        <h2 className="text-[28px] font-light mb-3">All reports</h2>
        {rows.length === 0 ? (
          <Card className="p-6 text-sm text-ink-dark">
            No reports yet.{canEdit ? " Create the first one above." : ""}
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
                  <div className="flex-1 min-w-[240px]">
                    <Link
                      href={`/reports/${r.id}`}
                      className="text-[17px] text-brand-black hover:underline decoration-brand-yellow underline-offset-4"
                    >
                      {r.title}
                    </Link>
                    <div className="text-xs text-ink-dark mt-1">
                      Updated {fmt(r.updated_at)}
                      {r.updated_by_email ? ` by ${r.updated_by_email}` : ""}
                    </div>
                  </div>
                  <Link
                    href={`/reports/${r.id}`}
                    className={buttonClasses(canEdit ? "outline" : "ghost")}
                  >
                    {canEdit ? "Open" : "View"}
                  </Link>
                  <ReportActions
                    id={r.id}
                    title={r.title}
                    canEdit={canEdit}
                    canDelete={hasRole(user.role, "admin")}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </main>
      <AppFooter />
    </>
  );
}
