"use client";

import {
  IMAGE_BUCKET,
  imageBlocks,
  imagePath,
  projectSchema,
  referencedImagePaths,
  toStoredProject,
  type Project,
} from "@/lib/reports/project";
import { supabaseBrowser } from "@/lib/supabase/client";

export type SaveResult =
  | { ok: true; savedAt: string }
  | { ok: false; conflict: true; by: string | null; at: string }
  | { ok: false; conflict?: false; error: string };

export type ReportStore = {
  load: () => Promise<Project>;
  save: (project: Project, opts?: { force?: boolean }) => Promise<SaveResult>;
};

function dataUrlToBlob(dataUrl: string): Blob {
  const [head = "", body = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/png";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

/** Loads and saves one report row; image bytes go to the private storage bucket. */
export function createReportStore(reportId: string): ReportStore {
  const supabase = supabaseBrowser();
  let version: string | null = null; // updated_at of the copy we last loaded or saved

  return {
    async load() {
      const { data, error } = await supabase
        .from("mr_reports")
        .select("title, data, updated_at")
        .eq("id", reportId)
        .single();
      if (error || !data) throw new Error(error?.message ?? "Report not found.");
      version = data.updated_at as string;
      const project = projectSchema.parse(data.data);
      project.settings = { ...project.settings, reportName: data.title };
      await Promise.all(
        imageBlocks(project).map(async (b) => {
          if (!b.img) return;
          const { data: file } = await supabase.storage.from(IMAGE_BUCKET).download(b.img);
          if (file) b.src = await blobToDataUrl(file);
        }),
      );
      return project;
    },

    async save(project, opts = {}) {
      // 1. Upload images that are new since the last save (they have bytes but no storage path).
      for (const b of imageBlocks(project)) {
        if (b.img || typeof b.src !== "string" || !b.src.startsWith("data:")) continue;
        const blob = dataUrlToBlob(b.src);
        const path = imagePath(reportId, b.id, blob.type);
        const { error } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(path, blob, { contentType: blob.type, upsert: true });
        if (error) return { ok: false, error: `Image upload failed: ${error.message}` };
        b.img = path;
      }

      // 2. Save the slides, unless someone else saved in the meantime.
      const stored = toStoredProject(project);
      const name = String(project.settings.reportName ?? "").trim() || "Untitled report";
      let query = supabase
        .from("mr_reports")
        .update({ title: name.slice(0, 200), data: stored })
        .eq("id", reportId);
      if (version && !opts.force) query = query.eq("updated_at", version);
      const { data, error } = await query.select("updated_at");
      if (error) return { ok: false, error: error.message };
      if (!data || data.length === 0) {
        const { data: cur } = await supabase
          .from("mr_reports")
          .select("updated_at, updated_by_email")
          .eq("id", reportId)
          .single();
        if (!cur)
          return {
            ok: false,
            error: "You can't save this report (no edit rights, or it was deleted).",
          };
        return {
          ok: false,
          conflict: true,
          by: (cur.updated_by_email as string) ?? null,
          at: cur.updated_at as string,
        };
      }
      version = data[0]!.updated_at as string;

      // 3. Best effort: remove images this report no longer uses.
      const keep = new Set(referencedImagePaths(project));
      const { data: files } = await supabase.storage
        .from(IMAGE_BUCKET)
        .list(reportId, { limit: 1000 });
      const stale = (files ?? []).map((f) => `${reportId}/${f.name}`).filter((p) => !keep.has(p));
      if (stale.length) await supabase.storage.from(IMAGE_BUCKET).remove(stale);

      return { ok: true, savedAt: version };
    },
  };
}
