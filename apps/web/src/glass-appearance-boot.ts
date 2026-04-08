import { applyHostMarkers } from "./env";
import { applyStoredTheme } from "./hooks/use-theme";
import { applyDesktopChromeMetrics } from "./lib/desktop-chrome";
import { applyGlassAppearanceBoot } from "./lib/glass-appearance";

applyHostMarkers();
applyDesktopChromeMetrics();
applyStoredTheme();
applyGlassAppearanceBoot();
