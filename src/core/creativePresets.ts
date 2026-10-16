/** Original, offline editing recipes. MIT; no third-party templates or media. */
import type { Clip, Keyframe, Project, TextStyle } from "./types";
import {
  createClip,
  createTrack,
  evaluateKeyframes,
  id,
  snapToFrame,
} from "./model";

export interface TextPreset {
  id: string;
  name: string;
  category: "Title" | "Captions" | "Labels" | "Motion";
  style: Partial<TextStyle> & { text: string };
  y?: number;
  motion?: "rise" | "pop" | "fade";
}
export const TEXT_PRESETS: readonly TextPreset[] = [
  {
    id: "classic",
    name: "Classic title",
    category: "Title",
    style: { text: "Turn ideas into images", fontSize: 80 },
  },
  {
    id: "chapter",
    name: "Chapter title",
    category: "Title",
    style: {
      text: "CHAPTER 01\nMy story",
      fontSize: 66,
      color: "#ffd69a",
      strokeWidth: 0,
    },
  },
  {
    id: "cinema",
    name: "Film title",
    category: "Title",
    style: {
      text: "On the road\nA JOURNEY",
      fontSize: 90,
      color: "#fff0d5",
      strokeWidth: 0,
    },
  },
  {
    id: "editorial",
    name: "Minimal masthead",
    category: "Title",
    style: {
      text: "Life in view\nVOL. 01",
      fontSize: 70,
      bold: false,
      strokeWidth: 0,
    },
  },
  {
    id: "subtitle",
    name: "Caption bar",
    category: "Captions",
    y: 0.36,
    style: {
      text: "Every frame is worth remembering",
      fontSize: 52,
      bold: false,
      background: "#11151c",
      strokeWidth: 0,
    },
  },
  {
    id: "outline",
    name: "Clean outline",
    category: "Captions",
    y: 0.36,
    style: { text: "Add a little light to an ordinary day", fontSize: 54, strokeWidth: 4 },
  },
  {
    id: "warm-caption",
    name: "Warm narration",
    category: "Captions",
    y: 0.32,
    style: {
      text: "Take it slow. There is beauty along the way.",
      fontSize: 48,
      bold: false,
      color: "#fff0d5",
      background: "#493b32",
      strokeWidth: 0,
    },
  },
  {
    id: "quote",
    name: "Interview quote",
    category: "Captions",
    style: {
      text: "“Make room for what you love, every day.”",
      fontSize: 64,
      color: "#a0f1df",
      strokeWidth: 0,
    },
  },
  {
    id: "mint",
    name: "Mint label",
    category: "Labels",
    style: { text: "REACUT", fontSize: 104, color: "#62ead1", strokeWidth: 0 },
  },
  {
    id: "comic",
    name: "Comic emphasis",
    category: "Labels",
    style: {
      text: "Here comes the good part!",
      fontSize: 100,
      color: "#ffd176",
      stroke: "#382637",
      strokeWidth: 7,
    },
  },
  {
    id: "news",
    name: "News flash",
    category: "Labels",
    y: 0.29,
    style: {
      text: "Live update · Just in",
      fontSize: 60,
      background: "#b63f43",
      strokeWidth: 0,
    },
  },
  {
    id: "label",
    name: "Name tag",
    category: "Labels",
    y: 0.3,
    style: {
      text: "Your name · Creator",
      fontSize: 52,
      color: "#15252c",
      background: "#62ead1",
      strokeWidth: 0,
    },
  },
  {
    id: "rise",
    name: "Gentle rise",
    category: "Motion",
    motion: "rise",
    style: { text: "A new story starts now", fontSize: 74, strokeWidth: 0 },
  },
  {
    id: "pop",
    name: "Bouncy entrance",
    category: "Motion",
    motion: "pop",
    style: { text: "HELLO！", fontSize: 108, color: "#ffd176", strokeWidth: 4 },
  },
  {
    id: "fade",
    name: "Soft glow intro",
    category: "Motion",
    motion: "fade",
    style: {
      text: "Meet a beautiful moment",
      fontSize: 72,
      bold: false,
      color: "#fff0d5",
      strokeWidth: 0,
    },
  },
  {
    id: "end",
    name: "Gentle outro",
    category: "Motion",
    motion: "fade",
    style: {
      text: "Thanks for watching\nSee you next time",
      fontSize: 76,
      color: "#a0f1df",
      strokeWidth: 0,
    },
  },
];
type VisualProperty = Exclude<Keyframe["property"], "volume">;
function keys(
  property: VisualProperty,
  points: [number, number][],
): Keyframe[] {
  return points.map(([time, value]) => ({
    id: id(),
    property,
    time,
    value,
    easing: "easeInOut",
  }));
}
function replaceKeys(clip: Clip, additions: Keyframe[]): Keyframe[] {
  const properties = new Set(additions.map((k) => k.property));
  return [
    ...clip.keyframes.filter((k) => !properties.has(k.property)),
    ...additions,
  ];
}
export function makeTextPreset(
  preset: TextPreset,
  trackId: string,
  start: number,
  project: Pick<Project, "width" | "height" | "fps">,
): Clip {
  const clip = createClip(undefined, trackId, start, project.fps);
  const scale = Math.min(project.width / 1920, project.height / 1080);
  clip.text = {
    ...clip.text!,
    ...preset.style,
    fontSize: Math.min(
      1000,
      Math.max(8, (preset.style.fontSize ?? 72) * scale),
    ),
    strokeWidth: (preset.style.strokeWidth ?? 2) * scale,
  };
  clip.name = preset.style.text.replaceAll("\n", " · ");
  clip.transform.y = (preset.y ?? 0) * project.height;
  if (preset.motion) {
    clip.fadeIn = 0.5;
    clip.fadeOut = 0.5;
  }
  if (preset.motion === "rise")
    clip.keyframes = keys("y", [
      [0, clip.transform.y + project.height * 0.12],
      [0.65, clip.transform.y],
    ]);
  if (preset.motion === "pop")
    clip.keyframes = keys("scale", [
      [0, 0.45],
      [0.4, 1.1],
      [0.65, 1],
    ]);
  return clip;
}
export function addTextPreset(
  project: Project,
  preset: TextPreset,
  start: number,
): { project: Project; clip: Clip } {
  const track =
    project.tracks.find((t) => t.kind === "text" && !t.locked) ??
    createTrack("text");
  const clip = makeTextPreset(preset, track.id, start, project);
  return {
    project: {
      ...project,
      tracks: project.tracks.includes(track)
        ? project.tracks
        : [track, ...project.tracks],
      clips: [...project.clips, clip],
    },
    clip,
  };
}
export const MOTION_PRESETS = [
  { id: "push", name: "Slow push-in", description: "Slowly zoom in from the current scale to emphasize the subject." },
  { id: "pull", name: "Pull back", description: "Pull back from a close-up to the current framing." },
  { id: "pan-left", name: "Pan left", description: "A subtle horizontal pan for photos and landscapes." },
  {
    id: "pan-right",
    name: "Pan right",
    description: "A subtle horizontal pan for photos and landscapes.",
  },
  { id: "float", name: "Gentle float", description: "Drift slowly up and down." },
  { id: "pulse", name: "Breathing zoom", description: "Two soft zooms with a gentle return." },
  { id: "sway", name: "Gentle sway", description: "A small side-to-side rotation." },
  { id: "shake", name: "Rhythmic shake", description: "A quick horizontal shake, then return to center." },
] as const;
export type MotionId = (typeof MOTION_PRESETS)[number]["id"];
export function motionPatch(
  clip: Clip,
  motion: MotionId,
  project: Pick<Project, "width" | "height">,
): Partial<Clip> {
  const d = clip.duration,
    t = clip.transform;
  const scale = (v: number) => Math.max(0.01, Math.min(10, v));
  let frames: Keyframe[];
  switch (motion) {
    case "push":
      frames = keys("scale", [
        [0, t.scale],
        [d, scale(t.scale * 1.18)],
      ]);
      break;
    case "pull":
      frames = keys("scale", [
        [0, scale(t.scale * 1.18)],
        [d, t.scale],
      ]);
      break;
    case "pan-left":
    case "pan-right": {
      const delta = project.width * 0.06 * (motion === "pan-left" ? -1 : 1);
      frames = keys("x", [
        [0, t.x - delta],
        [d, t.x + delta],
      ]);
      break;
    }
    case "float":
      frames = keys("y", [
        [0, t.y],
        [d * 0.25, t.y - project.height * 0.025],
        [d * 0.75, t.y + project.height * 0.025],
        [d, t.y],
      ]);
      break;
    case "pulse":
      frames = keys("scale", [
        [0, t.scale],
        [d * 0.25, scale(t.scale * 1.08)],
        [d * 0.5, t.scale],
        [d * 0.75, scale(t.scale * 1.08)],
        [d, t.scale],
      ]);
      break;
    case "sway":
      frames = keys("rotation", [
        [0, t.rotation],
        [d * 0.25, t.rotation - 3],
        [d * 0.75, t.rotation + 3],
        [d, t.rotation],
      ]);
      break;
    case "shake":
      frames = keys("x", [
        [0, t.x],
        ...Array.from(
          { length: 6 },
          (_, i) =>
            [
              (d * (i + 1)) / 12,
              t.x + project.width * 0.014 * (i % 2 ? 1 : -1),
            ] as [number, number],
        ),
        [d * 0.65, t.x],
        [d, t.x],
      ]);
      break;
  }
  return { keyframes: replaceKeys(clip, frames) };
}
export const TRANSITION_PRESETS = [
  {
    id: "dissolve",
    name: "Crossfade",
    description: "Blend two clips smoothly.",
    category: "Basic",
  },
  {
    id: "dip",
    name: "Dip to color",
    description: "Fade through the canvas background into the next clip.",
    category: "Basic",
  },
  {
    id: "slide-left",
    name: "Slide left",
    description: "The next clip slides in from the right.",
    category: "Camera movement",
  },
  {
    id: "slide-right",
    name: "Slide right",
    description: "The next clip slides in from the left.",
    category: "Camera movement",
  },
  {
    id: "slide-up",
    name: "Slide up",
    description: "The next clip slides in from below.",
    category: "Camera movement",
  },
  {
    id: "slide-down",
    name: "Slide down",
    description: "The next clip slides in from above.",
    category: "Camera movement",
  },
  {
    id: "zoom",
    name: "Zoom handoff",
    description: "The next clip grows into view as it fades in.",
    category: "Motion",
  },
  {
    id: "spin",
    name: "Spin handoff",
    description: "The next clip rotates, grows, and fades in.",
    category: "Motion",
  },
] as const;
export type TransitionId = (typeof TRANSITION_PRESETS)[number]["id"];
/** Make the leading edge meet the existing curve at duration; preserve its later keys. */
function incomingKeys(
  clip: Clip,
  property: VisualProperty,
  value: number,
  duration: number,
): Keyframe[] {
  const target = evaluateKeyframes(clip, duration).transform[property];
  const sorted = clip.keyframes
    .filter((k) => k.property === property)
    .sort((a, b) => a.time - b.time);
  const curve = sorted.filter(
    (k, i) => i === sorted.length - 1 || sorted[i + 1].time !== k.time,
  );
  const rightIndex = curve.findIndex((k) => k.time > duration);
  const right = curve[rightIndex],
    left = curve[rightIndex - 1];
  // Restrict the first surviving smoothstep segment to its remaining interval.
  // Merely keeping its destination key would restart easing and change later motion.
  const remaining = clip.keyframes
    .filter((k) => k.property !== property || k.time > duration)
    .map((k) => {
      if (
        k.id !== right?.id ||
        !left ||
        left.time >= duration ||
        right.easing !== "easeInOut"
      )
        return k;
      const window = right.easingWindow ?? { start: 0, end: 1 };
      return {
        ...k,
        easingWindow: {
          start:
            window.start +
            ((window.end - window.start) * (duration - left.time)) /
              (right.time - left.time),
          end: window.end,
        },
      };
    });
  return [
    ...remaining,
    ...keys(property, [
      [0, value],
      [duration, target],
    ]),
  ];
}
export function applyTransition(
  project: Project,
  clipId: string,
  transition: TransitionId,
  seconds: number,
): { project: Project; duration: number } {
  if (
    !TRANSITION_PRESETS.some((p) => p.id === transition) ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  )
    throw new Error("Invalid transition settings.");
  const front = project.clips.find((c) => c.id === clipId),
    track = project.tracks.find((t) => t.id === front?.trackId);
  if (!front || !track || front.text || track.kind === "audio")
    throw new Error("Select a video clip.");
  if (track.locked) throw new Error("Unlock the track first.");
  const siblings = project.clips
    .filter((c) => c.trackId === track.id)
    .sort((a, b) => a.start - b.start);
  const index = siblings.findIndex((c) => c.id === front.id),
    next = siblings[index + 1];
  const end = front.start + front.duration,
    tolerance = 1 / project.fps + 0.00001;
  if (
    !next ||
    next.text ||
    next.start > end + tolerance ||
    next.start < end - front.duration / 2 - 0.00001
  )
    throw new Error("This needs two adjacent video clips on the same track. Remove the gap or reduce the overlap first.");
  const limit = Math.min(5, front.duration / 2, next.duration / 2);
  const duration =
    Math.floor(Math.min(seconds, limit) * project.fps + 1e-8) / project.fps;
  if (duration < 1 / project.fps) throw new Error("The clip is too short for a transition.");
  const newStart = snapToFrame(
    end - (transition === "dip" ? 0 : duration),
    project.fps,
  );
  if (
    siblings[index + 2] &&
    newStart + next.duration > siblings[index + 2].start + 0.00001
  )
    throw new Error("The transition would overlap the following clip. Make room first.");
  let incoming: Clip = {
    ...next,
    start: newStart,
    fadeIn: duration,
    audioFadeIn: duration,
    videoFadeWindow: undefined,
    audioFadeWindow: undefined,
  };
  const at = evaluateKeyframes(next, duration).transform;
  if (transition.startsWith("slide")) {
    const horizontal =
        transition === "slide-left" || transition === "slide-right",
      property = horizontal ? "x" : "y";
    const sign =
      transition === "slide-left" || transition === "slide-up" ? 1 : -1;
    incoming.keyframes = incomingKeys(
      incoming,
      property,
      at[property] + (horizontal ? project.width : project.height) * sign,
      duration,
    );
    incoming.fadeIn = 0;
  }
  if (transition === "zoom" || transition === "spin")
    incoming.keyframes = incomingKeys(
      incoming,
      "scale",
      Math.max(0.01, at.scale * 0.3),
      duration,
    );
  if (transition === "spin")
    incoming.keyframes = incomingKeys(
      incoming,
      "rotation",
      at.rotation - 35,
      duration,
    );
  const outgoing: Clip = {
    ...front,
    fadeOut: transition === "dip" ? duration : 0,
    videoFadeWindow: front.videoFadeWindow
      ? {
          ...front.videoFadeWindow,
          fadeOut: transition === "dip" ? duration : 0,
        }
      : undefined,
    audioFadeOut: duration,
    audioFadeWindow: undefined,
  };
  // A trimmed envelope's original end need not equal this clip's end: materialize the outgoing dip.
  if (transition === "dip") outgoing.videoFadeWindow = undefined;
  return {
    duration,
    project: {
      ...project,
      clips: project.clips.map((c) =>
        c.id === front.id ? outgoing : c.id === next.id ? incoming : c,
      ),
    },
  };
}
