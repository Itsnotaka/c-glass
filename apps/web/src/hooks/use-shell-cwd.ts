import type { ShellState } from "@glass/contracts";
import { useEffect, useState } from "react";

import { readGlass, readGlassBoot } from "../host";
import { PI_GLASS_SHELL_CHANGED_EVENT } from "../lib/pi-glass-constants";

export function useShellState() {
  const [state, setState] = useState<ShellState | null>(() => readGlassBoot()?.shell ?? null);

  useEffect(() => {
    const g = readGlass();
    if (!g) {
      setState(readGlassBoot()?.shell ?? null);
      return;
    }

    let live = true;
    const sync = () => {
      void g.shell
        .getState()
        .then((s) => {
          if (!live) return;
          setState(s);
        })
        .catch(() => {});
    };

    sync();
    window.addEventListener(PI_GLASS_SHELL_CHANGED_EVENT, sync);

    return () => {
      live = false;
      window.removeEventListener(PI_GLASS_SHELL_CHANGED_EVENT, sync);
    };
  }, []);

  return {
    cwd: state?.cwd ?? null,
    name: state?.name ?? null,
    home: state?.home ?? null,
    availableEditors: state?.availableEditors ?? [],
  };
}
