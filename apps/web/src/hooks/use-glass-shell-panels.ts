import * as Schema from "effect/Schema";
import { useCallback } from "react";

import { useLocalStorage } from "./use-local-storage";

const leftMin = 180;
const leftMax = 400;
const rightMin = 280;
const rightMax = 600;

const State = Schema.Struct({
  leftOpen: Schema.Boolean,
  rightOpen: Schema.Boolean,
  leftW: Schema.Finite,
  rightW: Schema.Finite,
});

const init = {
  leftOpen: true,
  rightOpen: false,
  leftW: 256,
  rightW: 384,
};

export function useGlassShellPanels(cwdKey: string | null) {
  const key = `glass.shell.v1:${cwdKey ?? "default"}`;
  const [state, set] = useLocalStorage(key, init, State);

  const setLeftOpen = useCallback(
    (leftOpen: boolean) => {
      set((state) => ({ ...state, leftOpen }));
    },
    [set],
  );

  const setRightOpen = useCallback(
    (rightOpen: boolean) => {
      set((state) => ({ ...state, rightOpen }));
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
      set((state) => ({
        ...state,
        leftW: Math.min(leftMax, Math.max(leftMin, leftW)),
      }));
    },
    [set],
  );

  const setRightWidth = useCallback(
    (rightW: number) => {
      set((state) => ({
        ...state,
        rightW: Math.min(rightMax, Math.max(rightMin, rightW)),
      }));
    },
    [set],
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
  };
}
