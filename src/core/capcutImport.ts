import type { Clip, MediaAsset, Project, TrackKind } from "./types";
import {
  createProject,
  createTrack,
  createClip,
  id,
  validateProject,
} from "./model";

type ObjectValue = Record<string, unknown>;
export interface CapcutImportOptions {
  name?: string;
  mediaUrl?: (path: string) => string;
}
export interface CapcutImportResult {
  project: Project;
  warnings: string[];
}
const object = (v: unknown): ObjectValue =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as ObjectValue) : {};
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const string = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
const number = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const seconds = (v: unknown) => number(v) / 1_000_000;
const bounded = (v: unknown, low: number, high: number, fallback: number) =>
  Math.max(low, Math.min(high, number(v, fallback)));
const identityUrl = (path: string) => path;

/** Experimental, lossy conversion of decoded tracks/materials JSON.
 * Desktop envelope decoding is handled before this platform-neutral converter. */
export function importCapcutDraft(
  input: unknown,
  options: CapcutImportOptions = {},
): CapcutImportResult {
  if (typeof input === "string") {
    const source = input.trim().replace(/^\uFEFF/, "");
    if (!source.startsWith("{"))
      throw new Error(
        "This CapCut draft is an opaque payload. Open it in the desktop app with the CapCut draft importer.",
      );
    try {
      input = JSON.parse(source);
    } catch {
      throw new Error("Could not parse the CapCut draft JSON.");
    }
  }
  const draft = object(input);
  // Modern empty timelines omit tracks. Require the observed versioned draft
  // structure so arbitrary objects and malformed tracks still fail validation.
  const sparseEmpty =
    draft.tracks === undefined &&
    typeof draft.id === "string" && draft.id.length > 0 &&
    Number.isInteger(draft.version) && number(draft.version) > 0 &&
    typeof draft.new_version === "string" && draft.new_version.length > 0 &&
    (draft.duration === undefined || draft.duration === 0) &&
    Object.keys(object(draft.materials)).length === 0 &&
    number(object(draft.canvas_config).width) > 0 &&
    number(object(draft.canvas_config).height) > 0;
  const tracks = sparseEmpty ? [] : draft.tracks;
  if (
    !Array.isArray(tracks) ||
    !draft.materials ||
    typeof draft.materials !== "object" ||
    Array.isArray(draft.materials)
  )
    throw new Error("Unsupported CapCut draft. It must contain tracks and materials, or a valid empty timeline.");
  if (tracks.length > 1000) throw new Error("The draft exceeds the track import limit.");
  const warnings: string[] = [
    "Experimental import: only basic timeline features are converted. Some effects and text styles may be lost. Review the preview and export.",
  ];
  const warn = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message);
  };
  const project = createProject(
    options.name ?? string(draft.name, "CapCut import"),
  );
  // The controlled native export uses black when no canvas background is set.
  project.background = "#000000";
  const canvas = object(draft.canvas_config);
  const hasCanvasDimensions =
    number(canvas.width) > 0 && number(canvas.height) > 0;
  if (hasCanvasDimensions) {
    project.width = Math.round(bounded(canvas.width, 16, 7680, 1920));
    project.height = Math.round(bounded(canvas.height, 16, 7680, 1080));
  }
  const fps = number(draft.fps, 30);
  project.fps = [24, 25, 30, 50, 60].includes(fps) ? fps : 30;
  if (fps !== project.fps) warn(`Frame rate ${fps} is unsupported. Using 30 fps.`);
  project.tracks = [];
  project.assets = [];
  project.clips = [];
  const materials = object(draft.materials);
  const materialById = new Map<
    string,
    { category: string; data: ObjectValue }
  >();
  let materialCount = 0;
  for (const [category, items] of Object.entries(materials))
    for (const item of array(items)) {
      if (++materialCount > 100000) throw new Error("The draft exceeds the asset import limit.");
      const data = object(item),
        materialId = string(data.id);
      if (materialId) materialById.set(materialId, { category, data });
    }
  const assets = new Map<string, MediaAsset>();
  const makeAsset = (
    materialId: string,
    category: string,
    data: ObjectValue,
  ): MediaAsset | undefined => {
    const known = assets.get(materialId);
    if (known) return known;
    const type = string(data.type);
    const kind =
      category === "audios"
        ? "audio"
        : ["photo", "image"].includes(type)
          ? "image"
          : type === "video" || type === ""
            ? "video"
            : undefined;
    if (!kind) {
      warn(`Asset type ${type || category} is unsupported. Related clips were skipped.`);
      return undefined;
    }
    const path = string(data.path);
    if (
      path &&
      (!/^(\/|[a-zA-Z]:[\\/])/.test(path) ||
        path.includes("\0") ||
        path.length > 32768)
    ) {
      warn("The asset path is not a supported local absolute path. Related clips were skipped.");
      return undefined;
    }
    if (!path) {
      warn(
        `Asset ${string(data.material_name, materialId)} has no local path. Related clips were skipped.`,
      );
      return undefined;
    }
    const asset: MediaAsset = {
      id: id(),
      kind,
      path,
      url: (options.mediaUrl ?? identityUrl)(path),
      name: string(
        data.material_name,
        string(data.name, path.split(/[\\/]/).pop() ?? "Media"),
      ),
      duration: bounded(seconds(data.duration), 0, 86400 * 8, 0),
      width: bounded(data.width, 0, 100000, 0),
      height: bounded(data.height, 0, 100000, 0),
      fps: bounded(data.fps, 0, 1000, project.fps),
      hasAudio: kind === "audio" || kind === "video",
      missing: false,
    };
    assets.set(materialId, asset);
    project.assets.push(asset);
    return asset;
  };
  let originalCanvas: { width: number; height: number } | undefined;
  const positions = new Map<Clip, { x: number; y: number }>();
  const inferredDurations = new Set<string>();
  const trackLayers = new Map<string, number>();
  const unmappedSettings = new Set<string>();
  const settingNames: Record<string, string> = {
    canvases: "Canvas backgrounds", placeholder_infos: "Placeholder settings",
    sound_channel_mappings: "Audio channel settings", material_colors: "Asset colors",
    vocal_separations: "Vocal separation", material_animations: "Clip animations",
    transitions: "Transitions", video_effects: "Video effects", audio_effects: "Audio effects",
    audio_fades: "Audio fades", masks: "Masks",
  };
  let totalSegments = 0;
  for (const rawTrack of tracks) {
    const sourceTrack = object(rawTrack),
      kind = string(sourceTrack.type);
    if (!["video", "audio", "text"].includes(kind)) {
      warn(`Track type ${kind || "unknown"} is unsupported. It was skipped.`);
      continue;
    }
    const track = createTrack(
      kind as TrackKind,
      string(
        sourceTrack.name,
        { video: "Video", audio: "Audio", text: "Text" }[kind],
      ),
    );
    project.tracks.push(track);
    const layers = array(sourceTrack.segments)
      .map((item) => object(item).track_render_index)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const uniqueLayers = [...new Set(layers)];
    trackLayers.set(track.id, uniqueLayers[0] ?? project.tracks.length - 1);
    if (uniqueLayers.length > 1)
      warn("Clips on this track use different layer orders. Imported using the first clip's track layer. Review which clips overlap.");
    for (const rawSegment of array(sourceTrack.segments)) {
      if (++totalSegments > 10000) throw new Error("The draft exceeds the clip import limit.");
      const segment = object(rawSegment),
        materialId = string(segment.material_id),
        material = materialById.get(materialId);
      if (!material) {
        warn(`The clip references missing asset ${materialId || "unknown"}. It was skipped.`);
        continue;
      }
      const target = object(segment.target_timerange),
        source = object(segment.source_timerange);
      const start = seconds(target.start),
        duration = seconds(target.duration),
        sourceIn = seconds(source.start);
      if (
        start < 0 ||
        duration <= 0 ||
        start + duration > 86400 ||
        sourceIn < 0 ||
        sourceIn > 86400 * 8
      ) {
        warn("A clip has an invalid time range and was skipped.");
        continue;
      }
      let asset: MediaAsset | undefined;
      if (kind === "text") {
        if (
          material.category !== "texts" ||
          !["text", "subtitle", ""].includes(string(material.data.type))
        ) {
          warn("Non-basic text media was skipped.");
          continue;
        }
      } else {
        if (material.category !== (kind === "audio" ? "audios" : "videos")) {
          warn("The asset type does not match the track. Related clips were skipped.");
          continue;
        }
        asset = makeAsset(materialId, material.category, material.data);
        if (!asset) continue;
        if (asset.duration === 0 && asset.kind !== "image")
          inferredDurations.add(asset.id);
      }
      const clip = createClip(asset, track.id, start, project.fps);
      clip.start = start;
      clip.duration = duration;
      clip.sourceIn = sourceIn;
      const refs = array(segment.extra_material_refs).map((v) => string(v));
      const speedMaterial = refs
        .map((ref) => materialById.get(ref))
        .find((m) => m?.category === "speeds");
      const speed = number(
        speedMaterial?.data.speed,
        asset?.kind === "image" || !asset
          ? 1
          : seconds(source.duration) / duration || 1,
      );
      if (speed < 0.1 || speed > 8) {
        warn(`Clip speed ${speed} is outside the 0.1–8× range. The clip was skipped.`);
        continue;
      }
      if (asset && asset.kind !== "image") {
        const extent = sourceIn + duration * speed;
        if (extent > 86400 * 8) {
          warn("The source media range is unsupported. Related clips were skipped.");
          continue;
        }
        if (inferredDurations.has(asset.id)) {
          asset.duration = Math.max(asset.duration, extent);
          warn(
            "Some assets have no duration. It was inferred from the basic clip; relink the media to check its actual duration.",
          );
        } else if (extent > asset.duration + 0.08) {
          warn("The clip exceeds the recorded source media duration and was skipped.");
          continue;
        }
        if (
          seconds(source.duration) > 0 &&
          Math.abs(seconds(source.duration) - duration * speed) > 0.08
        )
          warn("The source and target ranges differ from the base speed. Curved speed changes may not be preserved.");
      }
      clip.speed = speed;
      clip.volume = bounded(segment.volume, 0, 4, 1);
      if (clip.volume !== number(segment.volume, 1))
        warn("Clip volume is outside the supported range. It was limited to 0–4×; review the audio.");
      const transform = object(segment.clip),
        position = object(transform.transform),
        scale = object(transform.scale),
        flip = object(transform.flip);
      clip.transform.scale = bounded(scale.x, 0.05, 10, 1);
      clip.transform.rotation = bounded(transform.rotation, -1e9, 1e9, 0);
      clip.transform.opacity = bounded(transform.alpha, 0, 1, 1);
      if (clip.transform.scale !== number(scale.x, 1))
        warn("Clip scale is outside the supported range. It was limited to 0.05–10×.");
      if (clip.transform.opacity !== number(transform.alpha, 1))
        warn("Clip opacity is outside the supported range. It was limited to 0–1.");
      clip.transform.flipX = flip.horizontal === true;
      clip.transform.flipY = flip.vertical === true;
      if (number(scale.y, number(scale.x, 1)) !== number(scale.x, 1))
        warn("Non-uniform scaling was imported as uniform scaling. The image may look different.");
      if (kind === "text") {
        const text = parseText(material.data.content);
        if (text === undefined || text.length > 20000) {
          warn("A clip with unreadable text was skipped.");
          continue;
        }
        clip.text!.text = text;
        clip.name = text.slice(0, 30) || "Text";
        warn(
          "Text content was preserved. CapCut fonts, decorative text, styles, and layout are not mapped; using ReaCut defaults.",
        );
      }
      if (segment.reverse === true) warn("Reverse playback is unsupported. This clip will play forward.");
      if (
        array(segment.common_keyframes).length ||
        Object.keys(object(segment.keyframes)).length
      )
        warn("CapCut keyframes are not mapped. Static clip settings were preserved.");
      for (const ref of refs) {
        const extra = materialById.get(ref);
        if (extra && extra.category !== "speeds")
          unmappedSettings.add(settingNames[extra.category] ?? "Other effects");
        if (
          extra?.category === "speeds" &&
          array(extra.data.curve_speed).length
        )
          warn("Curved speed changes are unsupported. Only the base speed was preserved.");
      }
      if (Object.keys(object(material.data.crop)).length)
        warn("CapCut crop settings are not mapped. The full source image was used.");
      // Only accepted visual segments may establish an unspecified canvas.
      // Library-only materials and rejected clips must not affect its size.
      if (!hasCanvasDimensions && !originalCanvas && kind === "video" && asset) {
        const width = number(material.data.width),
          height = number(material.data.height);
        if (
          Number.isInteger(width) &&
          width > 0 &&
          width <= 100000 &&
          Number.isInteger(height) &&
          height > 0 &&
          height <= 100000
        )
          originalCanvas = { width, height };
      }
      positions.set(clip, { x: number(position.x), y: number(position.y) });
      project.clips.push(clip);
    }
  }
  if (!hasCanvasDimensions) {
    if (originalCanvas) {
      project.width = Math.round(bounded(originalCanvas.width, 16, 7680, 1920));
      project.height = Math.round(bounded(originalCanvas.height, 16, 7680, 1080));
      warn(
        `The draft has no valid canvas size. Inferred ${project.width} × ${project.height} from the first importable visual clip. Review the aspect ratio.`,
      );
    } else {
      warn(
        "The draft has no valid canvas size or visual clip to infer from. Using 1920 × 1080. Review the aspect ratio.",
      );
    }
  }
  for (const [clip, position] of positions) {
    clip.transform.x = bounded((position.x * project.width) / 2, -1e9, 1e9, 0);
    clip.transform.y = bounded((-position.y * project.height) / 2, -1e9, 1e9, 0);
  }
  // Native higher track_render_index is drawn above lower values. ReaCut's
  // first track is the top layer; source array order is the fallback.
  project.tracks.sort((a, b) => trackLayers.get(b.id)! - trackLayers.get(a.id)!);
  if (!project.tracks.length) project.tracks = [createTrack("video")];
  if (!project.clips.length) warn("No basic clips could be imported.");
  if (unmappedSettings.size)
    warn(`Unconverted settings: ${[...unmappedSettings].join(", ")}. Review the related effects.`);
  const bg = object(canvas.background);
  if (Object.keys(bg).length)
    warn("CapCut canvas backgrounds are not mapped. Using a black background.");
  return { project: validateProject(project), warnings };
}

function parseText(content: unknown): string | undefined {
  if (typeof content !== "string") return undefined;
  if (!content.trim().startsWith("{")) return content;
  try {
    const value = object(JSON.parse(content));
    return typeof value.text === "string" ? value.text : undefined;
  } catch {
    return undefined;
  }
}
