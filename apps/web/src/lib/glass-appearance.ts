import { ALL_PRESET_VAR_KEYS, PIERRE_DARK_VARS, PIERRE_LIGHT_VARS } from "./pierre-color-presets";

export const STORAGE_COLOR_PALETTE = "glass:color-preset";
export const STORAGE_REDUCE_TRANSPARENCY = "glass:reduce-transparency";
export const STORAGE_UI_FONT_SIZE = "glass:ui-font-size";
export const STORAGE_CODE_FONT_SIZE = "glass:code-font-size";
export const STORAGE_UI_FONT = "glass:ui-font";
export const STORAGE_CODE_FONT = "glass:mono-font";

export type ColorPaletteId = "glass" | "pierre";

const GLASS_APPEARANCE_EVENT = "glass-appearance-changed";

let listeners: Array<() => void> = [];

function emit() {
  for (const fn of listeners) fn();
  window.dispatchEvent(new CustomEvent(GLASS_APPEARANCE_EVENT));
}

export function subscribeGlassAppearance(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((x) => x !== cb);
  };
}

function parseIntStored(raw: string | null, fallback: number, min: number, max: number) {
  if (raw === null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function getColorPalette(): ColorPaletteId {
  const raw = localStorage.getItem(STORAGE_COLOR_PALETTE);
  if (raw === "pierre") return "pierre";
  return "glass";
}

export function applyColorPalette() {
  const root = document.documentElement;
  const preset = getColorPalette();

  if (preset === "pierre") {
    const map = root.classList.contains("dark") ? PIERRE_DARK_VARS : PIERRE_LIGHT_VARS;
    for (const k of ALL_PRESET_VAR_KEYS) {
      root.style.removeProperty(k);
    }
    for (const [k, v] of Object.entries(map)) {
      root.style.setProperty(k, v);
    }
    root.style.removeProperty("--glass-user-hue");
    root.style.removeProperty("--glass-intensity");
    emit();
    return;
  }

  for (const k of ALL_PRESET_VAR_KEYS) {
    root.style.removeProperty(k);
  }
  root.style.removeProperty("--glass-user-hue");
  root.style.removeProperty("--glass-intensity");
  emit();
}

export function applyGlassAppearance() {
  const root = document.documentElement;

  const reduce = localStorage.getItem(STORAGE_REDUCE_TRANSPARENCY) === "1";
  root.classList.toggle("glass-reduce-transparency", reduce);
  root.classList.remove("glass-hide-email");

  const uiPx = parseIntStored(localStorage.getItem(STORAGE_UI_FONT_SIZE), 13, 11, 16);
  const codePx = parseIntStored(localStorage.getItem(STORAGE_CODE_FONT_SIZE), 12, 10, 18);
  root.style.setProperty("--glass-sidebar-label-size-user", `${uiPx}px`);
  root.style.setProperty("--glass-ui-font-size-user", `${uiPx}px`);
  root.style.setProperty("--glass-code-font-size-user", `${codePx}px`);

  const uiFont = localStorage.getItem(STORAGE_UI_FONT)?.trim() ?? "";
  const codeFont = localStorage.getItem(STORAGE_CODE_FONT)?.trim() ?? "";
  if (uiFont) {
    root.style.setProperty("--glass-font-ui", uiFont);
  } else {
    root.style.removeProperty("--glass-font-ui");
  }
  if (codeFont) {
    root.style.setProperty("--glass-font-mono", codeFont);
  } else {
    root.style.removeProperty("--glass-font-mono");
  }

  applyColorPalette();
}

export function resetGlassAppearance() {
  localStorage.removeItem(STORAGE_COLOR_PALETTE);
  localStorage.removeItem("glass:accent-hue");
  localStorage.removeItem("glass:accent-intensity");
  localStorage.removeItem(STORAGE_REDUCE_TRANSPARENCY);
  localStorage.removeItem(STORAGE_UI_FONT_SIZE);
  localStorage.removeItem(STORAGE_CODE_FONT_SIZE);
  localStorage.removeItem(STORAGE_UI_FONT);
  localStorage.removeItem(STORAGE_CODE_FONT);
  localStorage.removeItem("glass:hide-email");
  applyGlassAppearance();
}

export function setColorPalette(next: ColorPaletteId) {
  localStorage.setItem(STORAGE_COLOR_PALETTE, next);
  applyGlassAppearance();
}

export function setReduceTransparency(on: boolean) {
  localStorage.setItem(STORAGE_REDUCE_TRANSPARENCY, on ? "1" : "0");
  applyGlassAppearance();
}

export function setUiFontSize(px: number) {
  localStorage.setItem(STORAGE_UI_FONT_SIZE, String(px));
  applyGlassAppearance();
}

export function setCodeFontSize(px: number) {
  localStorage.setItem(STORAGE_CODE_FONT_SIZE, String(px));
  applyGlassAppearance();
}

export function setUiFontFamily(css: string) {
  if (css.trim()) {
    localStorage.setItem(STORAGE_UI_FONT, css);
  } else {
    localStorage.removeItem(STORAGE_UI_FONT);
  }
  applyGlassAppearance();
}

export function setCodeFontFamily(css: string) {
  if (css.trim()) {
    localStorage.setItem(STORAGE_CODE_FONT, css);
  } else {
    localStorage.removeItem(STORAGE_CODE_FONT);
  }
  applyGlassAppearance();
}

export function readGlassAppearanceSnapshot() {
  return {
    palette: getColorPalette(),
    reduceTransparency: localStorage.getItem(STORAGE_REDUCE_TRANSPARENCY) === "1",
    uiFontSize: parseIntStored(localStorage.getItem(STORAGE_UI_FONT_SIZE), 13, 11, 16),
    codeFontSize: parseIntStored(localStorage.getItem(STORAGE_CODE_FONT_SIZE), 12, 10, 18),
    uiFont: localStorage.getItem(STORAGE_UI_FONT)?.trim() ?? "",
    codeFont: localStorage.getItem(STORAGE_CODE_FONT)?.trim() ?? "",
  } as const;
}
