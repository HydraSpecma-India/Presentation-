"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { supabaseServer } from "@/lib/supabase/server";
import { IMAGE_BUCKET, projectSchema, remapImagePaths, reportTitleSchema } from "./project";

const idSchema = z.uuid();

type Result = { ok: true; id?: string } | { ok: false; error: string };

const fail = (e: unknown): Result => ({
  ok: false,
  error: e instanceof Error ? e.message : String(e),
});

/** New report from the board-report template (built in the browser by the slide engine). */
export async function createReport(title: string, project: unknown): Promise<Result> {
  try {
    await requireRole("editor");
    const name = reportTitleSchema.parse(title);
    const data = projectSchema.parse(project);
    data.settings = { ...data.settings, reportName: name };
    const supabase = await supabaseServer();
    const { data: row, error } = await supabase
      .from("mr_reports")
      .insert({ title: name, data })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/");
    return { ok: true, id: row.id as string };
  } catch (e) {
    return fail(e);
  }
}

/** Copy of a report, images included, e.g. last month's report as the start of this month's. */
export async function duplicateReport(id: string): Promise<Result> {
  try {
    await requireRole("editor");
    const sourceId = idSchema.parse(id);
    const supabase = await supabaseServer();
    const { data: src, error } = await supabase
      .from("mr_reports")
      .select("title, data")
      .eq("id", sourceId)
      .single();
    if (error || !src) throw new Error(error?.message ?? "Report not found.");
    const title = `Copy of ${src.title as string}`.slice(0, 200);
    const { data: row, error: insErr } = await supabase
      .from("mr_reports")
      .insert({ title, data: src.data })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    const newId = row.id as string;

    const bucket = supabase.storage.from(IMAGE_BUCKET);
    const { data: files } = await bucket.list(sourceId, { limit: 1000 });
    for (const f of files ?? []) {
      const { error: cpErr } = await bucket.copy(`${sourceId}/${f.name}`, `${newId}/${f.name}`);
      if (cpErr) throw new Error(`Copying images failed: ${cpErr.message}`);
    }
    const data = remapImagePaths(projectSchema.parse(src.data), sourceId, newId);
    data.settings = { ...data.settings, reportName: title };
    const { error: upErr } = await supabase.from("mr_reports").update({ data }).eq("id", newId);
    if (upErr) throw new Error(upErr.message);
    revalidatePath("/");
    return { ok: true, id: newId };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteReport(id: string): Promise<Result> {
  try {
    await requireRole("admin");
    const reportId = idSchema.parse(id);
    const supabase = await supabaseServer();
    const bucket = supabase.storage.from(IMAGE_BUCKET);
    const { data: files } = await bucket.list(reportId, { limit: 1000 });
    if (files?.length) await bucket.remove(files.map((f) => `${reportId}/${f.name}`));
    const { error } = await supabase.from("mr_reports").delete().eq("id", reportId);
    if (error) throw new Error(error.message);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
