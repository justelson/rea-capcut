export function shortcutLabel(keys: string, platform = window.windowChrome?.platform): string {
  if (platform === "darwin") return keys.replaceAll("Ctrl", "Cmd");
  return keys.replaceAll("⇧", "Shift+").replaceAll("⌘", "Ctrl+").replaceAll("⌥", "Alt+");
}
