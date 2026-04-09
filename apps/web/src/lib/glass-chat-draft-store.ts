import type { HarnessKind, ProviderInteractionMode } from "@glass/contracts";
import { DEFAULT_PROVIDER_INTERACTION_MODE } from "@glass/contracts";
import { create } from "zustand";

export type GlassDraftFile =
  | {
      id: string;
      type: "path";
      name: string;
      path: string;
      kind: "file" | "image";
      size: number;
      mimeType: string | null;
      previewData?: string;
      previewMime?: string | null;
    }
  | {
      id: string;
      type: "inline";
      name: string;
      mimeType: string;
      data: string;
      size: number;
    };

export type GlassDraftSkill = {
  id: string;
  name: string;
  start: number;
  end: number;
};

export interface GlassDraftChat {
  id: string;
  cwd: string;
  harness: HarnessKind;
  text: string;
  files: GlassDraftFile[];
  skills: GlassDraftSkill[];
  interactionMode: ProviderInteractionMode;
  createdAt: string;
  updatedAt: string;
}

type Root = {
  text: string;
  files: GlassDraftFile[];
  skills: GlassDraftSkill[];
  interactionMode: ProviderInteractionMode;
};

type State = {
  cur: string | null;
  root: Root;
  items: Record<string, GlassDraftChat>;
  pick: (id: string | null) => void;
  park: (cwd: string, harness: HarnessKind) => string | null;
  save: (id: string, text: string, files: GlassDraftFile[], skills: GlassDraftSkill[]) => void;
  saveRoot: (text: string, files: GlassDraftFile[], skills: GlassDraftSkill[]) => void;
  toggleRootPlanInteraction: () => void;
  setActiveInteractionMode: (mode: ProviderInteractionMode) => void;
  drop: (id: string) => void;
  promote: (id: string) => void;
};

const empty = (): Root => ({
  text: "",
  files: [],
  skills: [],
  interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
});

const now = () => new Date().toISOString();

export const hasDraft = (text: string, files: readonly GlassDraftFile[]) =>
  text.trim().length > 0 || files.length > 0;

export const useGlassChatDraftStore = create<State>()((set) => ({
  cur: null,
  root: empty(),
  items: {},
  pick: (id) => {
    set((state) => (state.cur === id ? state : { ...state, cur: id }));
  },
  park: (cwd, harness) => {
    const state = useGlassChatDraftStore.getState();
    if (!hasDraft(state.root.text, state.root.files)) return null;
    const id = crypto.randomUUID();
    const stamp = now();
    set({
      cur: null,
      root: empty(),
      items: {
        ...state.items,
        [id]: {
          id,
          cwd,
          harness,
          text: state.root.text,
          files: state.root.files,
          skills: state.root.skills,
          interactionMode: state.root.interactionMode,
          createdAt: stamp,
          updatedAt: stamp,
        },
      },
    });
    return id;
  },
  save: (id, text, files, skills) => {
    set((state) => {
      const item = state.items[id];
      if (!item) return state;
      if (!hasDraft(text, files)) {
        const items = { ...state.items };
        delete items[id];
        return {
          ...state,
          cur: state.cur === id ? null : state.cur,
          items,
        };
      }
      return {
        ...state,
        items: {
          ...state.items,
          [id]: {
            ...item,
            text,
            files,
            skills,
            interactionMode: item.interactionMode,
            updatedAt: now(),
          },
        },
      };
    });
  },
  saveRoot: (text, files, skills) => {
    set((state) =>
      state.root.text === text && state.root.files === files && state.root.skills === skills
        ? state
        : {
            ...state,
            root: { text, files, skills, interactionMode: state.root.interactionMode },
          },
    );
  },
  toggleRootPlanInteraction: () => {
    set((state) => ({
      ...state,
      root: {
        ...state.root,
        interactionMode: state.root.interactionMode === "plan" ? "default" : "plan",
      },
    }));
  },
  setActiveInteractionMode: (mode) => {
    set((state) => {
      if (state.cur === null) {
        return {
          ...state,
          root: { ...state.root, interactionMode: mode },
        };
      }
      const item = state.items[state.cur];
      if (!item) return state;
      return {
        ...state,
        items: {
          ...state.items,
          [state.cur]: { ...item, interactionMode: mode },
        },
      };
    });
  },
  drop: (id) => {
    set((state) => {
      if (!(id in state.items)) return state;
      const items = { ...state.items };
      delete items[id];
      return {
        ...state,
        cur: state.cur === id ? null : state.cur,
        items,
      };
    });
  },
  promote: (id) => {
    set((state) => {
      if (!(id in state.items)) return state;
      const items = { ...state.items };
      delete items[id];
      return {
        ...state,
        cur: state.cur === id ? null : state.cur,
        items,
      };
    });
  },
}));
