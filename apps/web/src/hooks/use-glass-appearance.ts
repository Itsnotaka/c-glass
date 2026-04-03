import { useEffect, useState } from "react";

import { readGlassAppearanceSnapshot, subscribeGlassAppearance } from "../lib/glass-appearance";
import { useTheme } from "./use-theme";

export function useGlassAppearance() {
  const theme = useTheme();
  const [, bump] = useState(0);
  useEffect(() => subscribeGlassAppearance(() => bump((n) => n + 1)), []);
  useEffect(() => {
    bump((n) => n + 1);
  }, [theme.theme, theme.resolvedTheme]);
  return readGlassAppearanceSnapshot();
}
