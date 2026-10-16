import type { BrowserWindowConstructorOptions } from "electron";

export const TITLE_BAR_HEIGHT = 44;

/** Keep OS caption controls and Windows Snap while drawing our own app bar. */
export function windowChromeOptions(
  platform: NodeJS.Platform = process.platform,
): Pick<BrowserWindowConstructorOptions, "titleBarStyle" | "titleBarOverlay" | "trafficLightPosition" | "autoHideMenuBar"> {
  if (platform === "darwin") {
    return {
      titleBarStyle: "hidden",
      trafficLightPosition: { x: 14, y: 14 },
    };
  }
  return {
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#151515",
      symbolColor: "#dedede",
      height: TITLE_BAR_HEIGHT,
    },
    autoHideMenuBar: true,
  };
}
