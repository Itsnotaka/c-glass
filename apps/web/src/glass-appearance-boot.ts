import { applyHostMarkers } from "./env";
import { applyStoredTheme } from "./hooks/use-theme";
import { applyGlassAppearanceBoot } from "./lib/glass-appearance";

applyHostMarkers();
applyStoredTheme();
applyGlassAppearanceBoot();
