/**
 * Snapshot at first import of this module. Prefer `typeof window !== "undefined" &&
 * window.glass !== undefined` in render when layout must match Electron (e.g. traffic insets).
 */
export const isElectron = typeof window !== "undefined" && window.glass !== undefined;
