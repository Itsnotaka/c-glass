import type { ProviderKind, ProviderNoticeKind } from "@glass/contracts";
import { create } from "zustand";

type Force = {
  seq: number;
  kind: ProviderNoticeKind;
  provider: ProviderKind | null;
};

type State = {
  force: Force | null;
  logs: boolean;
  all: boolean;
  raw: boolean;
  show: (kind: ProviderNoticeKind, provider?: ProviderKind | null) => void;
  clear: () => void;
  setLogs: (on: boolean) => void;
  setAll: (on: boolean) => void;
  setRaw: (on: boolean) => void;
};

export const useProviderNoticeDevStore = create<State>()((set) => ({
  force: null,
  logs: false,
  all: false,
  raw: false,
  show: (kind, provider = null) => {
    set((state) => ({
      ...state,
      force: {
        seq: (state.force?.seq ?? 0) + 1,
        kind,
        provider,
      },
    }));
  },
  clear: () => {
    set((state) => (state.force === null ? state : { ...state, force: null }));
  },
  setLogs: (on) => {
    set((state) => (state.logs === on ? state : { ...state, logs: on }));
  },
  setAll: (on) => {
    set((state) => (state.all === on ? state : { ...state, all: on }));
  },
  setRaw: (on) => {
    set((state) => (state.raw === on ? state : { ...state, raw: on }));
  },
}));
