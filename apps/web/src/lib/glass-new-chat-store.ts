import { create } from "zustand";

type State = {
  tick: number;
  bump: () => void;
};

export const useGlassNewChatStore = create<State>()((set) => ({
  tick: 0,
  bump: () => {
    set((state) => ({ tick: state.tick + 1 }));
  },
}));
