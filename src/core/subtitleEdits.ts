import { clone, snapToFrame, trimClip, validateProject } from "./model";
import type { Clip, Project } from "./types";

export type SubtitleEdit =
  | { type: "cue"; text: string; start: number; end: number }
  | { type: "offset"; seconds: number }
  | { type: "replace"; find: string; replacement: string }
  | { type: "style"; referenceId: string };

export interface SubtitleEditPlan {
  base: string;
  project: Project;
  changedIds: string[];
}

function text(value: unknown, label: string, empty = true): asserts value is string {
  if (typeof value !== "string" || value.length > 20000 || value.includes("\0") || (!empty && !value.length))
    throw new Error(`${label} is invalid (maximum 20,000 characters).`);
}
function finite(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
}
function cue(project: Project, id: string, editable = true): Clip {
  const clip = project.clips.find(c => c.id === id);
  const track = project.tracks.find(t => t.id === clip?.trackId);
  if (!clip?.text || track?.kind !== "text") throw new Error("The selected caption does not exist or is not a text clip.");
  if (editable && track.locked) throw new Error(`Track “${track.name}” is locked. Unlock it first.`);
  return clip;
}

/** Prepare on a clone. Overlapping cues are legal; none of the targets may fail silently. */
export function prepareSubtitleEdit(input: Project, ids: readonly string[], edit: SubtitleEdit): SubtitleEditPlan {
  let project = validateProject(clone(input));
  if (!Array.isArray(ids) || !ids.length || ids.length > 10000 || new Set(ids).size !== ids.length)
    throw new Error("Select captions without duplicates.");
  const originals = ids.map(id => cue(project, id));
  if (new Set(originals.map(c => c.trackId)).size !== 1) throw new Error("Each batch operation can edit only one caption track.");
  if (!edit || typeof edit !== "object") throw new Error("Invalid caption operation.");
  if (edit.type === "cue") {
    if (ids.length !== 1) throw new Error("Select one caption to edit it individually.");
    text(edit.text, "Caption text"); finite(edit.start, "Start time"); finite(edit.end, "End time");
    if (edit.start < 0 || edit.end > 86400 || edit.end <= edit.start) throw new Error("Caption times must be between 0 and 86,400 seconds, and the end must follow the start.");
    const start = snapToFrame(edit.start, project.fps), end = snapToFrame(edit.end, project.fps);
    if (end - start < 1 / project.fps - 1e-9) throw new Error("A caption must last at least one frame.");
    const original = originals[0];
    const originalEnd = original.start + original.duration;
    if (Math.abs(end - start - original.duration) < 1e-9 || start >= originalEnd || end <= original.start) {
      // A translated or disjoint cue is a move, not a crop of its old absolute envelope.
      // Keep its local animation/fades so moving an animated caption does not make it disappear.
      original.start = start;
      project = trimClip(project, original.id, "end", end);
    } else {
      if (end > originalEnd) project = trimClip(project, original.id, "end", end);
      if (start < original.start) project = trimClip(project, original.id, "start", start);
      project = trimClip(project, original.id, "start", start);
      project = trimClip(project, original.id, "end", end);
    }
    const next = cue(project, original.id);
    if (Math.abs(next.start - start) > 1e-8 || Math.abs(next.start + next.duration - end) > 1e-8)
      throw new Error("Could not apply the selected caption times.");
    next.text!.text = edit.text;
    next.name = edit.text.slice(0, 4096);
  } else if (edit.type === "offset") {
    finite(edit.seconds, "Offset");
    if (Math.abs(edit.seconds) > 86400) throw new Error("The offset is out of range.");
    const delta = snapToFrame(edit.seconds, project.fps);
    for (const clip of originals) {
      const start = snapToFrame(clip.start + delta, project.fps);
      if (start < 0 || start + clip.duration > 86400) throw new Error("The offset would move captions outside the timeline. No captions were changed.");
      clip.start = start;
    }
  } else if (edit.type === "replace") {
    text(edit.find, "Find text", false); text(edit.replacement, "Replacement text");
    for (const clip of originals) {
      const pieces = clip.text!.text.split(edit.find);
      const size = clip.text!.text.length + (pieces.length - 1) * (edit.replacement.length - edit.find.length);
      if (size > 20000) throw new Error("The replacement captions are invalid (maximum 20,000 characters).");
      const value = pieces.join(edit.replacement);
      text(value, "Replacement caption text");
      clip.text!.text = value; clip.name = value.slice(0, 4096);
    }
  } else if (edit.type === "style") {
    const reference = cue(project, edit.referenceId, false);
    const { text: _content, ...style } = reference.text!;
    for (const clip of originals) clip.text = { ...clip.text!, ...clone(style) };
  } else throw new Error("Unsupported caption operation.");
  project = validateProject(project);
  return {
    base: JSON.stringify(input), project,
    changedIds: ids.filter(id => JSON.stringify(input.clips.find(c => c.id === id)) !== JSON.stringify(project.clips.find(c => c.id === id))),
  };
}

/** A user can keep an edit form open while the project changes elsewhere. Never overwrite it. */
export function applySubtitleEdit(current: Project, plan: SubtitleEditPlan): Project {
  if (JSON.stringify(current) !== plan.base) throw new Error("The project changed. Review the caption edits again before applying them.");
  return validateProject(clone(plan.project));
}
