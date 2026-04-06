"use client";

import { useNavigate } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

const GlassSettingsContext = createContext<{
  openSettings: () => void;
} | null>(null);

export function GlassSettingsProvider(props: { children: ReactNode }) {
  const navigate = useNavigate();
  const openSettings = useCallback(() => {
    void navigate({ to: "/settings/appearance" });
  }, [navigate]);
  const value = useMemo(() => ({ openSettings }), [openSettings]);
  return (
    <GlassSettingsContext.Provider value={value}>{props.children}</GlassSettingsContext.Provider>
  );
}

export function useGlassSettings() {
  const ctx = useContext(GlassSettingsContext);
  if (!ctx) throw new Error("useGlassSettings must be used within GlassSettingsProvider");
  return ctx;
}
