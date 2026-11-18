import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ReportEditor } from "@/components/editor/ReportEditor";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { requireUser } from "@/lib/auth/guards";
import { hasRole } from "@/lib/auth/roles";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Report editor" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await supabaseServer();
  const { data } = await supabase.from("mr_reports").select("id").eq("id", id).maybeSingle();
  if (!data) notFound();

  return (
    <>
      <SiteHeader user={user} wide />
      <ReportEditor reportId={id} canEdit={hasRole(user.role, "editor")} />
    </>
  );
}
