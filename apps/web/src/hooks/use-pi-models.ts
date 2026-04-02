import type { PiModelRef } from "@glass/contracts";
import { useEffect, useState } from "react";
import { PI_GLASS_SETTINGS_CHANGED_EVENT } from "../lib/pi-glass-constants";
import {
  hasStoredPiDefault,
  listPiModels,
  readPiDefaults,
  resolvePiDefaultModel,
  resolvePiDefaultThinkingLevel,
  type PiModelItem,
} from "../lib/pi-models";

interface PiModelState {
  items: PiModelItem[];
  loading: boolean;
}

interface PiDefaultState extends PiModelState {
  model: PiModelItem | PiModelRef | null;
  thinkingLevel: string;
  stored: boolean;
}

export function usePiModels(cur?: PiModelRef | null) {
  const [state, setState] = useState<PiModelState>({ items: [], loading: true });
  const provider = cur?.provider ?? "";
  const id = cur?.id ?? "";

  useEffect(() => {
    let live = true;
    const ref = provider && id ? { provider, id } : null;

    const load = () => {
      void listPiModels(ref).then((items) => {
        if (!live) return;
        setState({ items, loading: false });
      });
    };

    load();
    window.addEventListener(PI_GLASS_SETTINGS_CHANGED_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(PI_GLASS_SETTINGS_CHANGED_EVENT, load);
    };
  }, [id, provider]);

  return state;
}

export function usePiDefaults() {
  const [state, setState] = useState<PiDefaultState>({
    items: [],
    model: null,
    thinkingLevel: "off",
    stored: false,
    loading: true,
  });

  useEffect(() => {
    let live = true;

    const load = () => {
      void Promise.all([
        readPiDefaults(),
        resolvePiDefaultModel(),
        resolvePiDefaultThinkingLevel(),
      ]).then(([defs, model, thinkingLevel]) => {
        void listPiModels(model).then((items) => {
          if (!live) return;
          setState({
            items,
            model,
            thinkingLevel,
            stored: hasStoredPiDefault(defs),
            loading: false,
          });
        });
      });
    };

    load();
    window.addEventListener(PI_GLASS_SETTINGS_CHANGED_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(PI_GLASS_SETTINGS_CHANGED_EVENT, load);
    };
  }, []);

  return state;
}
