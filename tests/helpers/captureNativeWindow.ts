import type { ElectronApplication } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

/** Print only the owned test window, including its native caption controls. */
export async function captureNativeWindow(app: ElectronApplication, destination: string) {
  if (process.platform !== "win32") return;
  const handle = await app.evaluate(({ BrowserWindow }) => {
    const bytes = BrowserWindow.getAllWindows()[0].getNativeWindowHandle();
    return bytes.length === 8 ? bytes.readBigUInt64LE().toString() : bytes.readUInt32LE().toString();
  });
  await promisify(execFile)("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-File", path.resolve("tests/helpers/capture-window.ps1"),
    "-WindowHandle", handle, "-Destination", destination,
  ], { windowsHide: true, timeout: 30000 });
}
