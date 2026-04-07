import type { HarnessDescriptor, HarnessKind } from "@glass/contracts";
import { useEffect, useMemo, useState } from "react";
import { readGlass } from "../host";

export interface HarnessState {
  descriptors: HarnessDescriptor[];
  defaultKind: HarnessKind;
  loading: boolean;
  error: string | null;
}

export function useHarnessList(): HarnessState {
  const [state, setState] = useState<HarnessState>({
    descriptors: [],
    defaultKind: "pi",
    loading: true,
    error: null,
  });

  useEffect(() => {
    const glass = readGlass();
    if (!glass) {
      setState((s) => ({ ...s, loading: false, error: "Glass bridge not found" }));
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [descriptors, defaultKind] = await Promise.all([
          glass!.harness.list(),
          glass!.harness.getDefault(),
        ]);
        if (!cancelled) {
          setState({
            descriptors,
            defaultKind,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          }));
        }
      }
    }

    load();

    const off = glass!.harness.onChange((descriptors) => {
      setState((s) => ({ ...s, descriptors }));
    });

    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return state;
}

export function useHarnessDescriptor(kind: HarnessKind): HarnessDescriptor | null {
  const { descriptors } = useHarnessList();
  return useMemo(() => descriptors.find((d) => d.kind === kind) ?? null, [descriptors, kind]);
}

export async function setHarnessEnabled(kind: HarnessKind, enabled: boolean): Promise<void> {
  const glass = readGlass();
  if (!glass) throw new Error("Glass bridge not found");
  await glass.harness.setEnabled(kind, enabled);
}

export async function setDefaultHarness(kind: HarnessKind): Promise<void> {
  const glass = readGlass();
  if (!glass) throw new Error("Glass bridge not found");
  await glass.harness.setDefault(kind);
}
