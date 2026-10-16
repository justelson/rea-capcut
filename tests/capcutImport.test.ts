import { describe, expect, it } from "vitest";
import { importCapcutDraft } from "../src/core/capcutImport";
import { validateProject } from "../src/core/model";
function draft() {
  return {
    name: "classic 测试",
    fps: 30,
    canvas_config: { width: 1920, height: 1080 },
    materials: {
      videos: [
        {
          id: "video",
          type: "video",
          path: "/tmp/test.mp4",
          material_name: "样片",
          duration: 10_000_000,
          width: 1920,
          height: 1080,
        },
      ],
      speeds: [{ id: "speed", speed: 2 }],
      texts: [
        {
          id: "text",
          type: "text",
          content: JSON.stringify({ text: "中文字幕" }),
        },
      ],
    },
    tracks: [
      {
        type: "video",
        segments: [
          {
            material_id: "video",
            target_timerange: { start: 1_000_000, duration: 2_000_000 },
            source_timerange: { start: 2_000_000, duration: 4_000_000 },
            extra_material_refs: ["speed"],
            volume: 0.4,
            clip: {
              transform: { x: 0.1, y: -0.2 },
              scale: { x: 1, y: 1 },
              alpha: 0.5,
            },
          },
        ],
      },
      {
        type: "text",
        segments: [
          {
            material_id: "text",
            target_timerange: { start: 0, duration: 2_000_000 },
          },
        ],
      },
    ],
  };
}
describe("experimental classic plaintext import", () => {
  it("maps synthetic microsecond ranges and known basic transforms independently", () => {
    const { project, warnings } = importCapcutDraft(JSON.stringify(draft()), {
      mediaUrl: (path) => "file://" + path,
    });
    expect(project.clips).toHaveLength(2);
    expect(project.clips[0]).toMatchObject({
      start: 1,
      duration: 2,
      sourceIn: 2,
      speed: 2,
      volume: 0.4,
      transform: { x: 96, y: 108, opacity: 0.5 },
    });
    expect(project.clips[1].text?.text).toBe("中文字幕");
    expect(warnings.some((w) => w.includes("Experimental import"))).toBe(true);
    expect(() => validateProject(project)).not.toThrow();
  });
  it("infers an original canvas from an imported visual clip before mapping positions", () => {
    const d = draft();
    d.canvas_config = { width: 0, height: 0 };
    d.materials.videos[0].width = 640;
    d.materials.videos[0].height = 360;
    // A text track may precede the visual track, so all positions must use the
    // final canvas rather than the temporary default during traversal.
    d.tracks.reverse();
    const text = d.tracks[0].segments[0];
    const result = importCapcutDraft({
      ...d,
      canvas_config: { ...d.canvas_config, ratio: "original" },
      tracks: [
        {
          ...d.tracks[0],
          segments: [{ ...text, clip: { transform: { x: 0.5, y: 0.5 } } }],
        },
        d.tracks[1],
      ],
    });
    expect(result.project).toMatchObject({ width: 640, height: 360 });
    expect(result.project.clips[0].transform).toMatchObject({ x: 160, y: -90 });
    expect(result.project.clips[1].transform).toMatchObject({ x: 32, y: 36 });
    expect(result.warnings.some((w) => w.includes("Inferred 640 × 360"))).toBe(
      true,
    );
    expect(() => validateProject(result.project)).not.toThrow();
  });
  it("preserves explicit canvas dimensions and their supported bounds", () => {
    const d = draft();
    d.canvas_config = { width: 1080, height: 1920 };
    d.materials.videos[0].width = 640;
    d.materials.videos[0].height = 360;
    const result = importCapcutDraft(d);
    expect(result.project).toMatchObject({ width: 1080, height: 1920 });
    expect(result.project.clips[0].transform).toMatchObject({ x: 54, y: 192 });
    expect(result.warnings.some((w) => w.includes("canvas size"))).toBe(false);
    d.canvas_config = { width: 10000, height: 1 };
    expect(importCapcutDraft(d).project).toMatchObject({
      width: 7680,
      height: 16,
    });
  });
  it("falls back with a warning when canvas and usable media dimensions are missing", () => {
    const d = draft();
    d.materials.videos[0].width = 0;
    d.materials.videos[0].height = 0;
    const result = importCapcutDraft({ ...d, canvas_config: undefined });
    expect(result.project).toMatchObject({ width: 1920, height: 1080 });
    expect(result.warnings.some((w) => w.includes("Using 1920 × 1080"))).toBe(
      true,
    );
    expect(() => validateProject(result.project)).not.toThrow();
  });
  it("ignores unreferenced media when inferring canvas dimensions", () => {
    const d = draft();
    d.canvas_config = { width: 0, height: 0 };
    d.materials.videos[0].width = 640;
    d.materials.videos[0].height = 360;
    d.materials.videos.unshift({
      ...d.materials.videos[0],
      id: "unused",
      width: 3840,
      height: 2160,
    });
    const result = importCapcutDraft(d);
    expect(result.project).toMatchObject({ width: 640, height: 360 });
    expect(result.project.assets).toHaveLength(1);
  });
  it("does not infer a canvas from rejected clips or invalid media dimensions", () => {
    const invalidMedia = [
      { path: "" },
      { path: "https://example.com/remote.mp4" },
      { type: "sticker" },
      { duration: 3_000_000 },
      { width: -640 },
      { width: Number.NaN },
      { height: 360.5 },
      { width: 100001 },
    ];
    for (const change of invalidMedia) {
      const d = draft();
      d.canvas_config = { width: 0, height: 0 };
      Object.assign(d.materials.videos[0], change);
      const result = importCapcutDraft(d);
      expect(result.project).toMatchObject({ width: 1920, height: 1080 });
      expect(result.warnings.some((w) => w.includes("Using 1920 × 1080"))).toBe(
        true,
      );
      expect(() => validateProject(result.project)).not.toThrow();
    }
  });
  it("uses a later valid referenced visual asset after an earlier rejected one", () => {
    const d = draft();
    d.canvas_config = { width: 0, height: 0 };
    d.materials.videos[0].width = 640;
    d.materials.videos[0].height = 360;
    d.materials.videos.unshift({
      ...d.materials.videos[0],
      id: "remote",
      path: "https://example.com/remote.mp4",
      width: 3840,
      height: 2160,
    });
    const segment = d.tracks[0].segments[0];
    if (!("source_timerange" in segment)) throw new Error("Expected video fixture");
    d.tracks[0].segments.unshift({
      ...segment,
      material_id: "remote",
    });
    const result = importCapcutDraft(d);
    expect(result.project).toMatchObject({ width: 640, height: 360 });
    expect(result.project.clips).toHaveLength(2);
    expect(result.warnings.some((w) => w.includes("local absolute path"))).toBe(true);
  });
  it("requires desktop envelope decoding before schema conversion", () => {
    expect(() => importCapcutDraft("opaque-base64-carrier")).toThrow("opaque payload");
    expect(() => importCapcutDraft("{bad")).toThrow("parse the CapCut draft JSON");
    expect(() => importCapcutDraft({ tracks: [], materials: [] })).toThrow(
      "must contain tracks and materials",
    );
  });
  it("accepts observed sparse empty modern timelines but rejects malformed ones", () => {
    const empty = {
      id: "synthetic-empty", version: 360000, new_version: "179.0.0",
      canvas_config: { width: 1920, height: 1080 }, materials: {},
    };
    const result = importCapcutDraft(empty);
    expect(result.project.clips).toEqual([]);
    expect(result.project.assets).toEqual([]);
    expect(() => validateProject(result.project)).not.toThrow();
    for (const change of [
      { id: undefined }, { version: undefined }, { new_version: undefined },
      { duration: 1 }, { duration: "invalid" }, { tracks: null },
      { materials: { videos: [{ id: "unaccounted" }] } },
    ]) expect(() => importCapcutDraft({ ...empty, ...change })).toThrow("must contain tracks and materials");
  });
  it("puts higher native track layers above video and uses the observed empty canvas background", () => {
    const d = draft();
    const result = importCapcutDraft(d).project;
    expect(result.tracks.map(t => t.kind)).toEqual(["text", "video"]);
    expect(result.background).toBe("#000000");
    const indexed = { ...d, tracks: d.tracks.map((track, index) => ({
      ...track, segments: track.segments.map(segment => ({ ...segment, track_render_index: index })),
    })).reverse() };
    expect(importCapcutDraft(indexed).project.tracks.map(t => t.kind)).toEqual(["text", "video"]);
  });
  it("reports clamped values without misreporting uniform scale as nonuniform", () => {
    const d = draft();
    Object.assign(d.tracks[0].segments[0], { volume: 16, clip: {
      scale: { x: 20, y: 20 }, alpha: 2,
    } });
    const result = importCapcutDraft(d);
    expect(result.project.clips[0]).toMatchObject({ volume: 4, transform: { scale: 10, opacity: 1 } });
    for (const word of ["volume is outside", "scale is outside", "opacity is outside"])
      expect(result.warnings.some(w => w.includes(word))).toBe(true);
    expect(result.warnings.some(w => w.includes("Non-uniform scaling"))).toBe(false);
  });
  it("skips unsupported/network paths and impossible source ranges with warnings", () => {
    const d = draft();
    d.materials.videos[0].path = "https://example.com/private.mp4";
    const remote = importCapcutDraft(d);
    expect(remote.project.clips).toHaveLength(1);
    expect(remote.warnings.some((w) => w.includes("local absolute path"))).toBe(true);
    d.materials.videos[0].path = "/tmp/test.mp4";
    d.materials.videos[0].duration = 3_000_000;
    const impossible = importCapcutDraft(d);
    expect(impossible.project.clips).toHaveLength(1);
    expect(impossible.warnings.some((w) => w.includes("source media duration"))).toBe(
      true,
    );
  });
  it("infers missing source duration from every referencing segment", () => {
    const d = draft();
    d.materials.videos[0].duration = 0;
    const segment = d.tracks[0]
      .segments[0] as (typeof d.tracks)[0]["segments"][number] & {
      extra_material_refs: string[];
      volume: number;
      clip: {
        transform: { x: number; y: number };
        scale: { x: number; y: number };
        alpha: number;
      };
    };
    d.tracks[0].segments.push({
      ...segment,
      target_timerange: { start: 5_000_000, duration: 2_000_000 },
      source_timerange: { start: 6_000_000, duration: 4_000_000 },
    });
    const result = importCapcutDraft(d);
    expect(result.project.assets[0].duration).toBe(10);
    expect(result.project.clips).toHaveLength(3);
    expect(() => validateProject(result.project)).not.toThrow();
  });
  it("accepts Windows local paths and preserves synthetic text only with explicit style warning", () => {
    const d = draft();
    d.materials.videos[0].path = "C:\\素材\\测试.mp4";
    const result = importCapcutDraft(d);
    expect(result.project.assets[0].path).toBe(d.materials.videos[0].path);
    expect(result.warnings.some((w) => w.includes("styles"))).toBe(true);
  });
  it("bounds pathological input and skips nonpositive timeline ranges", () => {
    const d = draft();
    d.tracks[0].segments[0].target_timerange.duration = -1;
    expect(importCapcutDraft(d).project.clips).toHaveLength(1);
    expect(() =>
      importCapcutDraft({ tracks: Array(1001).fill({}), materials: {} }),
    ).toThrow("track import limit");
  });
});
