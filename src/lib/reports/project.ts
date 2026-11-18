import { z } from "zod";

// Shape of a saved report. The editor owns the detailed block format; this schema checks the
// parts the app relies on, so a corrupt or foreign file fails clearly instead of half-loading.
const blockSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["text", "table", "chart", "image"]),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    img: z.string().nullable().optional(),
    src: z.string().nullable().optional(),
  })
  .loose();

const slideSchema = z
  .object({
    id: z.string().min(1),
    layout: z.enum(["cover", "content", "end"]),
    include: z.boolean(),
    blocks: z.array(blockSchema),
  })
  .loose();

export const projectSchema = z
  .object({
    version: z.number().optional(),
    settings: z.record(z.string(), z.unknown()).default({}),
    slides: z.array(slideSchema).min(1),
  })
  .loose();

export type Project = z.infer<typeof projectSchema>;
type Block = Project["slides"][number]["blocks"][number];

export const reportTitleSchema = z.string().trim().min(1, "Give the report a name.").max(200);

export const IMAGE_BUCKET = "mr-images";

/** Every image block in a project, in slide order. */
export function imageBlocks(project: Project): Block[] {
  return project.slides.flatMap((s) => s.blocks.filter((b) => b.type === "image"));
}

/** Storage paths a project still references. */
export function referencedImagePaths(project: Project): string[] {
  return imageBlocks(project)
    .map((b) => b.img)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
}

/** The JSON stored in the database: image bytes live in storage, so `src` data URLs are dropped. */
export function toStoredProject(project: Project): Project {
  const copy = structuredClone(project);
  for (const b of imageBlocks(copy)) {
    if (b.img) delete b.src;
    else if (typeof b.src === "string" && b.src.startsWith("data:")) delete b.src;
  }
  return copy;
}

/** Storage path for a new image of a block: <report>/<block>-<time>.<ext>. */
export function imagePath(reportId: string, blockId: string, mime: string, now = Date.now()) {
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/gif"
        ? "gif"
        : mime === "image/webp"
          ? "webp"
          : "jpg";
  const safeBlock = blockId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${reportId}/${safeBlock}-${now}.${ext}`;
}

/** Rewrites image paths after a report's images were copied to a new report folder. */
export function remapImagePaths(project: Project, fromId: string, toId: string): Project {
  const copy = structuredClone(project);
  for (const b of imageBlocks(copy)) {
    if (typeof b.img === "string" && b.img.startsWith(fromId + "/")) {
      b.img = toId + b.img.slice(fromId.length);
    }
  }
  return copy;
}
