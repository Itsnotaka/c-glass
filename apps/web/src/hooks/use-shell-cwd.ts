import { useEffect, useState } from "react";

import { readGlass } from "../host";
import { PI_GLASS_SHELL_CHANGED_EVENT } from "../lib/pi-glass-constants";

export function useShellCwd() {
  const [cwd, setCwd] = useState<string | null>(null);

  useEffect(() => {
    const g = readGlass();
    if (!g) {
      setCwd("browser");
      return;
    }

    let live = true;

    const load = () => {
      void g.shell
        .getState()
        .then((s) => {
          if (!live) return;
          setCwd(s.cwd);
        })
        .catch(() => {});
    };

    load();
    window.addEventListener(PI_GLASS_SHELL_CHANGED_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(PI_GLASS_SHELL_CHANGED_EVENT, load);
    };
  }, []);

  return cwd;
}
