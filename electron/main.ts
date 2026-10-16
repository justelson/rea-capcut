import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  protocol,
  shell,
} from "electron";
import { startPluginHost } from "./pluginHost";
import { windowChromeOptions } from "./windowChrome";
import { createReadStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { BUILTIN_ASSETS } from "../src/core/builtinAssets";
import { discoverAssistantProviders, startAssistantSession } from "./assistantBackend";
import type { AssistantMessage, AssistantProvider, AssistantRequest } from "../src/core/assistantTypes";
import {
  importAssets,
  mediaURL,
  systemMediaInfo,
  systemFontFamilies,
  shutdownMediaTasks,
  registerBundledFont,
} from "./media";
import { startExport, cancelExport, cancelAllExports } from "./export";
import { resolvePortableDocument, startPortablePackage, cancelPortablePackage, cancelPortablePackages, savePortableDocument } from "./portableProject";
import { setBundledMediaToolsDirectory } from "./mediaTools";
import { validateProject } from "../src/core/model";
import { decodeCapcutDraft } from "./capcutCodec";
import {
  discoverSelectedCapcutProject,
  readSelectedCapcutTimeline,
  type CapcutProjectIOPlan,
} from "./capcutProjectIO";
import type {
  CapcutImportSelection,
  MediaAsset,
  Project,
  RecentProject,
  ExportOptions,
} from "../src/core/types";

const pluginMode = process.argv.includes("--reacut-plugin");
const verifyUi = process.argv.includes("--verify-ui");
if (verifyUi) {
  if (!process.env.REACUT_USER_DATA) throw new Error("UI verification requires an isolated user profile.");
  app.commandLine.appendSwitch("mute-audio");
}
// A connected MCP server is a background app until its desktop window is shown.
if (pluginMode && process.platform === "darwin") app.setActivationPolicy("accessory");
if (pluginMode && !process.env.REACUT_USER_DATA)
  app.setPath("userData", path.join(app.getPath("appData"), "ReaCut-Plugin", "sessions", randomUUID()));
if (app.isPackaged && process.platform === "darwin")
  setBundledMediaToolsDirectory(path.join(process.resourcesPath, "media-tools"));
if (process.env.REACUT_USER_DATA)
  app.setPath("userData", path.resolve(process.env.REACUT_USER_DATA));
protocol.registerSchemesAsPrivileged([
  {
    scheme: "reacut-media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);
let window: BrowserWindow | null = null;
let assistantOverrides: Partial<Record<AssistantProvider, string>> = {};
let assistantRunning: { requestId: string; cancel: () => void; done: Promise<void> } | null = null;
let assistantStarting = false;
let assistantPendingId: string | null = null;
let assistantCancelPending = false;
let assistantStartDone: Promise<void> = Promise.resolve();
let assistantHistoryWrites = Promise.resolve();
function assistantHistoryFile(projectId: unknown): string {
  if (typeof projectId !== "string" || !projectId || projectId.length > 256) throw new Error("Invalid project ID");
  return userFile(`assistant/${createHash("sha256").update(projectId).digest("hex")}.json`);
}
function cleanAssistantMessages(value: unknown): AssistantMessage[] {
  if (!Array.isArray(value) || value.length > 60) throw new Error("Conversation history is too large");
  const messages = value.map(item => {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string" || item.content.length > 12000)
      throw new Error("Invalid conversation history format");
    return { role: item.role, content: item.content } as AssistantMessage;
  });
  if (JSON.stringify(messages).length > 250000) throw new Error("Conversation history is too large");
  return messages;
}
let pendingProject = process.argv.find(
  (argument) => path.isAbsolute(argument) && /\.reacut$/i.test(argument),
);
app.on("open-file", (event, file) => {
  event.preventDefault();
  pendingProject = file;
  if (window && !window.webContents.isLoading()) menuAction("open-external");
});
let dirty = false,
  closeAllowed = false,
  askingClose = false,
  quitRequested = false;
const allowedMedia = new Set<string>();
const recentPaths = new Set<string>();
const outputPaths = new Set<string>();
const savePaths = new Set<string>();
const portablePaths = new Set<string>();
const capcutSelections = new Map<
  string,
  { plan: CapcutProjectIOPlan; ownerId: number; expiresAt: number; reading: boolean }
>();
const pruneCapcutSelections = () => {
  for (const [token, selection] of capcutSelections)
    if (selection.expiresAt <= Date.now()) capcutSelections.delete(token);
};
function validateCapcutToken(token: unknown): asserts token is string {
  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(token)
  )
    throw new Error("Invalid CapCut project selection. Select the project again.");
}
const menuAction = (action: string) =>
  window?.webContents.send("menu-action", action);
const userFile = (name: string) => path.join(app.getPath("userData"), name);
const cacheDir = () => userFile("thumbnails");
let writeQueue = Promise.resolve();
async function atomicWrite(file: string, text: string) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, text, "utf8");
  await rename(temporary, file);
}
async function recent(): Promise<RecentProject[]> {
  try {
    const data = JSON.parse(await readFile(userFile("recent.json"), "utf8"));
    return Array.isArray(data)
      ? data
          .filter(
            (x: RecentProject) =>
              typeof x.path === "string" && typeof x.name === "string",
          )
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
}
async function remember(project: Project, file: string) {
  const entries = (await recent()).filter((p) => p.path !== file);
  await atomicWrite(
    userFile("recent.json"),
    JSON.stringify(
      [
        { path: file, name: project.name, updatedAt: new Date().toISOString() },
        ...entries,
      ].slice(0, 20),
    ),
  );
  recentPaths.add(file);
  savePaths.add(file);
}
function authorizeAsset(asset: MediaAsset) {
  allowedMedia.add(path.resolve(asset.path));
  for (const cachedURL of [asset.thumbnail, asset.previewUrl])
    if (cachedURL?.startsWith("reacut-media:")) {
      try {
        const thumbnail = new URL(cachedURL).searchParams.get("path");
        if (thumbnail && path.dirname(path.resolve(thumbnail)) === cacheDir())
          allowedMedia.add(path.resolve(thumbnail));
      } catch {
        /* optional */
      }
    }
}
async function hydrateProject(input: unknown): Promise<Project> {
  const p = validateProject(input);
  const refreshed = new Map<string, Promise<MediaAsset | undefined>>();
  p.assets = await Promise.all(
    p.assets.map(async (asset) => {
      const resolved = path.resolve(asset.path);
      let missing = false;
      try {
        await access(resolved);
      } catch {
        missing = true;
      }
      if (!missing && !refreshed.has(resolved))
        refreshed.set(
          resolved,
          importAssets([resolved], cacheDir())
            .then((assets) => assets[0])
            .catch(() => undefined),
        );
      const metadata = await refreshed.get(resolved);
      const hydrated: MediaAsset = {
        ...asset,
        ...(metadata ?? {}),
        id: asset.id,
        name: asset.name,
        kind: asset.kind,
        path: resolved,
        url: mediaURL(resolved),
        missing,
        previewUrl: metadata?.previewUrl,
        previewError: metadata?.previewError,
        thumbnail: metadata?.thumbnail,
      };
      if (asset.kind === "audio") {
        hydrated.width = 0;
        hydrated.height = 0;
        hydrated.thumbnail = undefined;
      }
      authorizeAsset(hydrated);
      return hydrated;
    }),
  );
  return p;
}
async function readProject(file: string) {
  const metadata = await stat(file);
  if (metadata.size > 30 * 1024 * 1024)
    throw new Error("Project file exceeds the 30 MB limit");
  const input = JSON.parse(await readFile(file, "utf8"));
  const project = await hydrateProject(await resolvePortableDocument(input, file));
  if (input?.format === "reacut-portable") portablePaths.add(path.resolve(file));
  return project;
}
function handle(name: string, callback: (...args: any[]) => unknown) {
  ipcMain.handle(name, (event, ...args) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw new Error("Invalid call origin");
    return callback(...args);
  });
}
function registerIPC() {
  handle("import-builtin-asset", async (id: unknown) => {
    const definition = BUILTIN_ASSETS.find(asset => asset.id === id);
    if (!definition) throw new Error("Built-in media not found");
    const source = app.isPackaged
      ? path.join(app.getAppPath().replace(/\.asar$/, ".asar.unpacked"), "dist/builtin-assets", definition.fileName)
      : path.join(__dirname, "../public/builtin-assets", definition.fileName);
    const bytes = await readFile(source);
    const directory = userFile("builtin-assets");
    await mkdir(directory, { recursive: true });
    const target = path.join(directory, `${definition.id}-${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}${path.extname(definition.fileName)}`);
    try { await access(target); } catch { await copyFile(source, target); }
    const [asset] = await importAssets([target], cacheDir());
    asset.name = definition.name; authorizeAsset(asset); return asset;
  });
  handle("assistant-providers", () => discoverAssistantProviders(assistantOverrides));
  handle("assistant-choose-cli", async (provider: AssistantProvider) => {
    if (provider !== "codex" && provider !== "claude") throw new Error("Invalid assistant type");
    const result = await dialog.showOpenDialog(window!, { title: `Select the ${provider === "codex" ? "Codex" : "Claude Code"} CLI`, properties: ["openFile"] });
    if (!result.canceled) {
      assistantOverrides[provider] = result.filePaths[0];
      await mkdir(path.dirname(userFile("assistant-clis.json")), { recursive: true });
      await writeFile(userFile("assistant-clis.json"), JSON.stringify(assistantOverrides), { mode: 0o600 });
    }
    return discoverAssistantProviders(assistantOverrides);
  });
  handle("assistant-start", async (request: AssistantRequest) => {
    if (assistantStarting || assistantRunning) throw new Error("The assistant is still processing the previous message");
    if (!request || typeof request.requestId !== "string" || !["codex", "claude"].includes(request.provider)) throw new Error("Invalid assistant request");
    assistantStarting = true;
    assistantPendingId = request.requestId; assistantCancelPending = false;
    let resolveStart!: () => void;
    assistantStartDone = new Promise<void>(resolve => { resolveStart = resolve; });
    const owner = window!.webContents;
    try {
      const running = await startAssistantSession(request, event => {
        if (!owner.isDestroyed()) owner.send("assistant-event", event);
      }, { executablePath: assistantOverrides[request.provider], sessionRoot: userFile("assistant-runs") });
      assistantRunning = { requestId: request.requestId, ...running };
      void running.done.finally(() => { if (assistantRunning?.requestId === request.requestId) assistantRunning = null; }).catch(() => {});
      if (owner.isDestroyed() || assistantCancelPending) running.cancel();
    } finally { assistantStarting = false; assistantPendingId = null; resolveStart(); }
  });
  handle("assistant-cancel", async (requestId: unknown) => {
    if (assistantPendingId === requestId) { assistantCancelPending = true; await assistantStartDone; }
    const running = assistantRunning;
    if (running && running.requestId === requestId) { running.cancel(); await running.done; }
  });
  handle("assistant-history", async (projectId: unknown) => {
    const file = assistantHistoryFile(projectId);
    await assistantHistoryWrites.catch(() => {});
    try {
      if ((await stat(file)).size > 1024 * 1024) throw new Error("Conversation history is too large");
      return cleanAssistantMessages(JSON.parse(await readFile(file, "utf8")));
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  });
  handle("assistant-save-history", async (projectId: unknown, input: unknown) => {
    const file = assistantHistoryFile(projectId), messages = cleanAssistantMessages(input);
    assistantHistoryWrites = assistantHistoryWrites.catch(() => {}).then(async () => {
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.tmp`;
      await writeFile(temporary, JSON.stringify(messages), { mode: 0o600 });
      await rename(temporary, file);
    });
    await assistantHistoryWrites;
  });
  handle("import-media", async (paths?: string[]) => {
    let selected = paths;
    if (!selected) {
      const result = await dialog.showOpenDialog(window!, {
        title: "Import Media",
        properties: ["openFile", "multiSelections"],
        filters: [
          {
            name: "Media Files",
            extensions: [
              "mp4",
              "mov",
              "mkv",
              "webm",
              "m4v",
              "avi",
              "mp3",
              "wav",
              "m4a",
              "aac",
              "ogg",
              "flac",
              "png",
              "jpg",
              "jpeg",
              "webp",
              "bmp",
              "avif",
              "heic",
            ],
          },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (result.canceled) return [];
      selected = result.filePaths;
    }
    if (
      !Array.isArray(selected) ||
      selected.length > 100 ||
      selected.some((p) => typeof p !== "string" || !path.isAbsolute(p))
    )
      throw new Error("Provide absolute paths for up to 100 local media files");
    const assets = await importAssets(selected, cacheDir());
    assets.forEach(authorizeAsset);
    return assets;
  });
  handle("relink-asset", async (asset: MediaAsset) => {
    const result = await dialog.showOpenDialog(window!, {
      title: `Relink ${asset.name}`,
      properties: ["openFile"],
    });
    if (result.canceled) return null;
    const imported = (await importAssets(result.filePaths, cacheDir()))[0];
    if (
      !imported ||
      (imported.kind !== asset.kind &&
        !(asset.kind === "audio" && imported.hasAudio))
    )
      throw new Error("The new media type does not match the original");
    authorizeAsset(imported);
    return {
      ...imported,
      id: asset.id,
      ...(asset.kind === "audio"
        ? { kind: "audio", width: 0, height: 0, thumbnail: undefined }
        : {}),
    };
  });
  handle("get-startup-project", async () => {
    if (!pendingProject) return null;
    const file = pendingProject;
    pendingProject = undefined;
    const project = await readProject(file);
    await remember(project, file);
    return { project, path: file };
  });
  handle("open-project", async () => {
    const result = await dialog.showOpenDialog(window!, {
      title: "Open ReaCut Project",
      properties: ["openFile"],
      filters: [{ name: "ReaCut Project", extensions: ["reacut", "json"] }],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0],
      project = await readProject(file);
    await remember(project, file);
    return { project, path: file };
  });
  handle("open-recent-project", async (file: string) => {
    if (!recentPaths.has(file)) throw new Error("Project is not in the recent files list");
    const project = await readProject(file);
    await remember(project, file);
    return { project, path: file };
  });
  handle("get-recent-projects", async () => {
    const entries = await recent();
    entries.forEach((e) => recentPaths.add(e.path));
    return entries;
  });
  handle("save-project", async (input: unknown, file?: string) => {
    const project = validateProject(input);
    if (file && !savePaths.has(file)) throw new Error("Project save location was not selected");
    if (!file) {
      const result = await dialog.showSaveDialog(window!, {
        title: "Save Project",
        defaultPath: project.name + ".reacut",
        filters: [{ name: "ReaCut Project", extensions: ["reacut"] }],
      });
      if (result.canceled || !result.filePath) return null;
      file = result.filePath;
      savePaths.add(file);
    }
    if (portablePaths.has(path.resolve(file))) {
      for (const asset of project.assets) if (!allowedMedia.has(path.resolve(asset.path))) throw new Error("Project references media that has not been imported");
      await savePortableDocument(project, file);
    } else await atomicWrite(file, JSON.stringify(project, null, 2));
    await remember(project, file);
    return file;
  });
  handle("package-project", async (input: unknown) => {
    const project = validateProject(input), owner = window!.webContents;
    for (const asset of project.assets) if (!allowedMedia.has(path.resolve(asset.path))) throw new Error("Project references media that has not been imported");
    const selected = await dialog.showOpenDialog(window!, { title: "Choose a folder for the media package", properties: ["openDirectory", "createDirectory"] });
    if (selected.canceled || !selected.filePaths[0] || owner.isDestroyed()) return null;
    return startPortablePackage(project, selected.filePaths[0], event => {
      if (event.status === "complete" && event.path) outputPaths.add(event.path);
      if (!owner.isDestroyed()) owner.send("package-progress", event);
    });
  });
  handle("cancel-package", (jobId: string) => cancelPortablePackage(jobId));
  handle("autosave-project", (input: unknown) => {
    const project = validateProject(input);
    const serialized = JSON.stringify(project);
    writeQueue = writeQueue
      .catch(() => {})
      .then(() => atomicWrite(userFile("autosave.reacut"), serialized));
    return writeQueue;
  });
  handle("get-autosave", async () => {
    try {
      return await readProject(userFile("autosave.reacut"));
    } catch {
      return null;
    }
  });
  handle("choose-export-path", async (name: string, format: string) => {
    if (!["mp4", "mov"].includes(format)) throw new Error("Invalid export format");
    const result = await dialog.showSaveDialog(window!, {
      title: "Export Video",
      defaultPath: name + "." + format,
      filters: [{ name: format.toUpperCase() + " Video", extensions: [format] }],
    });
    if (result.canceled || !result.filePath) return null;
    outputPaths.add(result.filePath);
    return result.filePath;
  });
  handle("export-project", async (input: unknown, options: ExportOptions) => {
    const project = validateProject(input);
    if (!outputPaths.has(options.path)) throw new Error("Choose an export location first");
    for (const asset of project.assets)
      if (!allowedMedia.has(path.resolve(asset.path)))
        throw new Error("Export references media that has not been imported");
    return startExport(project, options, (event) =>
      window?.webContents.send("export-progress", event),
    );
  });
  handle("cancel-export", (jobId: string) => cancelExport(jobId));
  handle("font-families", () => systemFontFamilies());
  handle("system-info", async () => ({
    version: app.getVersion(),
    platform: process.platform,
    ...(await systemMediaInfo()),
  }));
  handle("read-text-file", async (extensions: string[]) => {
    if (
      !Array.isArray(extensions) ||
      extensions.some((e) => !/^[a-z0-9]+$/i.test(e))
    )
      throw new Error("Invalid file type");
    const result = await dialog.showOpenDialog(window!, {
      properties: ["openFile"],
      filters: [{ name: "Text Files", extensions }],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    if ((await stat(file)).size > 20 * 1024 * 1024)
      throw new Error("File exceeds the 20 MB limit");
    return { text: await readFile(file, "utf8"), name: path.basename(file) };
  });
  handle("choose-capcut-project", async (mode: "file" | "directory") => {
    if (mode !== "file" && mode !== "directory")
      throw new Error("Select a draft file or project folder");
    const owner = window!;
    const result = await dialog.showOpenDialog(owner, {
      title: mode === "file" ? "Select a CapCut draft file" : "Select a CapCut project folder",
      properties: [mode === "file" ? "openFile" : "openDirectory"],
      ...(mode === "file"
        ? { filters: [{ name: "CapCut Draft", extensions: ["json"] }] }
        : {}),
    });
    if (result.canceled || !result.filePaths[0]) return null;
    if (owner !== window || owner.isDestroyed()) return null;
    const plan = await discoverSelectedCapcutProject(result.filePaths[0], mode);
    if (owner !== window || owner.isDestroyed()) return null;
    pruneCapcutSelections();
    while (capcutSelections.size >= 8)
      capcutSelections.delete(capcutSelections.keys().next().value!);
    const token = randomUUID();
    capcutSelections.set(token, {
      plan,
      ownerId: owner.webContents.id,
      expiresAt: Date.now() + 10 * 60 * 1000,
      reading: false,
    });
    const selection: CapcutImportSelection = {
      token,
      name: path.basename(plan.selection.projectDirectory),
      timelines: plan.timelines.map(({ id, name, isMain, isActive }) => ({
        id,
        name,
        isMain,
        isActive,
      })),
      recommendedTimelineId: plan.recommendedTimelineId,
      requiresTimelineChoice: plan.requiresTimelineChoice,
      warnings: plan.warnings,
    };
    return selection;
  });
  handle("read-capcut-draft", async (token: unknown, timelineId?: unknown) => {
    validateCapcutToken(token);
    pruneCapcutSelections();
    const selection = capcutSelections.get(token);
    if (!selection || selection.ownerId !== window!.webContents.id)
      throw new Error("CapCut project selection expired. Select the project again.");
    if (selection.reading) throw new Error("The selected timeline is still loading. Please wait.");
    if (
      timelineId !== undefined &&
      (typeof timelineId !== "string" ||
        !selection.plan.timelines.some((choice) => choice.id === timelineId))
    )
      throw new Error("Select a timeline in the project");
    selection.reading = true;
    try {
      const result = await readSelectedCapcutTimeline(
        selection.plan,
        timelineId as string | undefined,
      );
      const decoded = decodeCapcutDraft(result.text);
      capcutSelections.delete(token);
      return {
        text: decoded.text,
        name: result.name,
        warnings: selection.plan.warnings,
      };
    } finally {
      selection.reading = false;
    }
  });
  handle("discard-capcut-project", (token: unknown) => {
    validateCapcutToken(token);
    const selection = capcutSelections.get(token);
    if (selection?.ownerId === window!.webContents.id)
      capcutSelections.delete(token);
  });
  handle("write-text-file", async (text: string, name: string) => {
    if (typeof text !== "string" || text.length > 20 * 1024 * 1024)
      throw new Error("Text is invalid or too long");
    const result = await dialog.showSaveDialog(window!, {
      defaultPath: path.basename(name),
    });
    if (result.canceled || !result.filePath) return null;
    await atomicWrite(result.filePath, text);
    return result.filePath;
  });
  handle("reveal-path", (file: string) => {
    if (
      !allowedMedia.has(file) &&
      !savePaths.has(file) &&
      !outputPaths.has(file)
    )
      throw new Error("File location is not authorized");
    shell.showItemInFolder(file);
  });
  handle("choose-media-tool", async (name: string) => {
    if (!["ffmpeg", "ffprobe"].includes(name)) throw new Error("Invalid tool name");
    const result = await dialog.showOpenDialog(window!, {
      title: `Select the ${name} executable`,
      properties: ["openFile"],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    process.env[name === "ffmpeg" ? "REACUT_FFMPEG" : "REACUT_FFPROBE"] = file;
    const settings = {
      ffmpeg: process.env.REACUT_FFMPEG,
      ffprobe: process.env.REACUT_FFPROBE,
    };
    await atomicWrite(userFile("media-tools.json"), JSON.stringify(settings));
    return file;
  });
  ipcMain.on("set-dirty", (event, value) => {
    if (event.sender === window?.webContents) dirty = Boolean(value);
  });
  ipcMain.on("cancel-close-request", (event) => {
    if (event.sender === window?.webContents) quitRequested = false;
  });
  ipcMain.on("close-window", (event) => {
    if (event.sender === window?.webContents && !dirty) {
      closeAllowed = true;
      if (quitRequested) app.quit();
      else window?.close();
    }
  });
}
async function serveMedia(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url),
      supplied = url.searchParams.get("path");
    if (url.hostname !== "asset" || !supplied)
      return new Response("Invalid media URL", { status: 400 });
    const file = path.resolve(supplied);
    if (!allowedMedia.has(file))
      return new Response("Media was not imported", { status: 403 });
    const metadata = await stat(file);
    if (!metadata.isFile()) return new Response("Not a file", { status: 404 });
    const range = request.headers.get("range");
    let start = 0,
      end = metadata.size - 1,
      status = 200;
    if (range) {
      const match = range.match(/^bytes=(\d*)-(\d*)$/);
      if (!match) return new Response(null, { status: 416 });
      if (match[1]) {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      } else if (match[2])
        start = Math.max(0, metadata.size - Number(match[2]));
      if (start > end || start >= metadata.size)
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${metadata.size}` },
        });
      status = 206;
    }
    const mime: Record<string, string> = {
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".m4a": "audio/mp4",
      ".ogg": "audio/ogg",
      ".flac": "audio/flac",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    };
    const headers: Record<string, string> = {
      "Content-Type":
        mime[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Content-Length": String(Math.max(0, end - start + 1)),
      "Access-Control-Allow-Origin": "*",
    };
    if (status === 206)
      headers["Content-Range"] = `bytes ${start}-${end}/${metadata.size}`;
    const body =
      request.method === "HEAD" || metadata.size === 0
        ? null
        : Readable.toWeb(createReadStream(file, { start, end }));
    return new Response(body as ReadableStream<Uint8Array> | null, {
      status,
      headers,
    });
  } catch {
    return new Response("Media missing", { status: 404 });
  }
}
function createWindow() {
  const directory = __dirname;
  window = new BrowserWindow({
    width: pluginMode ? 1440 : 1500,
    height: pluginMode ? 900 : 950,
    show: !pluginMode && !verifyUi,
    minWidth: 1060,
    minHeight: 680,
    title: "ReaCut",
    backgroundColor: "#141518",
    ...windowChromeOptions(),
    webPreferences: {
      preload: path.join(directory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !pluginMode && !verifyUi,
      additionalArguments: pluginMode ? ["--reacut-plugin"] : [],
    },
  });
  if (verifyUi) window.webContents.setAudioMuted(true);
  if (pluginMode) {
    if (process.platform === "darwin") {
      window.on("show", () => app.setActivationPolicy("regular"));
      window.on("hide", () => app.setActivationPolicy("accessory"));
    }
    startPluginHost(window, () => { closeAllowed = true; app.quit(); });
  }
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window?.webContents.getURL()) event.preventDefault();
  });
  window.on("close", (event) => {
    if (pluginMode && !closeAllowed && !quitRequested) { event.preventDefault(); window?.hide(); return; }
    if (!dirty || closeAllowed) return;
    event.preventDefault();
    if (askingClose) return;
    askingClose = true;
    void dialog
      .showMessageBox(window!, {
        type: "question",
        message: "You have unsaved changes",
        detail: "Save your project before closing? Recent edits are also saved for recovery.",
        buttons: ["Save and close", "Cancel", "Discard changes"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        askingClose = false;
        if (result.response === 0) menuAction("save-and-close");
        if (result.response === 1) quitRequested = false;
        if (result.response === 2) {
          closeAllowed = true;
          if (quitRequested) app.quit();
          else window?.close();
        }
      });
  });
  window.on("closed", () => {
    void cancelPortablePackages();
    assistantCancelPending = true;
    assistantRunning?.cancel();
    capcutSelections.clear();
    window = null;
    dirty = false;
    closeAllowed = false;
  });
  if (process.env.VITE_DEV_SERVER_URL)
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  else void window.loadFile(path.join(directory, "../dist/index.html"));
}
void app.whenReady().then(async () => {
  try {
    const settings = JSON.parse(await readFile(userFile("assistant-clis.json"), "utf8"));
    for (const key of ["codex", "claude"] as const)
      if (typeof settings[key] === "string" && path.isAbsolute(settings[key])) assistantOverrides[key] = settings[key];
  } catch { /* default CLI discovery */ }
  registerBundledFont(
    path.join(
      app.getAppPath().replace(/\.asar$/, ".asar.unpacked"),
      "dist/fonts/NotoSansSC.ttf",
    ),
  );
  registerBundledFont(
    path.join(app.getAppPath(), "public/fonts/NotoSansSC.ttf"),
  );

  try {
    const settings = JSON.parse(
      await readFile(userFile("media-tools.json"), "utf8"),
    );
    if (settings.ffmpeg && !process.env.REACUT_FFMPEG)
      process.env.REACUT_FFMPEG = settings.ffmpeg;
    if (settings.ffprobe && !process.env.REACUT_FFPROBE)
      process.env.REACUT_FFPROBE = settings.ffprobe;
  } catch {
    /* system defaults */
  }
  protocol.handle("reacut-media", serveMedia);
  registerIPC();
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: "ReaCut",
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => menuAction("new"),
        },
        {
          label: "Open Project",
          accelerator: "CmdOrCtrl+O",
          click: () => menuAction("open"),
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => menuAction("save"),
        },
        {
          label: "Save As",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => menuAction("save-as"),
        },
        { type: "separator" },
        {
          label: "Import Media",
          accelerator: "CmdOrCtrl+I",
          click: () => menuAction("import"),
        },
        {
          label: "Import CapCut Draft…",
          click: () => menuAction("import-capcut-file"),
        },
        {
          label: "Import CapCut Project Folder…",
          click: () => menuAction("import-capcut-directory"),
        },
        {
          label: "Export Video",
          accelerator: "CmdOrCtrl+E",
          click: () => menuAction("export"),
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          click: () => menuAction("undo"),
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Shift+Z",
          click: () => menuAction("redo"),
        },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "togglefullscreen" },
        ...(process.env.VITE_DEV_SERVER_URL
          ? [{ role: "toggleDevTools" as const }]
          : []),
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "Keyboard Shortcuts", click: () => menuAction("shortcuts") },
        { label: "About ReaCut", click: () => menuAction("about") },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

let quitting = false;
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  if (dirty && !closeAllowed) {
    quitRequested = true;
    window?.close();
    return;
  }
  void Promise.all([
    (async () => { assistantCancelPending = true; await assistantStartDone; const running = assistantRunning; running?.cancel(); await running?.done; await assistantHistoryWrites.catch(() => {}); })(),
    cancelAllExports(),
    cancelPortablePackages(),
    shutdownMediaTasks(),
    writeQueue.catch(() => {}),
  ]).finally(() => {
    quitting = true;
    app.quit();
  });
});
