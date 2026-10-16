import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  AudioLines,
  Check,
  FileImage,
  Film,
  FolderOpen,
  Grid2X2,
  Image,
  List,
  LoaderCircle,
  MoreHorizontal,
  Music2,
  Plus,
  Play,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { MediaAsset, MediaKind, Project } from "../core/types";
import { ASSET_DRAG_TYPE } from "./Timeline";
import "./MediaLibrary.css";

export interface MediaLibraryProps {
  project: Project;
  onImport: (paths?: string[]) => void;
  onAddAsset: (assetId: string) => void;
  onRemoveAsset: (assetId: string) => void;
  importing?: boolean;
  onImportFiles?: (files: File[]) => void;
  onRevealAsset?: (assetId: string) => void;
  onPreviewAsset?: (assetId: string) => void;
}
export function formatMediaDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
function KindIcon({ kind, size = 12 }: { kind: MediaKind; size?: number }) {
  return kind === "audio" ? (
    <Music2 size={size} />
  ) : kind === "image" ? (
    <Image size={size} />
  ) : (
    <Film size={size} />
  );
}

export default function MediaLibrary({
  project,
  onImport,
  onAddAsset,
  onRemoveAsset,
  importing = false,
  onImportFiles,
  onRevealAsset,
  onPreviewAsset,
}: MediaLibraryProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<MediaKind | "all">("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const dragCounter = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setSelected(null);
    setMenu(null);
    setQuery("");
  }, [project.id]);
  const filtered = project.assets.filter(
    (asset) =>
      (kind === "all" || asset.kind === kind) &&
      asset.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const startImport = () => {
    if (!window.editorAPI && onImportFiles) fileInput.current?.click();
    else onImport();
  };
  const receiveFiles = (files: File[]) => {
    if (!files.length) return;
    if (window.editorAPI) {
      const paths = files
        .map((file) => window.editorAPI!.getPathForFile(file))
        .filter(Boolean);
      if (paths.length) onImport(paths);
    } else onImportFiles?.(files);
  };
  const dropFiles = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = 0;
    setDraggingFiles(false);
    receiveFiles(Array.from(event.dataTransfer.files));
  };
  const item = (asset: MediaAsset) => {
    const inTimeline = project.clips.some((c) => c.assetId === asset.id);
    return (
      <div
        key={asset.id}
        data-asset-id={asset.id}
        role="button"
        tabIndex={0}
        aria-label={`${asset.name}, ${asset.kind === "audio" ? "Audio" : asset.kind === "image" ? "Image" : "Video"}${asset.missing ? ", file missing" : ""}`}
        aria-pressed={selected === asset.id}
        className={`media-item media-item-${asset.kind} ${selected === asset.id ? "is-selected" : ""} ${asset.missing ? "is-missing" : ""}`}
        draggable={!asset.missing}
        onDragStart={(event) => {
          event.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id);
          event.dataTransfer.setData(
            `application/x-reacut-kind-${asset.kind}`,
            asset.kind,
          );
          event.dataTransfer.effectAllowed = "copy";
          setSelected(asset.id);
          setMenu(null);
        }}
        onClick={(event) => {
          setSelected(asset.id);
          setMenu(null);
          if (!(event.target as HTMLElement).closest("button")) onPreviewAsset?.(asset.id);
        }}
        onDoubleClick={(event) => {
          if (
            !(event.target as HTMLElement).closest("button") &&
            !asset.missing
          )
            onAddAsset(asset.id);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setSelected(asset.id);
          setMenu(asset.id);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === " " && onPreviewAsset) {
            event.preventDefault();
            event.stopPropagation();
            setSelected(asset.id);
            onPreviewAsset(asset.id);
          }
          if (event.key === "Enter" && !asset.missing) {
            event.preventDefault();
            onAddAsset(asset.id);
          }
          if (event.key === "Delete") {
            event.preventDefault();
            onRemoveAsset(asset.id);
          }
        }}
      >
        <div className="media-preview">
          {asset.kind !== "audio" &&
          (asset.thumbnail || asset.kind === "image") ? (
            <img
              src={asset.thumbnail || asset.url}
              alt=""
              draggable={false}
              loading="lazy"
            />
          ) : (
            <div className="media-placeholder">
              {asset.kind === "audio" ? (
                <AudioLines size={27} />
              ) : (
                <Film size={27} />
              )}
            </div>
          )}
          {asset.kind === "audio" && asset.waveform && (
            <div className="media-audio-wave" aria-hidden="true">
              {Array.from({ length: 40 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    height: `${8 + (asset.waveform![Math.floor((i / 40) * asset.waveform!.length)] ?? 0.3) * 75}%`,
                  }}
                />
              ))}
            </div>
          )}
          <span className="media-kind">
            <KindIcon kind={asset.kind} />
          </span>
          <span className="media-time">
            {asset.kind === "image"
              ? "Image"
              : formatMediaDuration(asset.duration)}
          </span>
          {inTimeline && (
            <span className="media-used" title="Used on timeline">
              <Check size={10} />
            </span>
          )}
          {asset.missing && <span className="media-missing">File missing</span>}
          <button
            className="media-add"
            aria-label={`Add ${asset.name} to timeline`}
            title="Add at playhead · Double-click to preview"
            disabled={asset.missing}
            onClick={(event) => {
              event.stopPropagation();
              onAddAsset(asset.id);
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="media-info">
          <span className="media-name" title={asset.name}>
            {asset.name}
          </span>
          <span className="media-metadata">
            {asset.kind === "audio"
              ? "Audio"
              : `${asset.width} × ${asset.height}`}{" "}
            {asset.kind === "video" && asset.fps > 0
              ? `· ${Math.round(asset.fps * 100) / 100} fps`
              : ""}
          </span>
        </div>
        <button
          className="media-more"
          title="Media options"
          aria-label={`${asset.name} options`}
          aria-expanded={menu === asset.id}
          onClick={(event) => {
            event.stopPropagation();
            setMenu(menu === asset.id ? null : asset.id);
            setSelected(asset.id);
          }}
        >
          <MoreHorizontal size={15} />
        </button>
        {menu === asset.id && (
          <div
            className="media-context"
            onClick={(event) => event.stopPropagation()}
          >
            {onPreviewAsset && <button onClick={() => { onPreviewAsset(asset.id);setMenu(null); }}><Play size={13} /> Preview media</button>}
            <button
              disabled={asset.missing}
              onClick={() => {
                onAddAsset(asset.id);
                setMenu(null);
              }}
            >
              <Plus size={13} /> Add to timeline
            </button>
            {onRevealAsset && (
              <button
                onClick={() => {
                  onRevealAsset(asset.id);
                  setMenu(null);
                }}
              >
                <FolderOpen size={13} />{" "}
                {asset.missing ? "Relink media" : "Show in folder"}
              </button>
            )}
            <button
              className="media-context-remove"
              onClick={() => {
                onRemoveAsset(asset.id);
                setMenu(null);
                if (selected === asset.id) setSelected(null);
              }}
            >
              <Trash2 size={13} /> Remove from media library
            </button>
          </div>
        )}
      </div>
    );
  };
  return (
    <section
      className={`media-library ${draggingFiles ? "is-file-drop" : ""}`}
      aria-label="Local media library"
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          dragCounter.current++;
          setDraggingFiles(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          dragCounter.current--;
          if (dragCounter.current <= 0) setDraggingFiles(false);
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={dropFiles}
    >
      <input
        ref={fileInput}
        className="media-file-input"
        type="file"
        multiple
        accept="video/*,audio/*,image/*,.mkv,.mov,.mp4,.webm,.mp3,.wav,.aac,.flac,.m4a,.ogg"
        onChange={(event) => {
          receiveFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <div className="media-top">
        <div className="media-top-title">
          <FolderOpen size={15} />
          <span>Project media</span>
          <b>{project.assets.length}</b>
        </div>
        <button
          className="media-import"
          onClick={startImport}
          disabled={importing}
        >
          {importing ? (
            <LoaderCircle size={13} className="media-spin" />
          ) : (
            <Plus size={13} />
          )}{" "}
          {importing ? "Importing…" : "Import media"}
        </button>
      </div>
      <div className="media-tools">
        <div className="media-search">
          <Search size={13} />
          <input
            aria-label="Search media"
            placeholder="Search media"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={12} />
            </button>
          )}
        </div>
        <div className="media-view">
          <button
            title="Grid view"
            aria-label="Grid view"
            className={view === "grid" ? "is-active" : ""}
            onClick={() => setView("grid")}
          >
            <Grid2X2 size={14} />
          </button>
          <button
            title="List view"
            aria-label="List view"
            className={view === "list" ? "is-active" : ""}
            onClick={() => setView("list")}
          >
            <List size={15} />
          </button>
        </div>
      </div>
      <div className="media-filters" role="tablist" aria-label="Media type">
        {(["all", "video", "audio", "image"] as const).map((value) => (
          <button
            role="tab"
            aria-selected={kind === value}
            key={value}
            className={kind === value ? "is-active" : ""}
            onClick={() => setKind(value)}
          >
            {value === "all"
              ? "All"
              : value === "video"
                ? "Video"
                : value === "audio"
                  ? "Audio"
                  : "Image"}
            {value !== "all" && (
              <span>
                {project.assets.filter((a) => a.kind === value).length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div
        className={`media-content media-${view}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setMenu(null);
            setSelected(null);
          }
        }}
      >
        {filtered.length > 0 ? (
          filtered.map(item)
        ) : project.assets.length > 0 ? (
          <div className="media-empty">
            <Search size={26} />
            <strong>No matching media found</strong>
            <p>Try another search or media type</p>
            <button
              onClick={() => {
                setQuery("");
                setKind("all");
              }}
            >
              Show all media
            </button>
          </div>
        ) : (
          <div className="media-empty">
            <div className="media-empty-illustration">
              <Film size={31} />
              <Music2 size={18} />
              <FileImage size={19} />
            </div>
            <strong>Bring your ideas here</strong>
            <p>
              Import video, audio, and images
              <br />
              Or drag in local files
            </p>
            <button
              className="media-empty-import"
              onClick={startImport}
              disabled={importing}
            >
              <Upload size={13} /> {importing ? "Loading media…" : "Import media"}
            </button>
            <span>Supports MP4, MOV, MP3, PNG, and more</span>
          </div>
        )}
      </div>
      <div className="media-footer">
        <span>{filtered.length} items</span>
        <span>Double-click to add · Drag to timeline</span>
      </div>
      {draggingFiles && (
        <div className="media-drop-overlay">
          <Upload size={31} />
          <strong>Release to import media</strong>
          <span>Files stay on your device, ready to edit</span>
        </div>
      )}
    </section>
  );
}
