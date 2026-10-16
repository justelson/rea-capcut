/** Product-facing acceptance on an isolated, muted packaged app. */
import { _electron as electron, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { captureNativeWindow } from "./helpers/captureNativeWindow";

const root = process.cwd();
const output = path.join(root, ".test-output", "english-window");
await mkdir(output, { recursive: true });
const profile = path.join(output, `profile-${Date.now()}`);
const bundle = path.resolve(process.env.REACUT_TEST_APP ?? path.join(root, "release", "win-unpacked"));
const hidden = !process.env.CI;
const env = Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => pair[1] !== undefined));
env.REACUT_USER_DATA = profile;
delete env.ELECTRON_RUN_AS_NODE;
delete env.VITE_DEV_SERVER_URL;
const app = await electron.launch({
  executablePath: process.env.REACUT_TEST_EXECUTABLE ?? path.join(bundle, "ReaCut.exe"),
  args: [...(process.env.REACUT_TEST_EXECUTABLE ? [root] : []), hidden ? "--verify-ui" : "--mute-audio"],
  cwd: output,
  env,
  timeout: 60000,
});
const page = await app.firstWindow();
const projectName = page.locator(".titlebar").getByLabel("Project name", { exact: true });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
const checked: string[] = [];

async function english(stage: string) {
  const copy = await page.evaluate(() => [
    document.body.innerText,
    ...Array.from(document.querySelectorAll("[title], [aria-label], [placeholder]"), element =>
      ["title", "aria-label", "placeholder"].map(name => element.getAttribute(name) ?? "").join(" ")),
  ].join("\n"));
  assert(!/\p{Script=Han}/u.test(copy), `${stage} contains untranslated product copy`);
  checked.push(stage);
}

async function screenshot(name: string) {
  await english(name);
  await page.screenshot({ path: path.join(output, `${name}.png`), timeout: hidden ? 90000 : 30000 });
}

try {
  await expect(projectName).toBeVisible();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1500, 900));
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1500);
  await screenshot("empty-editor");
  if (!hidden) {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1500, 950));
    await captureNativeWindow(app, path.join(output, "after-window.png"));
  }
  const native = await app.evaluate(({ app, BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return { packaged: app.isPackaged, visible: win.isVisible(), muted: win.webContents.isAudioMuted(), platform: process.platform };
  });
  if (hidden) {
    assert.equal(native.visible, false, "Local QA must stay hidden");
    assert.equal(native.muted, true, "Local QA must stay muted");
  }
  for (const tab of ["Media", "Audio", "Text", "Stickers", "Effects", "Transitions", "Captions"]) {
    await page.locator(".resource-tabs").getByRole("button", { name: tab, exact: true }).click();
    await screenshot(`library-${tab.toLowerCase()}`);
  }
  await page.getByRole("button", { name: "File menu", exact: true }).click();
  await screenshot("file-menu");
  if (native.platform === "win32") await expect(page.locator(".file-menu")).toContainText("Ctrl+S");
  await page.getByRole("button", { name: "File menu", exact: true }).click();
  await page.getByRole("button", { name: "Keyboard shortcuts", exact: true }).click();
  await screenshot("shortcuts");
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await screenshot("settings");
  await page.getByRole("button", { name: "About", exact: true }).click();
  await screenshot("about");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await screenshot("export");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "File menu", exact: true }).click();
  await page.getByRole("button", { name: "Collect project media…", exact: true }).click();
  await screenshot("collect-project");
  await page.getByRole("button", { name: "Close media packaging", exact: true }).click();
  await page.getByRole("button", { name: "Editing assistant", exact: true }).click();
  await screenshot("assistant");
  await page.getByRole("button", { name: "Editing assistant", exact: true }).click();

  const layouts = [];
  for (const width of [1060, 1280, 1500]) {
    await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setContentSize(width, 900), width);
    // Windows can round client bounds by two CSS pixels at fractional display scaling.
    await expect.poll(async () => Math.abs(await page.evaluate(() => innerWidth) - width)).toBeLessThanOrEqual(2);
    const layout = await page.evaluate(() => {
      const header = document.querySelector(".titlebar-content")!.getBoundingClientRect();
      const actions = document.querySelector(".titlebar-actions")!.getBoundingClientRect();
      const name = document.querySelector(".project-title")!.getBoundingClientRect();
      const menus = document.querySelector(".titlebar-menus")!.getBoundingClientRect();
      const overlay = (navigator as any).windowControlsOverlay;
      const rect = overlay?.getTitlebarAreaRect();
      return {
        width: innerWidth, actionsRight: actions.right, safeRight: header.right,
        nameLeft: name.left, menusRight: menus.right,
        overlayVisible: overlay?.visible,
        overlay: rect ? { x: rect.x, width: rect.width, height: rect.height } : null,
        draggable: getComputedStyle(document.querySelector(".titlebar")!).getPropertyValue("-webkit-app-region"),
        buttonDrag: getComputedStyle(document.querySelector(".export-button")!).getPropertyValue("-webkit-app-region"),
        resourceLabelsFit: Array.from(document.querySelectorAll(".resource-tabs button"), button => {
          const bounds = button.getBoundingClientRect();
          const label = button.querySelector("span")!.getBoundingClientRect();
          return label.left >= bounds.left - 1 && label.right <= bounds.right + 1;
        }).every(Boolean),
      };
    });
    console.log("Title bar bounds:", layout);
    assert(layout.actionsRight <= layout.safeRight + 1, `Actions overlap caption buttons at ${width}px`);
    assert(layout.nameLeft >= layout.menusRight - 1, `Project name overlaps menus at ${width}px`);
    assert.equal(layout.draggable, "drag");
    assert.equal(layout.buttonDrag, "no-drag");
    assert(layout.resourceLabelsFit, `English library labels overlap their buttons at ${width}px`);
    if (native.platform === "win32") {
      assert.equal(layout.overlayVisible, true);
      assert(layout.overlay && layout.overlay.width < layout.width && layout.overlay.height === 44);
    }
    layouts.push(layout);
    await screenshot(`titlebar-${width}`);
  }
  // On cloud workers exercise the native window state without touching a user's desktop.
  if (!hidden) {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize());
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized())).toBe(true);
    await screenshot("maximized");
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize());
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized())).toBe(true);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore());
  }
  // Original project text survives editing and the native close guard remains English.
  await projectName.fill("我的项目 · Personal title");
  await projectName.blur();
  await expect(projectName).toHaveValue("我的项目 · Personal title");
  await app.evaluate(({ dialog, BrowserWindow }) => {
    (dialog as any).showMessageBox = async (_window: unknown, options: unknown) => {
      (globalThis as any).__closeDialog = options;
      return { response: 1 };
    };
    BrowserWindow.getAllWindows()[0].close();
  });
  await expect.poll(() => app.evaluate(() => (globalThis as any).__closeDialog?.message)).toBe("You have unsaved changes");
  const closeDialog = await app.evaluate(() => (globalThis as any).__closeDialog);
  assert(!/\p{Script=Han}/u.test(JSON.stringify(closeDialog)));
  assert.deepEqual(closeDialog.buttons, ["Save and close", "Cancel", "Discard changes"]);
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, "evidence.json"), JSON.stringify({ checked, native, layouts, closeDialog, userTextPreserved: true, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  await app.evaluate(({ dialog }) => { (dialog as any).showMessageBox = async () => ({ response: 2 }); }).catch(() => {});
  await app.close();
}
