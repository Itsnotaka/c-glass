import { useEffect, useState } from "react";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import { PI_GLASS_SETTINGS_CHANGED_EVENT } from "../lib/pi-glass-constants";
import {
  hasStoredPiDefault,
  listPiModels,
  readPiDefaults,
  resolvePiDefaultModel,
  resolvePiDefaultThinkingLevel,
  type PiModelItem,
} from "../lib/pi-models";

type PiModelState = {
  items: PiModelItem[];
  loading: boolean;
};

type PiDefaultState = PiModelState & {
  model: Model<any> | null;
  thinkingLevel: ThinkingLevel;
  stored: boolean;
};

export function usePiModels(cur?: Model<any> | null): PiModelState {
  const [state, setState] = useState<PiModelState>({ items: [], loading: true });

  useEffect(() => {
    let live = true;

    const load = () => {
      void listPiModels(cur).then((items) => {
        if (!live) return;
        setState({ items, loading: false });
      });
    };

    load();
    const onChange = () => load();
    window.addEventListener(PI_GLASS_SETTINGS_CHANGED_EVENT, onChange);
    return () => {
      live = false;
      window.removeEventListener(PI_GLASS_SETTINGS_CHANGED_EVENT, onChange);
    };
  }, [cur]);

  return state;
}

export function usePiDefaults(): PiDefaultState {
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
    const onChange = () => load();
    window.addEventListener(PI_GLASS_SETTINGS_CHANGED_EVENT, onChange);
    return () => {
      live = false;
      window.removeEventListener(PI_GLASS_SETTINGS_CHANGED_EVENT, onChange);
    };
  }, []);

  return state;
}
