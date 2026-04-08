import type { HarnessKind } from "@glass/contracts";
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

export interface GlassDraftChat {
  id: string;
  cwd: string;
  harness: HarnessKind;
  text: string;
  files: GlassDraftFile[];
  createdAt: string;
  updatedAt: string;
}

type Root = {
  text: string;
  files: GlassDraftFile[];
};

type State = {
  cur: string | null;
  root: Root;
  items: Record<string, GlassDraftChat>;
  pick: (id: string | null) => void;
  park: (cwd: string, harness: HarnessKind) => string | null;
  save: (id: string, text: string, files: GlassDraftFile[]) => void;
  saveRoot: (text: string, files: GlassDraftFile[]) => void;
  drop: (id: string) => void;
  promote: (id: string) => void;
};

const empty = (): Root => ({ text: "", files: [] });

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
          createdAt: stamp,
          updatedAt: stamp,
        },
      },
    });
    return id;
  },
  save: (id, text, files) => {
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
            updatedAt: now(),
          },
        },
      };
    });
  },
  saveRoot: (text, files) => {
    set((state) =>
      state.root.text === text && state.root.files === files
        ? state
        : {
            ...state,
            root: { text, files },
          },
    );
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
