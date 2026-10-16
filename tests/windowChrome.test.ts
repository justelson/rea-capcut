import { describe, expect, it } from "vitest";
import { TITLE_BAR_HEIGHT, windowChromeOptions } from "../electron/windowChrome";
import { shortcutLabel } from "../src/window/shortcuts";

describe("native window chrome", () => {
  it("shows platform-specific shortcut hints", () => {
    expect(shortcutLabel("⇧⌘S", "win32")).toBe("Shift+Ctrl+S");
    expect(shortcutLabel("Ctrl + S", "darwin")).toBe("Cmd + S");
    expect(shortcutLabel("⌥←/→", "linux")).toBe("Alt+←/→");
  });
  it.each(["win32", "linux"] as const)("reserves native caption controls on %s", platform => {
    expect(windowChromeOptions(platform)).toEqual({
      titleBarStyle: "hidden",
      titleBarOverlay: { color: "#151515", symbolColor: "#dedede", height: TITLE_BAR_HEIGHT },
      autoHideMenuBar: true,
    });
  });
  it("keeps macOS traffic lights at the left", () => {
    expect(windowChromeOptions("darwin")).toEqual({
      titleBarStyle: "hidden",
      trafficLightPosition: { x: 14, y: 14 },
    });
  });
});
