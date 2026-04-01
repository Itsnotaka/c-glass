/**
 * True when running inside the Electron preload bridge, false in a regular browser.
 */
export const isElectron = typeof window !== "undefined" && window.glass !== undefined;
