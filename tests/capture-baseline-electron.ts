/** Immutable historical source, used only for matching cloud before/after evidence. */
import { _electron as electron, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { captureNativeWindow } from "./helpers/captureNativeWindow";

if (!process.env.CI || !process.env.REACUT_BASELINE_SOURCE) throw new Error("Baseline capture runs only in cloud CI with explicit historical source.");
const output = path.resolve(".test-output/english-window");
await mkdir(output, { recursive: true });
const env = Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined));
env.REACUT_USER_DATA = path.join(output, `baseline-profile-${Date.now()}`);
delete env.ELECTRON_RUN_AS_NODE;
delete env.VITE_DEV_SERVER_URL;
const app = await electron.launch({ executablePath: path.resolve("node_modules/electron/dist/electron.exe"), args: [path.resolve(process.env.REACUT_BASELINE_SOURCE), "--mute-audio"], env });
try {
  const page = await app.firstWindow();
  await expect(page.locator(".project-title input")).toBeVisible();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1500, 900));
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1500);
  await page.screenshot({ path: path.join(output, "before.png") });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1500, 950));
  await captureNativeWindow(app, path.join(output, "before-window.png"));
} finally { await app.close(); }
