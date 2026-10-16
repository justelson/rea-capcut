import { version as appVersion } from "../package.json";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Check,
  CheckCircle2,
  ChevronDown,
  CloudOff,
  Download,
  FilePlus2,
  FolderOpen,
  Info,
  Keyboard,
  LoaderCircle,
  Monitor,
  Music2,
  MessageSquare,
  Shapes,
  Play,
  Save,
  Settings2,
  Sparkles,
  Subtitles,
  Type,
  Upload,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
import { useEditorStore } from "./editor/store";
import {
  clone,
  createProject,
  createTrack,
  formatTime,
  id,
  projectDuration,
} from "./core/model";
import type {
  CapcutImportSelection,
  Clip,
  ExportOptions,
  ExportProgress,
  MediaAsset,
  Project,
  RecentProject,
} from "./core/types";
import { parseSubtitles, stringifySubtitles } from "./core/subtitles";
import { importCapcutDraft } from "./core/capcutImport";
import SubtitlePanel from "./components/SubtitlePanel";
import PackageDialog from "./components/PackageDialog";
import { resolveExportRange, selectedClipRange } from "./core/exportRange";
import AssistantPanel from "./components/AssistantPanel";
import AssetLibrary from "./components/AssetLibrary";
import type { BuiltinAsset } from "./core/builtinAssets";
import MediaLibrary from "./components/MediaLibrary";
import SourcePreview from "./components/SourcePreview";
import EditorWorkspace from "./components/EditorWorkspace";
import Timeline from "./components/Timeline";
import EffectsPanel from "./components/EffectsPanel";
import { TextLibrary, TransitionLibrary } from "./components/CreativeLibrary";
import { addTextPreset, applyTransition, type TextPreset, type TransitionId } from "./core/creativePresets";
import Player from "./components/Player";
import Inspector from "./components/Inspector";
import "./styles.css";
import Titlebar from "./window/Titlebar";
import { shortcutLabel } from "./window/shortcuts";
type Modal = "package" | "export" | "settings" | "shortcuts" | "about" | "capcut" | null;
type PendingCapcutImport = {
  selection: CapcutImportSelection;
  capturedProject: Project;
};
const shortcuts = [
  ["Play / pause", "Space"],
  ["Split clip", "Ctrl + B"],
  ["Delete clip", "Delete / Backspace"],
  ["Undo / redo", "Ctrl + Z / Ctrl + Shift + Z"],
  ["Copy / paste", "Ctrl + C / Ctrl + V"],
  ["Duplicate clip", "Ctrl + D"],
  ["Select all clips", "Ctrl + A"],
  ["Previous / next frame", "← / →"],
  ["New / open / save", "Ctrl + N / Ctrl + O / Ctrl + S"],
  ["Import / export", "Ctrl + I / Ctrl + E"],
  ["Zoom timeline in / out", "+ / −"],
  ["Go to start / end", "Home / End"],
];
function ModalShell({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "modal-wide" : ""}`}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function ExportDialog({
  project,
  selectedIds,
  onClose,
  notify,
}: {
  project: Project;
  selectedIds: string[];
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [options, setOptions] = useState<ExportOptions>({
      path: "",
      width: project.width + (project.width % 2),
      height: project.height + (project.height % 2),
      fps: project.fps,
      quality: "standard",
      format: "mp4",
    }),
    [progress, setProgress] = useState<ExportProgress | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [scope, setScope] = useState("all");
  const [rangeStart, setRangeStart] = useState("0"), [rangeEnd, setRangeEnd] = useState(String(projectDuration(project)));
  const selectedRange = selectedClipRange(project, selectedIds);
  const rangeOptions = scope === "all" ? undefined : scope === "selected" ? selectedRange : { start: Number(rangeStart), end: Number(rangeEnd) };
  const exportDuration = rangeOptions ? Math.max(0, rangeOptions.end - rangeOptions.start) : projectDuration(project);
  const job = useRef<string | null>(null);
  const exporting =
    busy &&
    !["complete", "error", "cancelled"].includes(progress?.status ?? "");
  useEffect(
    () =>
      window.editorAPI?.onExportProgress((event) => {
        if (!job.current || event.jobId === job.current) {
          setProgress(event);
          if (["complete", "error", "cancelled"].includes(event.status)) {
            setBusy(false);
            if (event.status === "error") setError(event.message ?? "Export failed");
          }
        }
      }),
    [],
  );
  const choose = async () => {
    try {
      const path = await window.editorAPI?.chooseExportPath(
        project.name,
        options.format,
      );
      if (path) setOptions((p) => ({ ...p, path }));
    } catch (error) {
      setError(String(error));
    }
  };
  const exportVideo = async () => {
    if (!window.editorAPI) {
      setError("Video export requires the desktop app and local FFmpeg.");
      return;
    }
    try {
      setError("");
      if (scope === "selected" && !selectedRange) throw new Error("Select a timeline clip first.");
      if (scope === "custom" && (!rangeStart.trim() || !rangeEnd.trim())) throw new Error("Enter the range start and end.");
      resolveExportRange(project, { ...options, range: rangeOptions });
      let path = options.path;
      if (!path) {
        path =
          (await window.editorAPI.chooseExportPath(
            project.name,
            options.format,
          )) ?? "";
        if (!path) return;
        setOptions((p) => ({ ...p, path }));
      }
      job.current = null;
      setBusy(true);
      setProgress({ jobId: "", progress: 0, status: "preparing" });
      const result = await window.editorAPI.exportProject(clone(project), {
        ...options,
        range: rangeOptions,
        path,
      });
      job.current = result.jobId;
    } catch (error) {
      setBusy(false);
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  const status = progress?.status;
  return (
    <ModalShell
      title="Export video"
      onClose={() => {
        if (!exporting) onClose();
      }}
    >
      <div className="export-preview">
        <div>
          <Video size={28} />
          <strong>{project.name}</strong>
          <span>
            {formatTime(exportDuration, project.fps)} ·{" "}
            {project.clips.length} clips
          </span>
        </div>
        <span className="export-badge">Rendered locally</span>
      </div>
      <div className="modal-body">
        <label className="stacked-label">
          Save location
          <div className="file-picker">
            <input
              aria-label="Export location"
              readOnly
              value={options.path}
              placeholder="Choose where to save the video"
            />
            <button disabled={exporting} onClick={choose}>
              <FolderOpen size={16} />
            </button>
          </div>
        </label>
        <label className="stacked-label">Export range
          <select aria-label="Export range" value={scope} disabled={exporting} onChange={e => setScope(e.target.value)}>
            <option value="all">Full timeline</option><option value="selected" disabled={!selectedRange}>Range containing selected clips</option><option value="custom">Custom range</option>
          </select>
        </label>
        {scope === "custom" && <div className="export-fields"><label>Start (seconds)<input aria-label="Range start" type="number" min="0" step={1 / project.fps} disabled={exporting} value={rangeStart} onChange={e => setRangeStart(e.target.value)} /></label><label>End (seconds)<input aria-label="Range end" type="number" min="0" step={1 / project.fps} disabled={exporting} value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} /></label></div>}
        {scope === "selected" && selectedRange && <p className="field-hint">{selectedRange.start.toFixed(3)}–{selectedRange.end.toFixed(3)} sec, including all visible video and audio in this range.</p>}
        <div className="export-fields">
          <label>
            Resolution
            <select
              aria-label="Export resolution"
              disabled={exporting}
              value={`${options.width}:${options.height}`}
              onChange={(e) => {
                const [width, height] = e.target.value.split(":").map(Number);
                setOptions((p) => ({ ...p, width, height }));
              }}
            >
              <option
                value={`${project.width + (project.width % 2)}:${project.height + (project.height % 2)}`}
              >
                Original · {project.width}×{project.height}
              </option>
              {[720, 1080, 1440, 2160].map((height) => {
                const width =
                  Math.round((height * project.width) / project.height / 2) * 2;
                return (
                  <option key={height} value={`${width}:${height}`}>
                    {height}p · {width}×{height}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Frame rate
            <select
              aria-label="Export frame rate"
              value={options.fps}
              disabled={exporting}
              onChange={(e) =>
                setOptions((p) => ({ ...p, fps: Number(e.target.value) }))
              }
            >
              {[24, 25, 30, 50, 60].map((fps) => (
                <option key={fps}>{fps}</option>
              ))}
            </select>
          </label>
          <label>
            Quality
            <select
              aria-label="Export quality"
              disabled={exporting}
              value={options.quality}
              onChange={(e) =>
                setOptions((p) => ({
                  ...p,
                  quality: e.target.value as ExportOptions["quality"],
                }))
              }
            >
              <option value="draft">Draft · faster</option>
              <option value="standard">Standard · recommended</option>
              <option value="high">High quality</option>
            </select>
          </label>
          <label>
            Format
            <select
              aria-label="Export format"
              disabled={exporting}
              value={options.format}
              onChange={(e) => {
                job.current = null;
                setOptions((p) => ({
                  ...p,
                  format: e.target.value as "mp4" | "mov",
                  path: "",
                }));
              }}
            >
              <option value="mp4">MP4 · H.264 / AAC</option>
              <option value="mov">MOV · H.264 / AAC</option>
            </select>
          </label>
        </div>
        <p className="field-hint">
          Exports source media and all visible video tracks, with audio mixed according to your settings. No sign-in or upload required.
        </p>
        {progress && (
          <div
            className={`export-progress ${status === "complete" ? "is-complete" : ""}`}
          >
            <div>
              <span>
                {status === "complete"
                  ? "Export complete"
                  : status === "cancelled"
                    ? "Export canceled"
                    : status === "preparing"
                      ? "Preparing media"
                      : status === "error"
                        ? "Export failed"
                        : "Rendering video"}
              </span>
              <strong>{Math.round(progress.progress * 100)}%</strong>
            </div>
            <progress value={progress.progress} max={1} />
          </div>
        )}
        {error && (
          <div role="alert" className="inline-warning">
            {error}
          </div>
        )}
      </div>
      <footer>
        {exporting ? (
          <>
            <span className="muted">
              <LoaderCircle size={14} className="spin" />
              Editing will resume when local rendering finishes.
            </span>
            <button
              onClick={() => {
                if (job.current)
                  void window.editorAPI
                    ?.cancelExport(job.current)
                    .catch((error) => setError(String(error)));
              }}
            >
              Cancel export
            </button>
          </>
        ) : status === "complete" ? (
          <>
            <button
              onClick={() =>
                void window.editorAPI
                  ?.revealPath(progress?.path ?? options.path)
                  .catch((error) => notify(String(error)))
              }
            >
              <FolderOpen size={15} />
              Show in folder
            </button>
            <button className="primary" onClick={onClose}>
              <Check size={15} />
              Done
            </button>
          </>
        ) : (
          <>
            <button onClick={onClose}>Cancel</button>
            <button
              className="primary"
              onClick={exportVideo}
              disabled={!project.clips.length}
            >
              <Download size={16} />
              Start export
            </button>
          </>
        )}
      </footer>
    </ModalShell>
  );
}
async function browserAssets(files: File[]): Promise<MediaAsset[]> {
  const results: MediaAsset[] = [];
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const kind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("audio/")
        ? "audio"
        : "video";
    if (kind === "image") {
      const image = new Image();
      image.src = url;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Could not read ${file.name}`));
      });
      results.push({
        id: id(),
        name: file.name,
        path: file.name,
        url,
        kind,
        duration: 0,
        width: image.width,
        height: image.height,
        fps: 0,
        hasAudio: false,
        thumbnail: url,
      });
    } else {
      const element = document.createElement(kind);
      element.preload = "metadata";
      element.src = url;
      await new Promise<void>((resolve, reject) => {
        element.onloadedmetadata = () => resolve();
        element.onerror = () => reject(new Error(`Could not read ${file.name}`));
      });
      const video = element instanceof HTMLVideoElement ? element : null;
      results.push({
        id: id(),
        name: file.name,
        path: file.name,
        url,
        kind,
        duration: element.duration,
        width: video?.videoWidth ?? 0,
        height: video?.videoHeight ?? 0,
        fps: 30,
        hasAudio: true,
      });
      element.removeAttribute("src");
      element.load();
    }
  }
  return results;
}
export default function App() {
  const s = useEditorStore();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(null);
  const sourceAsset = s.project.assets.find(asset => asset.id === sourceAssetId);
  const [addingBuiltin, setAddingBuiltin] = useState<string | null>(null);
  const [tab, setTab] = useState("Media"),
    [modal, setModal] = useState<Modal>(null),
    [fileMenu, setFileMenu] = useState(false),
    [toast, setToast] = useState(""),
    [importing, setImporting] = useState(false),
    [system, setSystem] = useState<{
      ffmpeg: boolean;
      version?: string;
      ffmpegVersion?: string;
      ffmpegPath?: string;
    }>({ ffmpeg: false }),
    [recent, setRecent] = useState<RecentProject[]>([]),
    [recover, setRecover] = useState<Project | null>(null),
    [initialized, setInitialized] = useState(false);
  useEffect(() => { setSourceAssetId(null); }, [s.project.id, modal, s.selectedIds]);
  useEffect(() => { if (s.playing) setSourceAssetId(null); }, [s.playing]);
  const [timelineHeight, setTimelineHeight] = useState(() =>
    Math.max(220, Math.min(420, window.innerHeight * 0.34)),
  );
  const timelineResize = useRef<{ y: number; height: number } | null>(null);
  const resizeTimeline = (height: number) =>
    setTimelineHeight(
      Math.max(190, Math.min(window.innerHeight - 290, height)),
    );
  useEffect(() => {
    const clamp = () =>
      setTimelineHeight((height) =>
        Math.max(190, Math.min(window.innerHeight - 290, height)),
      );
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);
  const addBuiltin = async (definition: BuiltinAsset) => {
    if (!window.editorAPI) throw new Error("Adding built-in assets requires the desktop app");
    if (addingBuiltin) return;
    const projectId = useEditorStore.getState().project.id;
    setAddingBuiltin(definition.id);
    try {
      const imported = await window.editorAPI.importBuiltinAsset(definition.id);
      const state = useEditorStore.getState();
      if (state.project.id !== projectId) throw new Error("The project changed. Add the asset again");
      state.beginTransaction();
      try {
        state.addAssets([imported]);
        const latest = useEditorStore.getState();
        const asset = latest.project.assets.find(a => a.path === imported.path)!;
        const name = definition.category === "backgrounds" ? "Built-in background" : definition.kind === "audio" ? "Built-in sound effect" : "Built-in decoration";
        let track = latest.project.tracks.find(t => t.name === name && t.kind === definition.kind && !t.locked);
        if (!track) {
          track = createTrack(definition.kind, name);
          const tracks = [...latest.project.tracks];
          if (definition.category === "backgrounds" || definition.kind === "audio") tracks.push(track);
          else { const at = tracks.findIndex(t => t.kind !== "text"); tracks.splice(at < 0 ? tracks.length : at, 0, track); }
          latest.updateProject({ tracks });
        }
        latest.addAssetClip(asset.id, latest.playhead, track.id);
        const after = useEditorStore.getState();
        if (definition.category === "stickers" && after.selectedIds[0]) after.updateClip(after.selectedIds[0], { transform: { ...after.project.clips.find(c => c.id === after.selectedIds[0])!.transform, scale: .35 } });
      } finally { useEditorStore.getState().endTransaction(); }
    } finally { setAddingBuiltin(null); }
  };
  const saving = useRef(false);
  const [capcutImport, setCapcutImport] =
    useState<PendingCapcutImport | null>(null);
  const [capcutTimelineId, setCapcutTimelineId] = useState("");
  const [capcutBusy, setCapcutBusy] = useState(false);
  const capcutImportRef = useRef<PendingCapcutImport | null>(null);
  const capcutBusyRef = useRef(false);
  useEffect(
    () => () => {
      const token = capcutImportRef.current?.selection.token;
      if (token)
        void window.editorAPI?.discardCapcutProject(token).catch(() => {});
    },
    [],
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subtitleInput = useRef<HTMLInputElement>(null);
  const [subtitleAction, setSubtitleAction] = useState<"import" | "draft">(
    "import",
  );
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }, []);
  const safe = useCallback(
    async (action: () => unknown) => {
      try {
        await action();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        notify(message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ""));
      }
    },
    [notify],
  );
  const active = s.project.clips.find((c) => c.id === s.selectedIds[0]);
  const activeTrack = s.project.tracks.find((t) => t.id === active?.trackId);
  const refreshSystem = async () => {
    if (window.editorAPI) setSystem(await window.editorAPI.getSystemInfo());
  };
  useEffect(() => {
    void safe(async () => {
      await refreshSystem();
      if (window.editorAPI) {
        setRecent(await window.editorAPI.getRecentProjects());
        let startup;
        try {
          startup = await window.editorAPI.getStartupProject();
        } catch (error) {
          notify(
            `Could not open startup project: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        if (startup) {
          s.setProject(startup.project, startup.path);
          setInitialized(true);
          return;
        }
        const autosave = await window.editorAPI.getAutosave();
        if (autosave && (autosave.clips.length || autosave.assets.length))
          setRecover(autosave);
      }
      setInitialized(true);
    }).finally(() => setInitialized(true));
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    window.editorAPI?.setDirty(s.dirty);
  }, [s.dirty]);
  useEffect(() => {
    if (!initialized || recover || !window.editorAPI) return;
    const timer = setTimeout(() => {
      void window
        .editorAPI!.autosaveProject(s.project)
        .catch((error) => notify(`Autosave failed: ${String(error)}`));
    }, 1000);
    return () => clearTimeout(timer);
  }, [s.project, initialized, recover]);
  const confirmReplace = () =>
    !useEditorStore.getState().dirty ||
    window.confirm("This project has unsaved changes. Continuing will close it. Save first if needed.");
  const importMedia = async (paths?: string[]) => {
    if (!window.editorAPI) {
      notify("Drag files into the browser preview to import them. Use the desktop app for full file access.");
      return;
    }
    const projectId = useEditorStore.getState().project.id;
    setImporting(true);
    try {
      const assets = await window.editorAPI.importMedia(paths);
      if (useEditorStore.getState().project.id !== projectId) {
        notify("The project changed. Imported media was not added to the new project.");
        return;
      }
      s.addAssets(assets);
      if (assets.length) notify(`Imported ${assets.length} assets`);
    } finally {
      setImporting(false);
    }
  };
  const save = async (as = false) => {
    if (saving.current) {
      notify("Saving project. Please wait.");
      return false;
    }
    if (!window.editorAPI) {
      const blob = new Blob([JSON.stringify(s.project, null, 2)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = s.project.name + ".reacut";
      a.click();
      URL.revokeObjectURL(url);
      notify("Project JSON downloaded. Browser media links cannot be restored across sessions.");
      return false;
    }
    saving.current = true;
    try {
      const state = useEditorStore.getState(),
        captured = state.project,
        file = await window.editorAPI.saveProject(
          captured,
          as ? undefined : state.path,
        );
      if (!file) return false;
      setRecent(await window.editorAPI.getRecentProjects());
      const latest = useEditorStore.getState();
      if (latest.project.id !== captured.id) {
        notify("Original project snapshot saved.");
        return false;
      }
      const unchanged = latest.project === captured;
      if (unchanged) latest.markSaved(file);
      else useEditorStore.setState({ path: file, dirty: true });
      notify(unchanged ? "Project saved." : "Current snapshot saved. Later edits are still unsaved.");
      return unchanged;
    } finally {
      saving.current = false;
    }
  };
  const open = async () => {
    if (!confirmReplace()) return;
    if (!window.editorAPI) {
      notify("Opening local projects requires the desktop app.");
      return;
    }
    const result = await window.editorAPI.openProject();
    if (result) s.setProject(result.project, result.path);
  };
  const newProject = () => {
    if (confirmReplace()) s.setProject(createProject());
  };
  const handleAction = async (action: string) => {
    // Native menu accelerators bypass DOM key handlers; keep modal workflows intact.
    if ((modal || recover) && action !== "save-and-close") return;
    setFileMenu(false);
    switch (action) {
      case "new":
        newProject();
        break;
      case "open":
        await open();
        break;
      case "open-external":
        if (confirmReplace()) {
          const result = await window.editorAPI?.getStartupProject();
          if (result) s.setProject(result.project, result.path);
        }
        break;
      case "save":
        await save();
        break;
      case "save-as":
        await save(true);
        break;
      case "save-and-close":
        try {
          if (await save()) {
            window.editorAPI?.setDirty(false);
            window.editorAPI?.closeWindow();
          } else window.editorAPI?.cancelCloseRequest();
        } catch (error) {
          window.editorAPI?.cancelCloseRequest();
          throw error;
        }
        break;
      case "import":
        await importMedia();
        break;
      case "import-capcut-file":
        await importDraft("file");
        break;
      case "import-capcut-directory":
        await importDraft("directory");
        break;
      case "export":
        s.setPlaying(false);
        setModal("export");
        break;
      case "undo":
        s.undo();
        break;
      case "redo":
        s.redo();
        break;
      case "shortcuts":
        setModal("shortcuts");
        break;
      case "about":
        setModal("about");
        break;
    }
  };
  const actionRef = useRef(handleAction);
  actionRef.current = handleAction;
  useEffect(
    () =>
      window.editorAPI?.onMenuAction(
        (action) => void safe(() => actionRef.current(action)),
      ),
    [safe],
  );
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (modal === "capcut") {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelCapcutImport();
        }
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest("input,textarea,select,[contenteditable=true]"))
        return;
      if (modal || recover) {
        if (e.key === "Escape" && modal !== "export" && modal !== "package") {
          setModal(null);
        }
        return;
      }
      const state = useEditorStore.getState(),
        modifier = e.metaKey || e.ctrlKey;
      let handled = true;
      if (modifier) {
        switch (e.key.toLowerCase()) {
          case "n":
            void safe(() => actionRef.current("new"));
            break;
          case "o":
            void safe(() => actionRef.current("open"));
            break;
          case "s":
            void safe(() => actionRef.current(e.shiftKey ? "save-as" : "save"));
            break;
          case "i":
            void safe(() => actionRef.current("import"));
            break;
          case "e":
            void safe(() => actionRef.current("export"));
            break;
          case "b":
            state.split();
            break;
          case "d":
            state.duplicate();
            break;
          case "z":
            e.shiftKey ? state.redo() : state.undo();
            break;
          case "y":
            state.redo();
            break;
          case "c":
            state.copy();
            break;
          case "v":
            state.paste();
            break;
          case "a":
            state.select(state.project.clips.map((c) => c.id));
            break;
          default:
            handled = false;
        }
      } else
        switch (e.key) {
          case " ":
            if (state.playhead >= projectDuration(state.project)) state.seek(0);
            state.setPlaying(!state.playing && !!state.project.clips.length);
            break;
          case "Backspace":
          case "Delete":
            state.deleteSelected();
            break;
          case "ArrowLeft":
            state.seek(
              Math.max(
                0,
                state.playhead - (e.shiftKey ? 1 : 1 / state.project.fps),
              ),
            );
            break;
          case "ArrowRight":
            state.seek(
              Math.min(
                projectDuration(state.project),
                state.playhead + (e.shiftKey ? 1 : 1 / state.project.fps),
              ),
            );
            break;
          case "Home":
            state.seek(0);
            break;
          case "End":
            state.seek(projectDuration(state.project));
            break;
          case "+":
          case "=":
            state.setZoom(state.zoom * 1.25);
            break;
          case "-":
            state.setZoom(state.zoom / 1.25);
            break;
          case "Escape":
            state.select([]);
            setFileMenu(false);
            break;
          default:
            handled = false;
        }
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [modal, recover, safe]);
  const addStyledText = (preset: TextPreset) => {
    const result = addTextPreset(s.project, preset, s.playhead);
    s.commit(result.project);
    s.select([result.clip.id]);
    setTab("Text");
  };
  const readSubtitles = async () => {
    if (!window.editorAPI) {
      setSubtitleAction("import");
      subtitleInput.current?.click();
      return;
    }
    const result = await window.editorAPI.readTextFile(["srt", "vtt"]);
    if (!result) return;
    const cues = parseSubtitles(result.text);
    if (!cues.length) throw new Error("No valid SRT or VTT captions found.");
    s.addSubtitles(cues);
    notify(`Imported ${cues.length} captions`);
  };
  const exportSubtitles = async () => {
    const cues = s.project.clips
      .filter((c) => c.text)
      .sort((a, b) => a.start - b.start)
      .map((c) => ({
        start: c.start,
        end: c.start + c.duration,
        text: c.text!.text,
      }));
    if (!cues.length) throw new Error("The project has no text or captions.");
    const text = stringifySubtitles(cues);
    if (window.editorAPI)
      await window.editorAPI.writeTextFile(text, s.project.name + ".srt");
    else {
      const url = URL.createObjectURL(
          new Blob([text], { type: "text/plain;charset=utf-8" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = s.project.name + ".srt";
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  const cancelCapcutImport = () => {
    if (capcutBusyRef.current) return;
    const token = capcutImportRef.current?.selection.token;
    capcutImportRef.current = null;
    setCapcutImport(null);
    setModal(null);
    if (token)
      void window.editorAPI?.discardCapcutProject(token).catch(() => {});
  };
  const finishCapcutImport = async (
    pending: PendingCapcutImport,
    timelineId?: string,
  ) => {
    if (!window.editorAPI) return;
    capcutBusyRef.current = true;
    setCapcutBusy(true);
    try {
      const result = await window.editorAPI.readCapcutDraft(
        pending.selection.token,
        timelineId,
      );
      const imported = importCapcutDraft(result.text, { name: result.name });
      const loaded: MediaAsset[] = [];
      for (const asset of imported.project.assets) {
        try {
          const probed = (await window.editorAPI.importMedia([asset.path]))[0];
          if (!probed) throw new Error("Could not read the media file.");
          loaded.push({ ...asset, ...probed, id: asset.id, kind: asset.kind });
        } catch {
          loaded.push({
            ...asset,
            missing: true,
            url: `reacut-media://asset?path=${encodeURIComponent(asset.path)}`,
          });
        }
      }
      const latest = useEditorStore.getState();
      if (latest.project.id !== pending.capturedProject.id) {
        notify("The project changed. Re-import the CapCut draft into the current project.");
        return;
      }
      if (latest.project !== pending.capturedProject && !confirmReplace())
        return;
      imported.project.assets = loaded;
      s.setProject(imported.project);
      notify([...new Set([...result.warnings, ...imported.warnings])].join(" "));
    } finally {
      await window.editorAPI
        .discardCapcutProject(pending.selection.token)
        .catch(() => {});
      capcutImportRef.current = null;
      setCapcutImport(null);
      setModal((value) => (value === "capcut" ? null : value));
      capcutBusyRef.current = false;
      setCapcutBusy(false);
    }
  };
  const importDraft = async (mode: "file" | "directory" = "file") => {
    setFileMenu(false);
    if (capcutBusyRef.current || capcutImportRef.current) {
      notify("Finish importing the current CapCut project first.");
      return;
    }
    if (!window.editorAPI && mode === "directory") {
      notify("Importing a CapCut project folder requires the desktop app.");
      return;
    }
    if (!confirmReplace()) return;
    if (!window.editorAPI) {
      setSubtitleAction("draft");
      subtitleInput.current?.click();
      return;
    }
    const capturedProject = useEditorStore.getState().project;
    capcutBusyRef.current = true;
    setCapcutBusy(true);
    try {
      const selection = await window.editorAPI.chooseCapcutProject(mode);
      if (!selection) return;
      const pending = { selection, capturedProject };
      capcutImportRef.current = pending;
      if (selection.requiresTimelineChoice) {
        setCapcutImport(pending);
        setCapcutTimelineId(
          selection.recommendedTimelineId ?? selection.timelines[0]?.id ?? "",
        );
        setModal("capcut");
      } else {
        await finishCapcutImport(pending, selection.recommendedTimelineId);
      }
    } finally {
      capcutBusyRef.current = false;
      setCapcutBusy(false);
    }
  };
  const detachAudio = () => {
    if (!active || !active.assetId) return;
    const asset = s.project.assets.find((a) => a.id === active.assetId);
    if (!asset?.hasAudio || asset.kind === "audio")
      throw new Error("Select a video clip with audio.");
    if (activeTrack?.locked) throw new Error("Unlock the track first.");
    const audio = {
      ...asset,
      id: id(),
      kind: "audio" as const,
      name: asset.name + " · Audio",
      width: 0,
      height: 0,
      thumbnail: undefined,
      previewUrl: asset.previewUrl,
    };
    const track =
      s.project.tracks.find((t) => t.kind === "audio" && !t.locked) ??
      createTrack("audio", "Detached audio");
    const clip = {
      ...clone(active),
      id: id(),
      assetId: audio.id,
      trackId: track.id,
      name: audio.name,
      keyframes: active.keyframes
        .filter((k) => k.property === "volume")
        .map((k) => ({ ...k, id: id() })),
    };
    s.commit({
      ...s.project,
      assets: [...s.project.assets, audio],
      tracks: s.project.tracks.includes(track)
        ? s.project.tracks
        : [...s.project.tracks, track],
      clips: [
        ...s.project.clips.map((c) =>
          c.id === active.id ? { ...c, muted: true } : c,
        ),
        clip,
      ],
    });
    s.select([clip.id]);
    notify("Audio detached to its own track.");
  };
  const applySceneTransition = (transition: TransitionId, seconds: number) => {
    if (!active) throw new Error("Select a video clip.");
    const result = applyTransition(s.project, active.id, transition, seconds);
    s.commit(result.project);
    notify(transition === "dissolve"
      ? `Added ${result.duration.toFixed(2)} sec crossfade (the next clip overlaps early).`
      : `Added ${result.duration.toFixed(2)} sec transition. You can undo this.`);
  };
  return (
    <div
      className="app-shell"
      style={{
        gridTemplateRows: `44px minmax(180px,1fr) ${timelineHeight}px 26px`,
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        void safe(async () => {
          if (window.editorAPI)
            await importMedia(
              files
                .map((file) => window.editorAPI!.getPathForFile(file))
                .filter(Boolean),
            );
          else s.addAssets(await browserAssets(files));
        });
      }}
    >
      <Titlebar>
        <div className="brand">
          <span className="brand-icon">
            <img src="./icons/reacut.png" alt="" />
          </span>
          <strong>ReaCut</strong>
        </div>
        <div className="titlebar-menus">
          <div className="file-menu-container">
            <button
              aria-label="File menu"
              onClick={() => setFileMenu(!fileMenu)}
            >
              File
              <ChevronDown size={12} />
            </button>
            {fileMenu && (
              <div className="file-menu">
                {[
                  ["new", "New project", "⌘N"],
                  ["open", "Open project", "⌘O"],
                  ["save", "Save project", "⌘S"],
                  ["save-as", "Save as…", "⇧⌘S"],
                  ["import", "Import media", "⌘I"],
                  ["export", "Export video", "⌘E"],
                ].map(([action, label, shortcut]) => (
                  <button
                    key={action}
                    onClick={() => void safe(() => handleAction(action))}
                  >
                    {label}
                    <kbd>{shortcutLabel(shortcut)}</kbd>
                  </button>
                ))}
                <hr />
                <button onClick={() => { setFileMenu(false); setModal("package"); }}>Collect project media…</button>
                <button onClick={() => void safe(() => importDraft("file"))}>
                  Import CapCut draft<span>Experimental</span>
                </button>
                <button
                  onClick={() => void safe(() => importDraft("directory"))}
                >
                  Import CapCut project folder<span>Experimental</span>
                </button>
              </div>
            )}
          </div>
          <button onClick={() => setModal("shortcuts")}>Keyboard shortcuts</button>
        </div>
        <div className="project-title">
          <input
            aria-label="Project name"
            value={s.project.name}
            onFocus={() => s.beginTransaction()}
            onBlur={() => s.endTransaction()}
            onChange={(e) => s.updateProject({ name: e.target.value })}
          />
          <span
            title={s.dirty ? "Unsaved changes" : "Saved"}
            className={`save-dot ${s.dirty ? "dirty" : ""}`}
          />
        </div>
        <div className="titlebar-actions">
          <button aria-label="Editing assistant" className={assistantOpen ? "active" : ""} onClick={() => setAssistantOpen(!assistantOpen)}><MessageSquare size={15} /> Assistant</button>
          <span className="offline-pill">
            <CloudOff size={12} />
            Offline editing
          </span>
          <button
            title={shortcutLabel("Save project ⌘S")}
            aria-label="Save project"
            onClick={() => void safe(() => save())}
          >
            <Save size={16} />
          </button>
          <button
            title="Settings"
            aria-label="Settings"
            onClick={() => setModal("settings")}
          >
            <Settings2 size={16} />
          </button>
          <button
            className="primary export-button"
            onClick={() => {
              s.setPlaying(false);
              setModal("export");
            }}
          >
            <Upload size={15} />
            Export
          </button>
        </div>
      </Titlebar>
      <EditorWorkspace assistantOpen={assistantOpen}>
        <section className="resource-panel panel">
          <nav className="resource-tabs">
            {[
              ["Media", Video],
              ["Audio", Music2],
              ["Text", Type],
              ["Stickers", Shapes],
              ["Effects", WandSparkles],
              ["Transitions", Sparkles],
              ["Captions", Subtitles],
            ].map(([label, Icon]) => (
              <button
                key={label as string}
                className={tab === label ? "active" : ""}
                onClick={() => setTab(label as string)}
              >
                {typeof Icon !== "string" && <Icon size={19} />}
                <span>{label as string}</span>
              </button>
            ))}
          </nav>
          <div className="resource-body">
            {tab === "Stickers" && <AssetLibrary onAdd={addBuiltin} addingId={addingBuiltin} />}
            {(tab === "Media" || tab === "Audio") && (
              <MediaLibrary
                project={
                  tab === "Audio"
                    ? {
                        ...s.project,
                        assets: s.project.assets.filter(
                          (a) => a.kind === "audio",
                        ),
                      }
                    : s.project
                }
                onImport={(paths) => void safe(() => importMedia(paths))}
                onPreviewAsset={(assetId) => { s.setPlaying(false); setSourceAssetId(assetId); }}
                onAddAsset={(assetId) => { setSourceAssetId(null); s.addAssetClip(assetId); }}
                onRemoveAsset={(assetId) =>
                  void safe(() => s.removeAsset(assetId))
                }
                importing={importing}
                onImportFiles={(files) =>
                  void safe(async () => s.addAssets(await browserAssets(files)))
                }
                onRevealAsset={(assetId) =>
                  void safe(() => {
                    const asset = s.project.assets.find(
                      (a) => a.id === assetId,
                    );
                    if (asset?.missing) return relink(asset);
                    if (asset && window.editorAPI)
                      return window.editorAPI.revealPath(asset.path);
                  })
                }
              />
            )}
            {tab === "Text" && <TextLibrary onAdd={addStyledText} onBlank={s.addText} />}
            {tab === "Captions" && <SubtitlePanel onImport={() => safe(readSubtitles)} onExport={() => safe(exportSubtitles)} />}
            {tab === "Effects" && (
              <EffectsPanel
                clip={active}
                project={s.project}
                kind={activeTrack?.kind}
                locked={activeTrack?.locked}
                onApply={(patch) => {
                  if (active) s.updateClip(active.id, patch);
                  else notify("Select a timeline clip first.");
                }}
              />
            )}
            {tab === "Transitions" && <TransitionLibrary
              disabled={!active || !!active.text || activeTrack?.kind === "audio" || !!activeTrack?.locked}
              onApply={(transition,seconds)=>void safe(()=>applySceneTransition(transition,seconds))}
            />}
          </div>
        </section>
        {sourceAsset ? <SourcePreview
          asset={sourceAsset}
          fps={s.project.fps}
          onClose={() => setSourceAssetId(null)}
          onAddRange={(sourceIn, duration) => void safe(() => {
            s.addAssetClip(sourceAsset.id, s.playhead, undefined, { sourceIn, duration });
            setSourceAssetId(null);
          })}
        /> : <Player
          project={s.project}
          selectedIds={s.selectedIds}
          playhead={s.playhead}
          playing={s.playing}
          onSelect={s.select}
          onUpdateClip={s.updateClip}
          onSeek={s.seek}
          onPlayingChange={s.setPlaying}
        />}
        {assistantOpen ? <AssistantPanel onClose={() => setAssistantOpen(false)} /> : <Inspector
          project={s.project}
          clip={active}
          playhead={s.playhead}
          onUpdate={(patch) => active && s.updateClip(active.id, patch)}
          onProjectUpdate={s.updateProject}
        />}
      </EditorWorkspace>
      <div className="timeline-pane">
        <div
          className="timeline-resize"
          role="separator"
          tabIndex={0}
          aria-label="Adjust timeline height"
          aria-orientation="horizontal"
          aria-valuenow={Math.round(timelineHeight)}
          aria-valuemin={190}
          aria-valuemax={Math.max(190, window.innerHeight - 290)}
          title="Drag to adjust timeline height"
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              resizeTimeline(
                timelineHeight + (event.key === "ArrowUp" ? 20 : -20),
              );
            }
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            timelineResize.current = {
              y: event.clientY,
              height: timelineHeight,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = timelineResize.current;
            if (drag) resizeTimeline(drag.height + drag.y - event.clientY);
          }}
          onPointerUp={(event) => {
            timelineResize.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            timelineResize.current = null;
          }}
        />
        <Timeline
          project={s.project}
          selectedIds={s.selectedIds}
          playhead={s.playhead}
          playing={s.playing}
          zoom={s.zoom}
          onSeek={(time) => { setSourceAssetId(null); s.seek(time); }}
          onSelect={(ids) => { setSourceAssetId(null); s.select(ids); }}
          onClipUpdate={s.updateClip}
          onMoveClips={s.moveClips}
          onTrim={s.trim}
          onSplit={s.split}
          onDelete={s.deleteSelected}
          onZoom={s.setZoom}
          onTrackUpdate={s.updateTrack}
          onTrackDelete={s.deleteTrack}
          onTrackMove={s.reorderTrack}
          onAddTrack={s.addTrack}
          onDropAsset={(assetId, time, trackId) => {
            setSourceAssetId(null); s.addAssetClip(assetId, time, trackId);
          }}
          snapping={s.snapping}
          onSnappingChange={s.setSnapping}
          magnetic={s.magnetic}
          onMagneticChange={s.setMagnetic}
          onDuplicate={s.duplicate}
          onAddText={s.addText}
          onUndo={s.undo}
          onRedo={s.redo}
          canUndo={s.past.length > 0}
          canRedo={s.future.length > 0}
        />
      </div>
      <footer className="app-status">
        <span>
          <span className="status-dot" />{" "}
          {window.editorAPI ? "Desktop app" : "Browser preview"} ·{" "}
          {s.project.assets.length} assets · {s.project.clips.length} clips
        </span>
        <div>
          {active?.assetId &&
            s.project.assets.find((a) => a.id === active.assetId)?.hasAudio && (
              <button onClick={() => void safe(detachAudio)}>Detach audio</button>
            )}
          {s.project.assets.some((a) => a.missing) && (
            <button
              onClick={() =>
                void safe(() =>
                  relink(s.project.assets.find((a) => a.missing)!),
                )
              }
            >
              Relink missing media
            </button>
          )}
          <span>{s.dirty ? "Unsaved · Recovery is on" : "Project ready"}</span>
          <button title="Recent projects" onClick={() => setModal("settings")}>
            <FolderOpen size={12} />
          </button>
        </div>
      </footer>
      {toast && (
        <div role="status" className="toast">
          <Info size={16} />
          <span>{toast}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast("")}>
            <X size={13} />
          </button>
        </div>
      )}
      {modal === "package" && <PackageDialog project={clone(s.project)} onClose={() => setModal(null)} />}
      {modal === "export" && (
        <ExportDialog
          project={s.project}
          selectedIds={s.selectedIds}
          onClose={() => setModal(null)}
          notify={notify}
        />
      )}
      {modal === "capcut" && capcutImport && (
        <ModalShell title="Choose CapCut timeline" onClose={cancelCapcutImport}>
          <div className="modal-body">
            <p>
              <strong>{capcutImport.selection.name}</strong>{" "}
              contains multiple timelines. Choose what to import.
            </p>
            <label>
              Timeline
              <select
                aria-label="CapCut timeline"
                value={capcutTimelineId}
                disabled={capcutBusy}
                onChange={(event) => setCapcutTimelineId(event.target.value)}
              >
                {capcutImport.selection.timelines.map((timeline) => (
                  <option key={timeline.id} value={timeline.id}>
                    {timeline.name}
                    {timeline.isActive ? " · Currently editing" : ""}
                    {timeline.isMain ? " · Main timeline" : ""}
                  </option>
                ))}
              </select>
            </label>
            {capcutImport.selection.warnings.map((warning) => (
              <p className="muted" key={warning}>
                {warning}
              </p>
            ))}
            <p className="muted">Review the video, text, and effects after importing.</p>
          </div>
          <footer>
            <button disabled={capcutBusy} onClick={cancelCapcutImport}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={capcutBusy || !capcutTimelineId}
              onClick={() =>
                void safe(() =>
                  finishCapcutImport(capcutImport, capcutTimelineId),
                )
              }
            >
              {capcutBusy ? "Importing…" : "Import selected timeline"}
            </button>
          </footer>
        </ModalShell>
      )}
      {modal === "shortcuts" && (
        <ModalShell title="Keyboard shortcuts" onClose={() => setModal(null)}>
          <div className="shortcut-list">
            {shortcuts.map(([action, keys]) => (
              <div key={action}>
                <span>{action}</span>
                <kbd>{shortcutLabel(keys)}</kbd>
              </div>
            ))}
          </div>
          <footer>
            <span className="muted small">
              Shortcuts use Ctrl on Windows and Linux, or Cmd on macOS.
            </span>
            <button className="primary" onClick={() => setModal(null)}>
              Got it
            </button>
          </footer>
        </ModalShell>
      )}
      {modal === "about" && (
        <ModalShell title="About ReaCut" onClose={() => setModal(null)}>
          <div className="about-body">
            <div className="about-logo">
              <img src="./icons/reacut.png" width="58" height="58" alt="ReaCut icon" />
            </div>
            <h2>ReaCut</h2>
            <span>{appVersion} · Independent open-source desktop video editor</span>
            <p>
              ReaCut uses observations from REA research to build offline editing with independent code. The core source is licensed under MIT. The macOS package includes FFmpeg / FFprobe and x264 (GPL-2.0-or-later); source, build scripts, and license files are in the app's media-tools resources directory.
            </p>
            <p className="muted">
              ReaCut is not an official CapCut product and contains no CapCut proprietary code, libraries, or assets.
            </p>
          </div>
          <footer>
            <button className="primary" onClick={() => setModal(null)}>
              Close
            </button>
          </footer>
        </ModalShell>
      )}
      {modal === "settings" && (
        <ModalShell title="Settings and recent projects" onClose={() => setModal(null)}>
          <div className="modal-body">
            <h3>Local rendering engine</h3>
            <div className={`engine-status ${system.ffmpeg ? "ready" : ""}`}>
              {system.ffmpeg ? <CheckCircle2 size={18} /> : <Info size={18} />}
              <div>
                <strong>
                  {system.ffmpeg ? "FFmpeg is ready" : "FFmpeg / FFprobe not found"}
                </strong>
                <span>
                  {system.ffmpegVersion ??
                    "Check that the app is installed correctly, or choose custom FFmpeg / FFprobe paths here."}
                </span>
              </div>
            </div>
            <p className="muted small">
              {system.ffmpegPath ?? "The macOS package uses its built-in engine by default. No separate installation needed."}
            </p>
            <div className="button-row">
              <button
                onClick={() =>
                  void safe(async () => {
                    await window.editorAPI?.chooseMediaTool("ffmpeg");
                    await refreshSystem();
                  })
                }
              >
                Choose FFmpeg
              </button>
              <button
                onClick={() =>
                  void safe(async () => {
                    await window.editorAPI?.chooseMediaTool("ffprobe");
                    await refreshSystem();
                  })
                }
              >
                Choose FFprobe
              </button>
            </div>
            <h3>Recent projects</h3>
            {recent.length === 0 ? (
              <p className="muted small">Saved or opened projects will appear here.</p>
            ) : (
              <div className="recent-list">
                {recent.map((p) => (
                  <button
                    key={p.path}
                    onClick={() =>
                      void safe(async () => {
                        if (!confirmReplace()) return;
                        const result =
                          await window.editorAPI?.openRecentProject(p.path);
                        if (result) {
                          s.setProject(result.project, result.path);
                          setModal(null);
                        }
                      })
                    }
                  >
                    <FolderOpen size={16} />
                    <div>
                      <strong>{p.name}</strong>
                      <span>{p.path}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="future-feature">
              <CloudOff size={16} />
              <div>
                <strong>Cloud and API AI</strong>
                <p>Not available yet. This version edits projects locally only.</p>
              </div>
            </div>
          </div>
          <footer>
            <button onClick={() => setModal("about")}>About</button>
            <button className="primary" onClick={() => setModal(null)}>
              Done
            </button>
          </footer>
        </ModalShell>
      )}
      {recover && (
        <ModalShell
          title="Restore previous session"
          onClose={() => {
            setRecover(null);
          }}
        >
          <div className="modal-body">
            <p>
              Found the autosaved project <strong>{recover.name}</strong> on this device, with{" "}
              {recover.clips.length} clips.
            </p>
            <p className="muted">Continue editing after recovery, then save it as a project file.</p>
          </div>
          <footer>
            <button onClick={() => setRecover(null)}>Start a blank project</button>
            <button
              className="primary"
              onClick={() => {
                s.setProject(recover);
                setRecover(null);
                notify("Previous session restored.");
              }}
            >
              Restore project
            </button>
          </footer>
        </ModalShell>
      )}
      <input
        ref={subtitleInput}
        type="file"
        style={{ display: "none" }}
        accept={subtitleAction === "draft" ? ".json" : ".srt,.vtt"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void safe(async () => {
              const text = await file.text();
              if (subtitleAction === "draft") {
                const imported = importCapcutDraft(text);
                s.setProject(imported.project);
                notify(imported.warnings.join(" "));
              } else {
                const cues = parseSubtitles(text);
                if (!cues.length) throw new Error("The caption file contains no valid captions.");
                s.addSubtitles(cues);
              }
            });
          e.target.value = "";
        }}
      />
    </div>
  );
  async function relink(asset: MediaAsset) {
    if (!window.editorAPI) return;
    const projectId = useEditorStore.getState().project.id;
    const result = await window.editorAPI.relinkAsset(asset);
    if (!result) return;
    // A separated audio layer still references the same video source. Relink every
    // reference together, preserving its role and identity within the project.
    let source = result;
    if (
      result.kind === "audio" &&
      useEditorStore
        .getState()
        .project.assets.some((a) => a.path === asset.path && a.kind === "video")
    )
      source = (await window.editorAPI.importMedia([result.path]))[0] ?? result;
    const current = useEditorStore.getState();
    if (current.project.id !== projectId) return;
    if (current.project.assets.some((a) => a.id === asset.id))
      current.commit({
        ...current.project,
        assets: current.project.assets.map((a) =>
          a.path === asset.path
            ? {
                ...source,
                id: a.id,
                name: a.name,
                kind: a.kind,
                ...(a.kind === "audio"
                  ? { width: 0, height: 0, thumbnail: undefined }
                  : {}),
              }
            : a,
        ),
      });
  }
}
