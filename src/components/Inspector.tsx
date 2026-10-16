import { useEffect, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Diamond,
  FlipHorizontal2,
  FlipVertical2,
  Image,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Type,
  Volume2,
  WandSparkles,
} from "lucide-react";
import type { Clip, Keyframe, Project } from "../core/types";
import { DEFAULT_TRANSFORM, DEFAULT_ADJUSTMENTS } from "../core/defaults";
import { evaluateKeyframes, formatTime, id } from "../core/model";
import VisualTools from "./VisualTools";
import "./Inspector.css";
import { useEditorStore } from "../editor/store";
interface Props {
  project: Project;
  clip?: Clip;
  playhead: number;
  onUpdate: (patch: Partial<Clip>) => void;
  onProjectUpdate: (patch: Partial<Project>) => void;
}
function NumberField({
  label,
  value,
  min = -100000,
  max = 100000,
  step = 1,
  onChange,
  suffix,
  diamond,
  range = false,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
  diamond?: () => void;
  range?: boolean;
}) {
  return (
    <label className="property-row">
      <span>{label}</span>
      {range && (
        <input
          className="property-range"
          aria-label={`${label} slider`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onPointerDown={() => useEditorStore.getState().beginTransaction()}
          onPointerUp={() => useEditorStore.getState().endTransaction()}
          onPointerCancel={() => useEditorStore.getState().endTransaction()}
          onKeyDown={() => useEditorStore.getState().beginTransaction()}
          onKeyUp={() => useEditorStore.getState().endTransaction()}
          onBlur={() => useEditorStore.getState().endTransaction()}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      )}
      <div className="numeric-field">
        <input
          aria-label={label}
          type="number"
          value={Number(value.toFixed(3))}
          min={min}
          max={max}
          step={step}
          onFocus={() => useEditorStore.getState().beginTransaction()}
          onBlur={() => useEditorStore.getState().endTransaction()}
          onChange={(e) => {
            if (e.target.value === "") return;
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
          }}
        />
        {suffix && <span>{suffix}</span>}
      </div>
      {diamond && (
        <button
          className="diamond-btn"
          title={`Add ${label} Keyframe`}
          onClick={(e) => {
            e.preventDefault();
            diamond();
          }}
        >
          <Diamond size={12} />
        </button>
      )}
    </label>
  );
}
function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="slider-property">
      <div>
        <label>{label}</label>
        <span>{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => useEditorStore.getState().beginTransaction()}
        onPointerUp={() => useEditorStore.getState().endTransaction()}
        onPointerCancel={() => useEditorStore.getState().endTransaction()}
        onKeyDown={() => useEditorStore.getState().beginTransaction()}
        onKeyUp={() => useEditorStore.getState().endTransaction()}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
export default function Inspector({
  project,
  clip,
  playhead,
  onUpdate,
  onProjectUpdate,
}: Props) {
  const [tab, setTab] = useState("Video"),
    [fonts, setFonts] = useState<string[]>([
      "Noto Sans SC",
      "sans-serif",
      "PingFang SC",
      "Arial",
      "Georgia",
    ]);
  useEffect(() => {
    void window.editorAPI
      ?.getFontFamilies()
      .then((fonts) => setFonts(fonts))
      .catch(() => {});
  }, []);
  useEffect(() => {
    setTab(
      clip?.text
        ? "Text"
        : project.assets.find((a) => a.id === clip?.assetId)?.kind === "audio"
          ? "Audio"
          : "Video",
    );
  }, [clip?.id, !!clip?.text]);
  if (!clip)
    return (
      <aside className="inspector panel">
        <div className="panel-heading">
          <span>Project settings</span>
          <SlidersHorizontal size={16} />
        </div>
        <div className="inspector-content">
          <h3>Canvas settings</h3>
          <label className="stacked-label">
            Project name
            <input
              value={project.name}
              onFocus={() => useEditorStore.getState().beginTransaction()}
              onBlur={() => useEditorStore.getState().endTransaction()}
              onChange={(e) => onProjectUpdate({ name: e.target.value })}
            />
          </label>
          <label className="property-row">
            <span>Aspect ratio</span>
            <select
              aria-label="Aspect ratio"
              value={`${project.width}:${project.height}`}
              onChange={(e) => {
                const [width, height] = e.target.value.split(":").map(Number);
                onProjectUpdate({ width, height });
              }}
            >
              {![
                "1920:1080",
                "1080:1920",
                "1080:1080",
                "1440:1080",
                "2560:1440",
                "3840:2160",
              ].includes(`${project.width}:${project.height}`) && (
                <option value={`${project.width}:${project.height}`}>
                  Custom
                </option>
              )}
              <option value="1920:1080">16:9 · Landscape</option>
              <option value="1080:1920">9:16 · Portrait</option>
              <option value="1080:1080">1:1 · Square</option>
              <option value="1440:1080">4:3 · Classic</option>
              <option value="2560:1440">16:9 · 2K</option>
              <option value="3840:2160">16:9 · 4K</option>
            </select>
          </label>
          <NumberField
            label="Width"
            value={project.width}
            min={16}
            max={7680}
            step={2}
            suffix="px"
            onChange={(width) => onProjectUpdate({ width })}
          />
          <NumberField
            label="Height"
            value={project.height}
            min={16}
            max={7680}
            step={2}
            suffix="px"
            onChange={(height) => onProjectUpdate({ height })}
          />
          <label className="property-row">
            <span>Frame rate</span>
            <select
              aria-label="Frame rate"
              value={project.fps}
              onChange={(e) => onProjectUpdate({ fps: Number(e.target.value) })}
            >
              {[24, 25, 30, 50, 60].map((fps) => (
                <option key={fps} value={fps}>
                  {fps} fps
                </option>
              ))}
            </select>
          </label>
          <label className="property-row">
            <span>Background color</span>
            <input
              aria-label="Background color"
              type="color"
              value={project.background}
              onChange={(e) => onProjectUpdate({ background: e.target.value })}
            />
            <code>{project.background}</code>
          </label>
          <div className="inspector-guide">
            <Image size={30} />
            <p>Select a timeline clip</p>
            <span>Adjust video, audio, text, and animation here</span>
          </div>
          <div className="offline-note">
            <span className="status-dot" />
            Media stays on your device. Projects work fully offline.
          </div>
        </div>
      </aside>
    );
  const track = project.tracks.find((t) => t.id === clip.trackId)!,
    asset = project.assets.find((a) => a.id === clip.assetId);
  const local = Math.max(0, Math.min(clip.duration, playhead - clip.start)),
    evaluated = evaluateKeyframes(clip, local),
    locked = track.locked;
  const key = (property: Keyframe["property"], value: number) => {
    const at = Math.min(
      clip.duration,
      Math.round(local * project.fps) / project.fps,
    );
    const existing = clip.keyframes.find(
      (k) =>
        k.property === property && Math.abs(k.time - at) < 0.5 / project.fps,
    );
    onUpdate({
      keyframes: existing
        ? clip.keyframes.filter((k) => k.id !== existing.id)
        : [
            ...clip.keyframes,
            { id: id(), property, time: at, value, easing: "linear" },
          ],
    });
  };
  const animate = (property: Keyframe["property"], value: number) => {
    if (clip.keyframes.some((k) => k.property === property)) {
      const at = Math.min(
          clip.duration,
          Math.round(local * project.fps) / project.fps,
        ),
        existing = clip.keyframes.find(
          (k) =>
            k.property === property &&
            Math.abs(k.time - at) < 0.5 / project.fps,
        );
      onUpdate({
        keyframes: existing
          ? clip.keyframes.map((k) =>
              k.id === existing.id ? { ...k, value } : k,
            )
          : [
              ...clip.keyframes,
              { id: id(), property, time: at, value, easing: "linear" },
            ],
      });
    } else if (property === "volume") onUpdate({ volume: value });
    else onUpdate({ transform: { ...clip.transform, [property]: value } });
  };
  const visual = asset?.kind !== "audio";
  const pictureTabs = ["Video", "Crop", "Chroma key", "Mask"];
  const pictureActive = pictureTabs.includes(tab);
  const tabs = clip.text
    ? ["Text", "Video", "Animation", "Speed"]
    : visual
      ? ["Video", "Audio", "Speed", "Animation", "Color"]
      : ["Audio", "Speed", "Animation"];
  const tabLabel = (value: string) =>
    value === "Speed" ? "Speed" : value === "Color" ? "Adjustments" : value;
  return (
    <aside className="inspector panel">
      <div className="inspector-tabs">
        <nav className="inspector-main-tabs" aria-label="Clip properties">
          {tabs.map((t) => (
            <button
              key={t}
              aria-label={t}
              aria-pressed={tab === t || (t === "Video" && pictureActive)}
              className={tab === t || (t === "Video" && pictureActive) ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {tabLabel(t)}
            </button>
          ))}
        </nav>
        {visual && !clip.text && (
          <nav className="inspector-picture-tabs" aria-label="Video tools" hidden={!pictureActive}>
            {pictureTabs.map((t) => (
              <button
                key={t}
                aria-label={t === "Video" ? "Basic video" : t}
                aria-pressed={tab === t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t === "Video" ? "Basic" : t}
              </button>
            ))}
          </nav>
        )}
      </div>
      <div className="inspector-content">
        <div className="clip-info">
          <strong>{clip.name}</strong>
          <span>
            {track.name} · {formatTime(clip.duration, project.fps)}
          </span>
        </div>
        {locked && (
          <div className="inline-warning">Track is locked. Unlock it to edit.</div>
        )}
        <fieldset disabled={locked}>
          {["Crop", "Chroma key", "Mask"].includes(tab) && (
            <VisualTools
              mode={
                tab === "Crop" ? "crop" : tab === "Chroma key" ? "chroma" : "mask"
              }
              clip={clip}
              asset={asset}
              onUpdate={onUpdate}
              locked={locked}
            />
          )}
          {tab === "Video" && (
            <>
              <div className="section-title">
                <h3>Position and size</h3>
                <button
                  title="Reset transform"
                  onClick={() =>
                    onUpdate({
                      transform: { ...DEFAULT_TRANSFORM },
                      keyframes: clip.keyframes.filter(
                        (k) => k.property === "volume",
                      ),
                    })
                  }
                >
                  <RotateCcw size={13} />
                </button>
              </div>
              <NumberField
                label="Scale"
                range
                value={evaluated.transform.scale * 100}
                min={1}
                max={1000}
                suffix="%"
                onChange={(v) => animate("scale", v / 100)}
                diamond={() => key("scale", evaluated.transform.scale)}
              />
              <div className="position-fields">
              <NumberField
                label="Position X"
                value={evaluated.transform.x}
                onChange={(v) => animate("x", v)}
                diamond={() => key("x", evaluated.transform.x)}
              />
              <NumberField
                label="Position Y"
                value={evaluated.transform.y}
                onChange={(v) => animate("y", v)}
                diamond={() => key("y", evaluated.transform.y)}
              />
              </div>
              <NumberField
                label="Rotation"
                value={evaluated.transform.rotation}
                min={-3600}
                max={3600}
                suffix="°"
                onChange={(v) => animate("rotation", v)}
                diamond={() => key("rotation", evaluated.transform.rotation)}
              />
              <NumberField
                label="Opacity"
                value={evaluated.transform.opacity * 100}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => animate("opacity", v / 100)}
                diamond={() => key("opacity", evaluated.transform.opacity)}
              />
              <div className="property-row">
                <span>Flip</span>
                <div className="segmented">
                  <button
                    className={clip.transform.flipX ? "active" : ""}
                    title="Flip horizontally"
                    onClick={() =>
                      onUpdate({
                        transform: {
                          ...clip.transform,
                          flipX: !clip.transform.flipX,
                        },
                      })
                    }
                  >
                    <FlipHorizontal2 size={17} />
                  </button>
                  <button
                    className={clip.transform.flipY ? "active" : ""}
                    title="Flip vertically"
                    onClick={() =>
                      onUpdate({
                        transform: {
                          ...clip.transform,
                          flipY: !clip.transform.flipY,
                        },
                      })
                    }
                  >
                    <FlipVertical2 size={17} />
                  </button>
                </div>
              </div>
              <h3>Video fade in / out</h3>
              <NumberField
                label="Video fade in"
                value={clip.fadeIn}
                min={0}
                max={clip.duration}
                step={0.1}
                suffix="s"
                onChange={(fadeIn) => onUpdate({ fadeIn })}
              />
              <NumberField
                label="VideoFade out"
                value={clip.fadeOut}
                min={0}
                max={clip.duration}
                step={0.1}
                suffix="s"
                onChange={(fadeOut) => onUpdate({ fadeOut })}
              />
            </>
          )}
          {tab === "Audio" && (
            <>
              <h3>Volume</h3>
              <NumberField
                label="Volume"
                value={evaluated.volume * 100}
                min={0}
                max={400}
                suffix="%"
                onChange={(v) => animate("volume", v / 100)}
                diamond={() => key("volume", evaluated.volume)}
              />
              <label className="toggle-property">
                <span>Mute clip</span>
                <input
                  aria-label="Mute clip"
                  type="checkbox"
                  checked={clip.muted}
                  onChange={(e) => onUpdate({ muted: e.target.checked })}
                />
              </label>
              <h3>Audio fade in / out</h3>
              <NumberField
                label="Audio fade in"
                value={clip.audioFadeIn}
                min={0}
                max={clip.duration}
                step={0.1}
                suffix="s"
                onChange={(audioFadeIn) => onUpdate({ audioFadeIn })}
              />
              <NumberField
                label="AudioFade out"
                value={clip.audioFadeOut}
                min={0}
                max={clip.duration}
                step={0.1}
                suffix="s"
                onChange={(audioFadeOut) => onUpdate({ audioFadeOut })}
              />
              {!asset?.hasAudio && (
                <p className="muted">This media has no audio stream.</p>
              )}
            </>
          )}
          {tab === "Color" && (
            <>
              <div className="section-title">
                <h3>Basic adjustments</h3>
                <button
                  title="Reset color adjustments"
                  onClick={() =>
                    onUpdate({ adjustments: { ...DEFAULT_ADJUSTMENTS } })
                  }
                >
                  <RotateCcw size={13} />
                </button>
              </div>
              <Slider
                label="Brightness"
                value={clip.adjustments.brightness}
                min={-1}
                max={1}
                onChange={(v) =>
                  onUpdate({
                    adjustments: { ...clip.adjustments, brightness: v },
                  })
                }
              />
              <Slider
                label="Contrast"
                value={clip.adjustments.contrast}
                min={0}
                max={3}
                onChange={(v) =>
                  onUpdate({
                    adjustments: { ...clip.adjustments, contrast: v },
                  })
                }
              />
              <Slider
                label="Saturation"
                value={clip.adjustments.saturation}
                min={0}
                max={3}
                onChange={(v) =>
                  onUpdate({
                    adjustments: { ...clip.adjustments, saturation: v },
                  })
                }
              />
              <Slider
                label="Temperature"
                value={clip.adjustments.temperature}
                min={-1}
                max={1}
                onChange={(v) =>
                  onUpdate({
                    adjustments: { ...clip.adjustments, temperature: v },
                  })
                }
              />
              <Slider
                label="Blur"
                value={clip.adjustments.blur}
                min={0}
                max={100}
                step={1}
                onChange={(v) =>
                  onUpdate({ adjustments: { ...clip.adjustments, blur: v } })
                }
              />
              <p className="field-hint">
                Preview and export use the same RGB
                adjustment model. Encoding and color conversion may cause slight differences.
              </p>
            </>
          )}
          {tab === "Text" && clip.text && (
            <>
              <h3>Text</h3>
              <textarea
                aria-label="Text"
                value={clip.text.text}
                rows={4}
                onFocus={() => useEditorStore.getState().beginTransaction()}
                onBlur={() => useEditorStore.getState().endTransaction()}
                onChange={(e) =>
                  onUpdate({
                    name: e.target.value.slice(0, 30) || "Text",
                    text: { ...clip.text!, text: e.target.value },
                  })
                }
              />
              <label className="property-row">
                <span>Font</span>
                <select
                  aria-label="Font"
                  value={clip.text.fontFamily}
                  onChange={(e) =>
                    onUpdate({
                      text: { ...clip.text!, fontFamily: e.target.value },
                    })
                  }
                >
                  <option value="sans-serif">System default</option>
                  {fonts
                    .filter((f) => f !== "sans-serif")
                    .map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                </select>
              </label>
              <NumberField
                label="Font size"
                value={clip.text.fontSize}
                min={1}
                max={1000}
                suffix="px"
                onChange={(fontSize) =>
                  onUpdate({ text: { ...clip.text!, fontSize } })
                }
              />
              <label className="property-row">
                <span>Text color</span>
                <input
                  aria-label="Text color"
                  type="color"
                  value={clip.text.color}
                  onChange={(e) =>
                    onUpdate({ text: { ...clip.text!, color: e.target.value } })
                  }
                />
                <button
                  className={clip.text.bold ? "active" : ""}
                  title="Bold"
                  onClick={() =>
                    onUpdate({
                      text: { ...clip.text!, bold: !clip.text!.bold },
                    })
                  }
                >
                  <b>B</b>
                </button>
              </label>
              <div className="property-row">
                <span>Alignment</span>
                <div className="segmented">
                  {(["left", "center", "right"] as const).map((align, i) => (
                    <button
                      key={align}
                      title={["Align left", "Center", "Align right"][i]}
                      className={clip.text!.align === align ? "active" : ""}
                      onClick={() =>
                        onUpdate({ text: { ...clip.text!, align } })
                      }
                    >
                      {i === 0 ? (
                        <AlignLeft size={16} />
                      ) : i === 1 ? (
                        <AlignCenter size={16} />
                      ) : (
                        <AlignRight size={16} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <h3>Outline and background</h3>
              <label className="property-row">
                <span>Outline color</span>
                <input
                  aria-label="Outline color"
                  type="color"
                  value={clip.text.stroke}
                  onChange={(e) =>
                    onUpdate({
                      text: { ...clip.text!, stroke: e.target.value },
                    })
                  }
                />
              </label>
              <NumberField
                label="Outline width"
                value={clip.text.strokeWidth}
                min={0}
                max={100}
                onChange={(strokeWidth) =>
                  onUpdate({ text: { ...clip.text!, strokeWidth } })
                }
              />
              <label className="toggle-property">
                <span>Text background</span>
                <input
                  type="checkbox"
                  aria-label="Text background"
                  checked={clip.text.background !== "transparent"}
                  onChange={(e) =>
                    onUpdate({
                      text: {
                        ...clip.text!,
                        background: e.target.checked
                          ? "#15151c"
                          : "transparent",
                      },
                    })
                  }
                />
              </label>
              {clip.text.background !== "transparent" && (
                <input
                  type="color"
                  aria-label="Text background color"
                  value={clip.text.background}
                  onChange={(e) =>
                    onUpdate({
                      text: { ...clip.text!, background: e.target.value },
                    })
                  }
                />
              )}
            </>
          )}
          {tab === "Speed" && (
            <>
              <h3>Standard speed</h3>
              <NumberField
                label="Playback speed"
                value={clip.speed}
                min={0.1}
                max={8}
                step={0.1}
                suffix="×"
                onChange={(speed) => onUpdate({ speed })}
              />
              <div className="speed-presets">
                {[0.25, 0.5, 1, 1.5, 2, 4].map((speed) => (
                  <button
                    key={speed}
                    className={clip.speed === speed ? "active" : ""}
                    onClick={() => onUpdate({ speed })}
                  >
                    {speed}×
                  </button>
                ))}
              </div>
              <p className="field-hint">
                Changing speed preserves the source range and adjusts clip duration. Audio pitch is preserved.
              </p>
              <h3>Time range</h3>
              <NumberField
                label="Start time"
                value={clip.start}
                min={0}
                step={1 / project.fps}
                suffix="s"
                onChange={(start) => onUpdate({ start })}
              />
              <NumberField
                label="Source media start"
                value={clip.sourceIn}
                min={0}
                max={Math.max(
                  0,
                  (asset?.duration ?? 0) - clip.duration * clip.speed,
                )}
                step={1 / project.fps}
                suffix="s"
                onChange={(sourceIn) => onUpdate({ sourceIn })}
              />
              <p className="muted small">
                Drag either edge of a clip on the timeline to trim its start or end.
              </p>
            </>
          )}
          {tab === "Animation" && (
            <>
              <h3>Keyframe</h3>
              <p className="field-hint">
                Move the playhead to the target time and click ◇ next to a property to add a keyframe. Future changes to that property are recorded at the current time.
              </p>
              <div className="keyframe-add">
                {(["x", "y", "scale", "rotation", "opacity", "volume"] as const)
                  .filter((property) => visual || property === "volume")
                  .map((property) => (
                    <button
                      key={property}
                      onClick={() =>
                        key(
                          property,
                          property === "volume"
                            ? evaluated.volume
                            : evaluated.transform[property],
                        )
                      }
                    >
                      <Diamond size={11} />
                      {
                        {
                          x: "Position X",
                          y: "Position Y",
                          scale: "Scale",
                          rotation: "Rotation",
                          opacity: "Opacity",
                          volume: "Volume",
                        }[property]
                      }
                    </button>
                  ))}
              </div>
              {!clip.keyframes.length && (
                <div className="quiet-empty">No keyframes yet</div>
              )}
              {[...clip.keyframes]
                .sort((a, b) => a.time - b.time)
                .map((k) => (
                  <div key={k.id} className="keyframe-row">
                    <button
                      className="keyframe-time"
                      onClick={() =>
                        useEditorStore.getState().seek(clip.start + k.time)
                      }
                    >
                      {formatTime(k.time, project.fps)}
                    </button>
                    <span>{k.property}</span>
                    <input
                      aria-label={`Keyframe ${k.property} value`}
                      type="number"
                      step={0.01}
                      value={k.value}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (
                          Number.isFinite(value) &&
                          !(
                            k.property === "opacity" &&
                            (value < 0 || value > 1)
                          ) &&
                          !(
                            k.property === "scale" &&
                            (value <= 0 || value > 10)
                          ) &&
                          !(k.property === "volume" && (value < 0 || value > 4))
                        )
                          onUpdate({
                            keyframes: clip.keyframes.map((key) =>
                              key.id === k.id ? { ...key, value } : key,
                            ),
                          });
                      }}
                    />
                    <select
                      aria-label="Keyframe interpolation"
                      value={k.easing}
                      onChange={(e) =>
                        onUpdate({
                          keyframes: clip.keyframes.map((key) =>
                            key.id === k.id
                              ? {
                                  ...key,
                                  easing: e.target.value as Keyframe["easing"],
                                  easingWindow: undefined,
                                }
                              : key,
                          ),
                        })
                      }
                    >
                      <option value="linear">Linear</option>
                      <option value="easeInOut">Ease in and out</option>
                    </select>
                    <button
                      aria-label="DeleteKeyframe"
                      onClick={() =>
                        onUpdate({
                          keyframes: clip.keyframes.filter(
                            (key) => key.id !== k.id,
                          ),
                        })
                      }
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
            </>
          )}
        </fieldset>
      </div>
    </aside>
  );
}
