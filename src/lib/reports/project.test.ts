import { describe, expect, it } from "vitest";
import {
  imagePath,
  projectSchema,
  referencedImagePaths,
  remapImagePaths,
  toStoredProject,
  type Project,
} from "./project";

const sample = (): Project =>
  projectSchema.parse({
    settings: { reportName: "Oct board meeting" },
    slides: [
      { id: "s1", layout: "cover", include: true, blocks: [] },
      {
        id: "s2",
        layout: "content",
        include: true,
        title: "Production",
        blocks: [
          { id: "b1", type: "text", x: 0, y: 0, w: 1, h: 1, text: "- hi" },
          {
            id: "b2",
            type: "image",
            x: 0,
            y: 0,
            w: 1,
            h: 1,
            img: "r1/b2-1.png",
            src: "data:image/png;base64,AA",
          },
          {
            id: "b3",
            type: "image",
            x: 0,
            y: 0,
            w: 1,
            h: 1,
            img: null,
            src: "data:image/png;base64,BB",
          },
          { id: "b4", type: "image", x: 0, y: 0, w: 1, h: 1, img: null, src: null },
        ],
      },
    ],
  });

describe("projectSchema", () => {
  it("keeps editor fields it does not know about", () => {
    const p = sample();
    expect((p.slides[1] as { title?: string }).title).toBe("Production");
  });
  it("rejects a file without slides", () => {
    expect(projectSchema.safeParse({ settings: {}, slides: [] }).success).toBe(false);
    expect(projectSchema.safeParse({ hello: 1 }).success).toBe(false);
  });
});

describe("image handling", () => {
  it("lists only stored image paths", () => {
    expect(referencedImagePaths(sample())).toEqual(["r1/b2-1.png"]);
  });
  it("drops image bytes from the stored JSON without touching the original", () => {
    const p = sample();
    const stored = toStoredProject(p);
    const imgs = stored.slides[1]!.blocks.filter((b) => b.type === "image");
    expect(imgs.every((b) => b.src === undefined || b.src === null)).toBe(true);
    expect(p.slides[1]!.blocks[1]!.src).toContain("data:");
  });
  it("builds safe storage paths", () => {
    expect(imagePath("r1", "b/../x", "image/png", 5)).toBe("r1/bx-5.png");
    expect(imagePath("r1", "b1", "image/jpeg", 5)).toBe("r1/b1-5.jpg");
  });
  it("remaps paths to a duplicated report", () => {
    expect(referencedImagePaths(remapImagePaths(sample(), "r1", "r2"))).toEqual(["r2/b2-1.png"]);
  });

  it("accepts KPI card blocks", () => {
    const p = projectSchema.parse({
      slides: [
        {
          id: "s1",
          layout: "content",
          include: true,
          blocks: [{ id: "k1", type: "kpi", x: 0, y: 0, w: 2, h: 1, title: "Stock", value: "₹ 1 M" }],
        },
      ],
    });
    expect(p.slides[0]!.blocks[0]!.type).toBe("kpi");
  });
});
