import { useState } from "react";
import {
  Check,
  ChevronRight,
  Film,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Waves,
} from "lucide-react";
import type { Adjustments, Clip, TrackKind, Project } from "../core/types";
import { DEFAULT_ADJUSTMENTS } from "../core/defaults";
import "./EffectsPanel.css";
import { MotionLibrary } from "./CreativeLibrary";
import { motionPatch } from "../core/creativePresets";
import PresetPreview from "./PresetPreview";

export interface EffectsPanelProps {
  clip?: Clip;
  project?: Pick<Project, "width" | "height">;
  kind?: TrackKind;
  locked?: boolean;
  onApply: (patch: Partial<Clip>) => void;
}
export interface ColorPreset {
  id: string;
  name: string;
  description: string;
  colors: string;
  adjustments: Partial<Adjustments>;
}
export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "original",
    name: "True to life",
    description: "Restore natural source colors",
    colors: "#526658,#baac84,#65828d",
    adjustments: { ...DEFAULT_ADJUSTMENTS },
  },
  {
    id: "cinema",
    name: "Cinematic",
    description: "Rich contrast with muted colors",
    colors: "#243744,#b49868,#406d7a",
    adjustments: {
      brightness: -0.04,
      contrast: 1.22,
      saturation: 0.78,
      temperature: -0.08,
      blur: 0,
    },
  },
  {
    id: "warm",
    name: "Warm sunlight",
    description: "Warm and bright, ideal for everyday moments",
    colors: "#927b51,#ead092,#c4a570",
    adjustments: {
      brightness: 0.05,
      contrast: 1.05,
      saturation: 1.1,
      temperature: 0.3,
      blur: 0,
    },
  },
  {
    id: "cool",
    name: "Cool blue",
    description: "Clean, cool tones that add depth",
    colors: "#2c5367,#86acbc,#55788e",
    adjustments: {
      brightness: 0.015,
      contrast: 1.12,
      saturation: 0.9,
      temperature: -0.35,
      blur: 0,
    },
  },
  {
    id: "mono",
    name: "Black and white",
    description: "Pure black and white with fine detail in light and shadow",
    colors: "#343839,#bebdb4,#6d7270",
    adjustments: {
      brightness: 0,
      contrast: 1.15,
      saturation: 0,
      temperature: 0,
      blur: 0,
    },
  },
  {
    id: "vintage",
    name: "Vintage",
    description: "Faded warm film look",
    colors: "#686a4c,#c5b680,#8c987d",
    adjustments: {
      brightness: 0.045,
      contrast: 0.86,
      saturation: 0.72,
      temperature: 0.22,
      blur: 0,
    },
  },
  {
    id: "vivid",
    name: "Vivid",
    description: "Bright and saturated, with rich color",
    colors: "#45836b,#f6cf72,#679baa",
    adjustments: {
      brightness: 0.02,
      contrast: 1.1,
      saturation: 1.45,
      temperature: 0,
      blur: 0,
    },
  },
  {
    id: "soft",
    name: "Soft focus",
    description: "Soften details for a dreamy look",
    colors: "#8d9d9b,#d6c9af,#a4aeb9",
    adjustments: {
      brightness: 0.03,
      contrast: 0.95,
      saturation: 0.9,
      temperature: 0.05,
      blur: 2,
    },
  },
];
export function presetPatch(preset: ColorPreset, clip?: Clip): Partial<Clip> {
  return {
    adjustments: {
      ...DEFAULT_ADJUSTMENTS,
      ...clip?.adjustments,
      ...preset.adjustments,
    },
  };
}
export function fadePatch(
  kind: "visual" | "audio",
  direction: "in" | "out" | "both" | "none",
  seconds: number,
  duration = Infinity,
): Partial<Clip> {
  const value = Math.max(
    0,
    Math.min(seconds, duration / (direction === "both" ? 2 : 1)),
  );
  const incoming = direction === "in" || direction === "both" ? value : 0;
  const outgoing = direction === "out" || direction === "both" ? value : 0;
  return kind === "visual"
    ? { fadeIn: incoming, fadeOut: outgoing }
    : { audioFadeIn: incoming, audioFadeOut: outgoing };
}
export default function EffectsPanel({
  clip,
  project = { width: 1920, height: 1080 },
  kind,
  locked = false,
  onApply,
}: EffectsPanelProps) {
  const [tab, setTab] = useState<"color" | "fade" | "motion">("color");
  const [seconds, setSeconds] = useState(0.5);
  const [query, setQuery] = useState("");
  const active = COLOR_PRESETS.find((p) =>
    Object.entries(p.adjustments).every(
      ([key, value]) =>
        Math.abs(clip?.adjustments[key as keyof Adjustments]! - Number(value)) <
        0.001,
    ),
  );
  const disabled = !clip || locked;
  const colorDisabled = disabled || kind === "audio" || kind === "text";
  return (
    <section className="effects-panel" aria-label="Local effects library">
      <div className="effects-title">
        <Sparkles size={15} />
        <strong>Effects presets · 16</strong>
        <span>Processed locally</span>
      </div>
      <div className="effects-tabs" role="tablist" aria-label="Effect type">
        <button
          role="tab"
          aria-selected={tab === "color"}
          className={tab === "color" ? "is-active" : ""}
          onClick={() => setTab("color")}
        >
          <SlidersHorizontal size={13} /> Color presets
        </button>
        <button
          role="tab"
          aria-selected={tab === "motion"}
          className={tab === "motion" ? "is-active" : ""}
          onClick={() => setTab("motion")}
        >
          <Sparkles size={13} /> Motion effects
        </button>
        <button
          role="tab"
          aria-selected={tab === "fade"}
          className={tab === "fade" ? "is-active" : ""}
          onClick={() => setTab("fade")}
        >
          <Waves size={13} /> Fade in / out
        </button>
      </div>
      <div className="effects-content">
        <div className={`effects-selection ${disabled ? "is-empty" : ""}`}>
          <Film size={14} />
          <span>
            {clip
              ? `${clip.name}${locked ? " · Track is locked" : ""}`
              : "Select a clip on the timeline first"}
          </span>
          {clip && <ChevronRight size={12} />}
        </div>
        {tab === "motion" ? (
          <MotionLibrary
            disabled={disabled || kind === "audio"}
            onApply={(motion) => {
              if (clip) onApply(motionPatch(clip, motion, project));
            }}
          />
        ) : tab === "color" ? (
          <>
            <p className="effects-help">
              {kind === "audio"
                ? "Adjust audio fades in Fade In / Out."
                : kind === "text"
                  ? "Edit text styling in Properties. Set its on-screen fade in Fade In / Out."
                  : "Select a preset to apply it to the clip, then fine-tune it in Properties."}
            </p>
            <label className="creative-search">
              <input
                aria-label="Search color presets"
                placeholder="Search color presets"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="effects-grid">
              {COLOR_PRESETS.filter((p) =>
                (p.name + p.description).includes(query.trim()),
              ).map((preset) => (
                <article
                  className="creative-card"
                  key={preset.id}
                  data-preset-id={preset.id}
                >
                  <PresetPreview
                    adjustments={preset.adjustments}
                    label={preset.name}
                  />
                  <div>
                    <span>
                      {preset.name}
                      <small>{preset.description}</small>
                    </span>
                    <button
                      disabled={colorDisabled}
                      onClick={() => onApply(presetPatch(preset, clip))}
                      aria-label={`Apply ${preset.name} color`}
                      aria-pressed={!!clip && active?.id === preset.id}
                    >
                      <Check size={12} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <button
              className="effects-reset"
              disabled={colorDisabled}
              onClick={() =>
                onApply({ adjustments: { ...DEFAULT_ADJUSTMENTS } })
              }
            >
              <RotateCcw size={12} /> Reset color adjustments
            </button>
          </>
        ) : (
          <>
            <p className="effects-help">
              Add a smooth fade to either end of a clip. Video and audio can be set separately.
            </p>
            <label className="effects-duration">
              <span>Duration</span>
              <input
                aria-label="Fade duration"
                type="number"
                min="0.05"
                max="10"
                step="0.05"
                value={seconds}
                onChange={(event) => {
                  const n = Number(event.target.value);
                  if (Number.isFinite(n))
                    setSeconds(Math.max(0.05, Math.min(10, n)));
                }}
              />
              <span>sec</span>
            </label>
            {(["visual", "audio"] as const)
              .filter((channel) =>
                channel === "visual" ? kind !== "audio" : kind !== "text",
              )
              .map((kind) => (
                <div className="effects-fade-group" key={kind}>
                  <h3>
                    {kind === "visual" ? "Video" : "Audio"}
                    <span>
                      {clip
                        ? `${kind === "visual" ? clip.fadeIn.toFixed(2) : clip.audioFadeIn.toFixed(2)}s / ${kind === "visual" ? clip.fadeOut.toFixed(2) : clip.audioFadeOut.toFixed(2)}s`
                        : "In / out"}
                    </span>
                  </h3>
                  <div className="effects-fade-grid">
                    {(["in", "out", "both"] as const).map((direction) => (
                      <button
                        key={direction}
                        disabled={disabled}
                        onClick={() =>
                          onApply(
                            fadePatch(kind, direction, seconds, clip?.duration),
                          )
                        }
                      >
                        <span
                          className={`effects-fade-shape shape-${direction}`}
                        />
                        <span>
                          {direction === "in"
                            ? "Fade in"
                            : direction === "out"
                              ? "Fade out"
                              : "Fade in / out"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    className="effects-reset"
                    disabled={disabled}
                    onClick={() => onApply(fadePatch(kind, "none", 0))}
                  >
                    <RotateCcw size={11} /> Remove
                    {kind === "visual" ? "Video" : "Audio"} Fade in / out
                  </button>
                </div>
              ))}
            <p className="effects-note">
              Fade duration is limited by clip length. Fade-in and fade-out are each capped at half the clip.
            </p>
          </>
        )}
      </div>
      <div className="effects-footer">
        <Check size={11} /> Preview and export use the same settings
      </div>
    </section>
  );
}
