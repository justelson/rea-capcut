import { useEffect, useRef, useState } from "react";
import type { ExportProgress, Project } from "../core/types";
import { FolderOpen, Package, X } from "lucide-react";
export default function PackageDialog({ project, onClose }: { project: Project; onClose(): void }) {
  const [progress, setProgress] = useState<ExportProgress | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const job = useRef<string | null>(null);
  const alive = useRef(true), requested = useRef(false);
  useEffect(() => {
    alive.current = true;
    const unsubscribe = window.editorAPI?.onPackageProgress(event => {
    if (!requested.current) return;
    if (job.current && job.current !== event.jobId) return;
    setProgress(event);
    if (["complete", "error", "cancelled"].includes(event.status)) { requested.current = false; setBusy(false); if (event.status === "error") setError(event.message ?? "Packaging failed"); }
    });
    return () => { alive.current = false; unsubscribe?.(); if (requested.current && job.current) void window.editorAPI?.cancelPackage(job.current); };
  }, []);
  const start = async () => {
    if (!window.editorAPI) { setError("Collecting project media requires the desktop app."); return; }
    if (requested.current) return;
    requested.current = true;
    setBusy(true); setError(""); setProgress(null); job.current = null;
    try {
      const result = await window.editorAPI.packageProject(project);
      if (!alive.current) { if (result) void window.editorAPI.cancelPackage(result.jobId); return; }
      if (result) { job.current = result.jobId; setProgress(current => current ?? { jobId: result.jobId, status: "preparing", progress: 0, message: "Checking media" }); }
      else { requested.current = false; setBusy(false); }
    }
    catch (e) { requested.current = false; if (alive.current) { setBusy(false); setError(String(e)); } }
  };
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Collect project media"><header><h2><Package size={18} /> Collect project media</h2><button aria-label="Close media packaging" disabled={busy} onClick={onClose}><X size={18} /></button></header><div className="modal-body"><h3>{project.name}</h3><p>Copy the project and {project.assets.length} source files to a new folder. Move the folder to keep editing elsewhere.</p><p className="muted small">Includes all media library items; shared files are copied once. The original project and media stay in place. Preview cache is excluded. Install custom system fonts on the destination computer.</p>{progress && <div className="export-progress"><p>{progress.status === "complete" ? "Media package complete" : progress.status === "cancelled" ? "Packaging canceled" : progress.message}</p><progress max={1} value={progress.progress} /><p>{Math.round(progress.progress * 100)}%</p></div>}{error && <p role="alert" className="inline-warning">{error}</p>}</div><footer>{busy ? <button disabled={!job.current} onClick={() => { if (job.current) void window.editorAPI?.cancelPackage(job.current); }}>Cancel packaging</button> : progress?.status === "complete" ? <><button onClick={() => void window.editorAPI?.revealPath(progress.path!)}><FolderOpen size={15}/> Show media package</button><button className="primary" onClick={onClose}>Done</button></> : <><button onClick={onClose}>Cancel</button><button className="primary" onClick={() => void start()}>Choose a folder and package</button></>}</footer></section></div>;
}
