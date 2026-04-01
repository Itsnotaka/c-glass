import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const GlassSettingsContext = createContext<{
  open: boolean;
  openSettings: () => void;
  closeSettings: () => void;
} | null>(null);

export function GlassSettingsProvider(props: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSettings = useCallback(() => setOpen(true), []);
  const closeSettings = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ open, openSettings, closeSettings }),
    [open, openSettings, closeSettings],
  );
  return (
    <GlassSettingsContext.Provider value={value}>{props.children}</GlassSettingsContext.Provider>
  );
}

export function useGlassSettings() {
  const ctx = useContext(GlassSettingsContext);
  if (!ctx) throw new Error("useGlassSettings must be used within GlassSettingsProvider");
  return ctx;
}
