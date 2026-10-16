import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";

type ToolName = "ffmpeg" | "ffprobe";
let bundledDirectory: string | undefined;

/** The packaged main process supplies this before media work begins. */
export function setBundledMediaToolsDirectory(directory: string): void {
  bundledDirectory = directory;
}

export async function resolveMediaTool(
  name: ToolName,
  options: {
    bundledDirectory?: string;
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
  } = {},
): Promise<string> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const override = env[name === "ffmpeg" ? "REACUT_FFMPEG" : "REACUT_FFPROBE"];
  const executable = platform === "win32" ? `${name}.exe` : name;
  const candidates = override
    ? [override]
    : options.bundledDirectory
      ? [path.join(options.bundledDirectory, executable)]
      : (env.PATH ?? "").split(platform === "win32" ? ";" : ":")
          .filter(Boolean).map(directory => path.join(directory, executable))
          .concat(platform === "win32" ? [] : [
            `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, `/usr/bin/${name}`,
          ]);
  for (const candidate of candidates) {
    try {
      if (!(await stat(candidate)).isFile()) continue;
      await access(candidate, platform === "win32" ? constants.F_OK : constants.X_OK);
      return candidate;
    } catch { /* next candidate */ }
  }
  if (override) throw new Error(`The selected ${name} is unavailable. Choose the executable again in Settings.`);
  if (options.bundledDirectory)
    throw new Error(`Built-in ${name} is missing or not executable. Reinstall the full app.`);
  throw new Error(`Could not find ${name}. Install FFmpeg for development or choose an executable in Settings.`);
}

export function findMediaTool(name: ToolName): Promise<string> {
  return resolveMediaTool(name, { bundledDirectory });
}
