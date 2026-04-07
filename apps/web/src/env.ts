function userAgent() {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent;
}

export const isElectronHost = () => /Electron/i.test(userAgent());

export function applyHostMarkers() {
  if (typeof document === "undefined") return;
  if (isElectronHost()) {
    document.documentElement.dataset.electron = "";
    return;
  }
  delete document.documentElement.dataset.electron;
}

export const isElectron = isElectronHost();
