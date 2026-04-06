import { readGlass } from "../host";
import { ALL_PRESET_VAR_KEYS, PIERRE_DARK_VARS, PIERRE_LIGHT_VARS } from "./pierre-color-presets";

export const STORAGE_COLOR_PALETTE = "glass:color-preset";
export const STORAGE_REDUCE_TRANSPARENCY = "glass:reduce-transparency";
export const STORAGE_WINDOW_TRANSPARENCY = "glass:window-transparency";
export const STORAGE_TINT_HUE = "glass:accent-hue";
export const STORAGE_TINT_SATURATION = "glass:accent-saturation";
export const STORAGE_UI_FONT_SIZE = "glass:ui-font-size";
export const STORAGE_CODE_FONT_SIZE = "glass:code-font-size";
export const STORAGE_UI_FONT = "glass:ui-font";
export const STORAGE_CODE_FONT = "glass:mono-font";

export type ColorPaletteId = "glass" | "pierre";

const GLASS_APPEARANCE_EVENT = "glass-appearance-changed";

let listeners: Array<() => void> = [];
const keys = new Set([
  STORAGE_COLOR_PALETTE,
  STORAGE_REDUCE_TRANSPARENCY,
  STORAGE_WINDOW_TRANSPARENCY,
  STORAGE_TINT_HUE,
  STORAGE_TINT_SATURATION,
  "glass:accent-intensity",
  STORAGE_UI_FONT_SIZE,
  STORAGE_CODE_FONT_SIZE,
  STORAGE_UI_FONT,
  STORAGE_CODE_FONT,
]);

function emit() {
  for (const fn of listeners) fn();
  window.dispatchEvent(new CustomEvent(GLASS_APPEARANCE_EVENT));
}

export function subscribeGlassAppearance(cb: () => void) {
  listeners.push(cb);

  const sync = (event: StorageEvent) => {
    if (event.storageArea !== localStorage) return;
    if (event.key !== null && !keys.has(event.key)) return;
    applyGlassAppearance();
  };

  window.addEventListener("storage", sync);

  return () => {
    listeners = listeners.filter((x) => x !== cb);
    window.removeEventListener("storage", sync);
  };
}

function parseIntStored(raw: string | null, fallback: number, min: number, max: number) {
  if (raw === null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function readTintSaturation() {
  const raw =
    localStorage.getItem(STORAGE_TINT_SATURATION) ?? localStorage.getItem("glass:accent-intensity");
  return parseIntStored(raw, 33, 0, 100);
}

export function getColorPalette(): ColorPaletteId {
  const raw = localStorage.getItem(STORAGE_COLOR_PALETTE);
  if (raw === "pierre") return "pierre";
  return "glass";
}

export function applyColorPalette() {
  const root = document.documentElement;
  const preset = getColorPalette();
  const hue = parseIntStored(localStorage.getItem(STORAGE_TINT_HUE), 255, 0, 360);
  const saturation = readTintSaturation();

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
  root.style.setProperty("--glass-user-hue", String(hue));
  root.style.setProperty("--glass-intensity", String(saturation));
  emit();
}

function wantsOsVibrancy() {
  if (getColorPalette() !== "glass") return false;
  if (localStorage.getItem(STORAGE_REDUCE_TRANSPARENCY) === "1") return false;
  return true;
}

function syncVibrancy() {
  const bridge = readGlass();
  if (!bridge) return;
  void bridge.desktop.setVibrancy(wantsOsVibrancy());
}

function applyGlassRoot() {
  const root = document.documentElement;

  const reduce = localStorage.getItem(STORAGE_REDUCE_TRANSPARENCY) === "1";
  const transparency = parseIntStored(
    localStorage.getItem(STORAGE_WINDOW_TRANSPARENCY),
    18,
    0,
    100,
  );
  root.classList.toggle("glass-reduce-transparency", reduce);
  root.classList.remove("glass-hide-email");
  root.style.setProperty("--glass-transparency", String(transparency));

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

export function applyGlassAppearanceBoot() {
  applyGlassRoot();
}

function applyGlassAppearance() {
  applyGlassRoot();
  syncVibrancy();
}

export function resetGlassAppearance() {
  localStorage.removeItem(STORAGE_COLOR_PALETTE);
  localStorage.removeItem(STORAGE_WINDOW_TRANSPARENCY);
  localStorage.removeItem(STORAGE_TINT_HUE);
  localStorage.removeItem(STORAGE_TINT_SATURATION);
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

export function setWindowTransparency(value: number) {
  localStorage.setItem(STORAGE_WINDOW_TRANSPARENCY, String(Math.min(100, Math.max(0, value))));
  applyGlassAppearance();
}

export function setTintHue(value: number) {
  localStorage.setItem(STORAGE_TINT_HUE, String(Math.min(360, Math.max(0, value))));
  applyGlassAppearance();
}

export function setTintSaturation(value: number) {
  localStorage.setItem(STORAGE_TINT_SATURATION, String(Math.min(100, Math.max(0, value))));
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

type GlassAppearanceSnapshot = {
  readonly palette: ColorPaletteId;
  readonly reduceTransparency: boolean;
  readonly transparency: number;
  readonly hue: number;
  readonly saturation: number;
  readonly uiFontSize: number;
  readonly codeFontSize: number;
  readonly uiFont: string;
  readonly codeFont: string;
};

function buildSnapshot(): GlassAppearanceSnapshot {
  return {
    palette: getColorPalette(),
    reduceTransparency: localStorage.getItem(STORAGE_REDUCE_TRANSPARENCY) === "1",
    transparency: parseIntStored(localStorage.getItem(STORAGE_WINDOW_TRANSPARENCY), 18, 0, 100),
    hue: parseIntStored(localStorage.getItem(STORAGE_TINT_HUE), 255, 0, 360),
    saturation: readTintSaturation(),
    uiFontSize: parseIntStored(localStorage.getItem(STORAGE_UI_FONT_SIZE), 13, 11, 16),
    codeFontSize: parseIntStored(localStorage.getItem(STORAGE_CODE_FONT_SIZE), 12, 10, 18),
    uiFont: localStorage.getItem(STORAGE_UI_FONT)?.trim() ?? "",
    codeFont: localStorage.getItem(STORAGE_CODE_FONT)?.trim() ?? "",
  };
}

let cached: GlassAppearanceSnapshot | undefined;

export function readGlassAppearanceSnapshot() {
  const next = buildSnapshot();
  if (
    cached &&
    cached.palette === next.palette &&
    cached.reduceTransparency === next.reduceTransparency &&
    cached.transparency === next.transparency &&
    cached.hue === next.hue &&
    cached.saturation === next.saturation &&
    cached.uiFontSize === next.uiFontSize &&
    cached.codeFontSize === next.codeFontSize &&
    cached.uiFont === next.uiFont &&
    cached.codeFont === next.codeFont
  ) {
    return cached;
  }
  cached = next;
  return next;
}
