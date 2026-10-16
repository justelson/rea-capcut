import type { ReactNode } from "react";
import "./titlebar.css";

declare global {
  interface Window {
    windowChrome?: { readonly platform: string };
  }
}

/** The overlay safe area tracks native controls, resizing and maximization. */
export default function Titlebar({ children }: { children: ReactNode }) {
  return (
    <header className="titlebar" data-platform={window.windowChrome?.platform ?? "browser"}>
      <div className="titlebar-content">{children}</div>
    </header>
  );
}
