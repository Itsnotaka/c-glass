import { create } from "zustand";

export type GlassHeroShot = {
  id: string;
  text: string;
};

type State = {
  shot: GlassHeroShot | null;
  fire: (text: string) => void;
  clear: (id?: string) => void;
};

export const useGlassHeroFxStore = create<State>()((set) => ({
  shot: null,
  fire: (text) => {
    const next = text.trim().replace(/\s+/g, " ").slice(0, 140);
    if (!next) return;
    set({ shot: { id: crypto.randomUUID(), text: next } });
  },
  clear: (id) => {
    set((state) => {
      if (!state.shot) return state;
      if (id && state.shot.id !== id) return state;
      return { shot: null };
    });
  },
}));

export function fireGlassHeroFx(text: string) {
  useGlassHeroFxStore.getState().fire(text);
}
