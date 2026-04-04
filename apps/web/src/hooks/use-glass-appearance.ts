import { useSyncExternalStore } from "react";

import { readGlassAppearanceSnapshot, subscribeGlassAppearance } from "../lib/glass-appearance";

export function useGlassAppearance() {
  return useSyncExternalStore(
    subscribeGlassAppearance,
    readGlassAppearanceSnapshot,
    readGlassAppearanceSnapshot,
  );
}
