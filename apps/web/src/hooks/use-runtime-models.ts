import type { HarnessModelRef, ThinkingLevel } from "@glass/contracts";
import { useMemo } from "react";
import { usePiCfg, usePiCfgStatus, type ThreadBootStatus } from "../lib/thread-session-store";
import {
  hasStoredPiDefault,
  listPiModelsFromConfig,
  readPiDefaultsFromConfig,
  resolvePiDefaultModelFromConfig,
  resolvePiDefaultThinkingLevelFromConfig,
  type PiModelItem,
} from "../lib/runtime-models";

interface PiModelState {
  items: PiModelItem[];
  loading: boolean;
  status: ThreadBootStatus;
  thinkingLevel: ThinkingLevel;
}

interface PiDefaultState extends PiModelState {
  model: PiModelItem | HarnessModelRef | null;
  stored: boolean;
}

export function useRuntimeModels(cur?: HarnessModelRef | null) {
  const cfg = usePiCfg();
  const status = usePiCfgStatus();
  const provider = cur?.provider ?? "";
  const id = cur?.id ?? "";

  return useMemo(() => {
    if (status !== "ready" || !cfg) {
      return {
        items: [],
        loading: status === "loading",
        status,
        thinkingLevel: "off",
      } satisfies PiModelState;
    }

    const ref = provider && id ? { provider, id } : null;
    return {
      items: listPiModelsFromConfig(cfg, ref),
      loading: false,
      status,
      thinkingLevel: resolvePiDefaultThinkingLevelFromConfig(cfg),
    } satisfies PiModelState;
  }, [cfg, id, provider, status]);
}

export function useRuntimeDefaults() {
  const cfg = usePiCfg();
  const status = usePiCfgStatus();

  return useMemo(() => {
    if (status !== "ready" || !cfg) {
      return {
        items: [],
        model: null,
        thinkingLevel: "off",
        stored: false,
        loading: status === "loading",
        status,
      } satisfies PiDefaultState;
    }

    const model = resolvePiDefaultModelFromConfig(cfg);
    const defs = readPiDefaultsFromConfig(cfg);
    return {
      items: listPiModelsFromConfig(cfg, model),
      model,
      thinkingLevel: resolvePiDefaultThinkingLevelFromConfig(cfg),
      stored: hasStoredPiDefault(defs),
      loading: false,
      status,
    } satisfies PiDefaultState;
  }, [cfg, status]);
}
