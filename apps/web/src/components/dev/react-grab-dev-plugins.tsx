"use client";

import { useEffect } from "react";

import { registerGlassOverlayDebug } from "~/lib/react-grab-overlay-debug";

/**
 * Registers React Grab plugins in dev (overlay host debugger, etc.).
 * Loaded only when `import.meta.env.DEV` so production bundles stay lean.
 */
export function ReactGrabDevPlugins() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void registerGlassOverlayDebug().then((d) => {
      if (cancelled) d();
      else cleanup = d;
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
