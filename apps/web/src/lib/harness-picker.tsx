import type { HarnessDescriptor, HarnessKind } from "@glass/contracts";
import { useEffect, useState } from "react";
import { IconCheckmark1Small } from "central-icons";
import { readGlass } from "../host";

export interface DefaultHarnessState {
  kind: HarnessKind;
  descriptor: HarnessDescriptor | null;
  loading: boolean;
}

export function useDefaultHarness(): DefaultHarnessState {
  const [state, setState] = useState<DefaultHarnessState>({
    kind: "pi",
    descriptor: null,
    loading: true,
  });

  useEffect(() => {
    const glass = readGlass();
    if (!glass) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    async function load() {
      try {
        const [descriptors, defaultKind] = await Promise.all([
          glass!.harness.list(),
          glass!.harness.getDefault(),
        ]);
        const descriptor = descriptors.find((d) => d.kind === defaultKind) ?? null;
        setState({
          kind: defaultKind,
          descriptor,
          loading: false,
        });
      } catch {
        setState((s) => ({ ...s, loading: false }));
      }
    }

    load();
  }, []);

  return state;
}

export function HarnessPicker(props: {
  value: HarnessKind;
  onChange: (kind: HarnessKind) => void;
  disabled?: boolean;
}) {
  const [descriptors, setDescriptors] = useState<HarnessDescriptor[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const glass = readGlass();
    if (!glass) return;
    glass.harness.list().then((d) => setDescriptors(d.filter((x) => x.available && x.enabled)));
  }, []);

  const selected = descriptors.find((d) => d.kind === props.value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={props.disabled}
        className="flex items-center gap-2 rounded-glass-card border border-glass-border/40 bg-glass-bubble/60 px-2.5 py-1.5 text-detail font-medium text-foreground/85 hover:bg-glass-hover transition-colors disabled:opacity-40"
      >
        <span className="size-2 rounded-full bg-emerald-500" />
        <span>{selected?.label ?? props.value}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-glass-card border border-glass-border/60 bg-glass-bubble p-1 shadow-glass-card">
          {descriptors.map((d) => (
            <button
              key={d.kind}
              type="button"
              onClick={() => {
                props.onChange(d.kind);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-detail hover:bg-glass-hover"
            >
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="flex-1">{d.label}</span>
              {props.value === d.kind && (
                <IconCheckmark1Small className="size-4 text-foreground/70" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
