import * as Schema from "effect/Schema";
import { useCallback } from "react";

import { useLocalStorage } from "./use-local-storage";

const leftMin = 180;
const leftMax = 400;
const rightMin = 340;
const rightMax = 600;

export type WorkbenchTab = "git" | "web" | "terminal" | "files";

const State = Schema.Struct({
  leftOpen: Schema.Boolean,
  rightOpen: Schema.Boolean,
  leftW: Schema.Finite,
  rightW: Schema.Finite,
});

const TabSchema = Schema.Literals(["git", "web", "terminal", "files"]);

const init = {
  leftOpen: true,
  rightOpen: false,
  leftW: 256,
  rightW: 400,
};

export function useGlassShellPanels(cwdKey: string | null) {
  const key = `glass.shell.v1:${cwdKey ?? "default"}`;
  const tabKey = `glass.shell.tab.v1:${cwdKey ?? "default"}`;
  const [state, set] = useLocalStorage(key, init, State);
  const [tab, setTab] = useLocalStorage<WorkbenchTab, WorkbenchTab>(tabKey, "git", TabSchema);

  const setLeftOpen = useCallback(
    (leftOpen: boolean) => {
      set((state) => (state.leftOpen === leftOpen ? state : { ...state, leftOpen }));
    },
    [set],
  );

  const setRightOpen = useCallback(
    (rightOpen: boolean) => {
      set((state) => (state.rightOpen === rightOpen ? state : { ...state, rightOpen }));
    },
    [set],
  );

  const toggleLeft = useCallback(() => {
    set((state) => ({ ...state, leftOpen: !state.leftOpen }));
  }, [set]);

  const toggleRight = useCallback(() => {
    set((state) => ({ ...state, rightOpen: !state.rightOpen }));
  }, [set]);

  const setLeftWidth = useCallback(
    (leftW: number) => {
      set((state) => {
        const next = Math.min(leftMax, Math.max(leftMin, leftW));
        return state.leftW === next ? state : { ...state, leftW: next };
      });
    },
    [set],
  );

  const setRightWidth = useCallback(
    (rightW: number) => {
      set((state) => {
        const next = Math.min(rightMax, Math.max(rightMin, rightW));
        return state.rightW === next ? state : { ...state, rightW: next };
      });
    },
    [set],
  );

  const setActiveTab = useCallback(
    (next: WorkbenchTab) => {
      setTab(next);
      set((state) => (state.rightOpen ? state : { ...state, rightOpen: true }));
    },
    [set, setTab],
  );

  return {
    leftOpen: state.leftOpen,
    rightOpen: state.rightOpen,
    setLeftOpen,
    setRightOpen,
    leftW: state.leftW,
    rightW: state.rightW,
    toggleLeft,
    toggleRight,
    setLeftWidth,
    setRightWidth,
    activeTab: tab,
    setActiveTab,
  };
}
