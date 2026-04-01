import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type GlassCenterMode = "main" | "marketplace";

const GlassShellContext = createContext<{
  centerMode: GlassCenterMode;
  setCenterMode: (mode: GlassCenterMode) => void;
} | null>(null);

export function GlassShellProvider(props: { children: ReactNode }) {
  const [centerMode, setCenterMode] = useState<GlassCenterMode>("main");
  const value = useMemo(() => ({ centerMode, setCenterMode }), [centerMode]);
  return <GlassShellContext.Provider value={value}>{props.children}</GlassShellContext.Provider>;
}

export function useGlassShellView() {
  const ctx = useContext(GlassShellContext);
  if (!ctx) {
    throw new Error("useGlassShellView must be used within GlassShellProvider");
  }
  return ctx;
}
