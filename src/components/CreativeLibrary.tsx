import { useState } from "react";
import { Plus, Search, Type } from "lucide-react";
import {
  MOTION_PRESETS,
  TEXT_PRESETS,
  TRANSITION_PRESETS,
  type MotionId,
  type TextPreset,
  type TransitionId,
} from "../core/creativePresets";
import PresetPreview from "./PresetPreview";
import "./CreativeLibrary.css";
function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <label className="creative-search">
      <Search size={14} />
      <input
        aria-label="Search presets"
        placeholder="Search by name or use"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Footer() {
  return (
    <footer className="creative-footer">Original work · MIT license · Available offline</footer>
  );
}
export function TextLibrary({
  onAdd,
  onBlank,
}: {
  onAdd: (preset: TextPreset) => void;
  onBlank: () => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All");
  const presets = TEXT_PRESETS.filter(
    (p) =>
      (category === "All" || category === p.category) &&
      (p.name + p.style.text)
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  return (
    <section className="creative-library" aria-label="Text templates">
      <header>
        <strong>
          Text templates <small>{TEXT_PRESETS.length}</small>
        </strong>
        <button onClick={onBlank}>
          <Type size={12} /> Add text
        </button>
      </header>
      <SearchBox value={query} onChange={setQuery} />
      <div className="creative-tabs" role="tablist" aria-label="Text template categories">
        {["All", "Title", "Captions", "Labels", "Motion"].map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="creative-scroll">
        <p className="creative-help">
          Add at the playhead. Text, font, outline, and animation are editable.
        </p>
        <div className="creative-grid">
          {presets.map((p) => (
            <article className="creative-card" key={p.id} data-preset-id={p.id}>
              <PresetPreview text={p} label={p.name} />
              <div>
                <span>
                  {p.name}
                  <small>{p.category} · Editable text</small>
                </span>
                <button
                  aria-label={`Add ${p.name} template`}
                  onClick={() => onAdd(p)}
                >
                  <Plus size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {!presets.length && (
          <p className="creative-empty">No matching text templates</p>
        )}
      </div>
      <Footer />
    </section>
  );
}
export function MotionLibrary({
  disabled,
  onApply,
}: {
  disabled: boolean;
  onApply: (motion: MotionId) => void;
}) {
  const [query, setQuery] = useState("");
  const presets = MOTION_PRESETS.filter((p) =>
    (p.name + p.description).includes(query.trim()),
  );
  return (
    <>
      <SearchBox value={query} onChange={setQuery} />
      <p className="creative-help">
        Apply to the selected video or text. Replaces keyframes for affected properties; other properties are kept. Undo is available.
      </p>
      <div className="creative-grid">
        {presets.map((p) => (
          <article className="creative-card" key={p.id} data-preset-id={p.id}>
            <PresetPreview motion={p.id} label={p.name} />
            <div>
              <span title={p.description}>
                {p.name}
                <small>Keyframe animation</small>
              </span>
              <button
                disabled={disabled}
                aria-label={`Apply ${p.name} effect`}
                onClick={() => onApply(p.id)}
              >
                <Plus size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!presets.length && <p className="creative-empty">No matching animations</p>}
    </>
  );
}
export function TransitionLibrary({
  disabled,
  onApply,
}: {
  disabled: boolean;
  onApply: (transition: TransitionId, seconds: number) => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [seconds, setSeconds] = useState(0.5);
  const presets = TRANSITION_PRESETS.filter(
    (p) =>
      (category === "All" || category === p.category) &&
      (p.name + p.description).includes(query.trim()),
  );
  return (
    <section className="creative-library" aria-label="Transition library">
      <header>
        <strong>
          Video transitions <small>{TRANSITION_PRESETS.length}</small>
        </strong>
        <span>Generated locally</span>
      </header>
      <SearchBox value={query} onChange={setQuery} />
      <div className="creative-tabs" role="tablist" aria-label="Transition categories">
        {["All", "Basic", "Camera movement", "Motion"].map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <label className="creative-duration">
        Transition duration
        <input
          type="number"
          aria-label="Transition duration"
          min={0.05}
          max={5}
          step={0.05}
          value={seconds}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (Number.isFinite(value))
              setSeconds(Math.max(0.05, Math.min(5, value)));
          }}
        />
        sec
      </label>
      <div className="creative-scroll">
        <p className="creative-help">
          Select the first of two adjacent clips on the same track. Duration is limited by frame rate and clip length; the second clip overlaps the first, except for “Through background.” Camera moves replace matching keyframes at the start of the second clip.
        </p>
        <div className="creative-grid">
          {presets.map((p) => (
            <article className="creative-card" key={p.id} data-preset-id={p.id}>
              <PresetPreview transition={p.id} label={p.name} />
              <div>
                <span title={p.description}>
                  {p.name}
                  <small>
                    {p.category} · {p.description}
                  </small>
                </span>
                <button
                  disabled={disabled}
                  className="transition-apply"
                  aria-label={`Apply ${p.name} transition`}
                  onClick={() => onApply(p.id, seconds)}
                >
                  <Plus size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {!presets.length && <p className="creative-empty">No matching transitions</p>}
      </div>
      <Footer />
    </section>
  );
}
