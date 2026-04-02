import type { ShellState } from "@glass/contracts";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RotateCcwIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { PiModelPicker } from "../glass/pi-model-picker";
import { usePiDefaults } from "../../hooks/use-pi-models";
import { useTheme } from "../../hooks/use-theme";
import { getGlass } from "../../host";
import {
  clearPiDefaultModel,
  listPiProviders,
  readPiApiKey,
  type PiProviderItem,
  writePiApiKey,
  writePiDefaultModel,
  writePiDefaultThinkingLevel,
} from "../../lib/pi-models";
import {
  PI_GLASS_SETTINGS_CHANGED_EVENT,
  PI_GLASS_SHELL_CHANGED_EVENT,
} from "../../lib/pi-glass-constants";
import { resolveAndPersistPreferredEditor } from "../../editor-preferences";

const levels = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

function Panel(props: { title: string; body: ReactNode; foot?: ReactNode }) {
  return (
    <section className="rounded-xl border border-glass-border/80 bg-glass-hover/30 p-4 backdrop-blur-sm">
      <div className="text-sm font-medium text-foreground">{props.title}</div>
      <div className="mt-3">{props.body}</div>
      {props.foot ? <div className="mt-3">{props.foot}</div> : null}
    </section>
  );
}

function ThemePanel() {
  const theme = useTheme();

  return (
    <Panel
      title="Theme"
      body={
        <div className="flex flex-wrap gap-2">
          {(["system", "light", "dark"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={theme.theme === item ? "default" : "outline"}
              onClick={() => theme.setTheme(item)}
            >
              {item[0]?.toUpperCase()}
              {item.slice(1)}
            </Button>
          ))}
        </div>
      }
    />
  );
}

function WorkspacePanel() {
  const [state, setState] = useState<ShellState | null>(null);

  useEffect(() => {
    let live = true;

    const load = () => {
      void getGlass()
        .shell.getState()
        .then((next) => {
          if (!live) return;
          setState(next);
        })
        .catch(() => {});
    };

    load();
    window.addEventListener(PI_GLASS_SHELL_CHANGED_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(PI_GLASS_SHELL_CHANGED_EVENT, load);
    };
  }, []);

  return (
    <Panel
      title="Workspace"
      body={
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground">Current</div>
            <div className="mt-1 break-all text-foreground">{state?.cwd ?? "Not available"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void getGlass()
                  .shell.pickWorkspace()
                  .then((next) => {
                    if (!next) return;
                    setState(next);
                    window.dispatchEvent(new CustomEvent(PI_GLASS_SHELL_CHANGED_EVENT));
                  });
              }}
            >
              Choose workspace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!state?.cwd}
              onClick={() => {
                if (!state?.cwd) return;
                const editor = resolveAndPersistPreferredEditor(state.availableEditors);
                if (!editor) return;
                void getGlass().shell.openInEditor(state.cwd, editor);
              }}
            >
              Open in editor
            </Button>
          </div>
        </div>
      }
    />
  );
}

function DefaultsPanel() {
  const defaults = usePiDefaults();

  return (
    <Panel
      title="Pi Defaults"
      body={
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm text-muted-foreground">Model</div>
            <PiModelPicker
              items={defaults.items}
              model={defaults.model}
              disabled={defaults.loading}
              align="start"
              onSelect={(item) => {
                void writePiDefaultModel(item);
              }}
            />
          </div>
          <div>
            <div className="mb-2 text-sm text-muted-foreground">Thinking</div>
            <div className="flex flex-wrap gap-2">
              {levels.map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={defaults.thinkingLevel === item ? "default" : "outline"}
                  onClick={() => {
                    void writePiDefaultThinkingLevel(item);
                  }}
                >
                  {item}
                </Button>
              ))}
            </div>
          </div>
        </div>
      }
      foot={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            void clearPiDefaultModel();
            void writePiDefaultThinkingLevel("off");
          }}
        >
          <RotateCcwIcon className="size-3.5" />
          Reset Pi defaults
        </Button>
      }
    />
  );
}

function KeysPanel() {
  const [providers, setProviders] = useState<PiProviderItem[]>([]);
  const [provider, setProvider] = useState("");
  const [value, setValue] = useState("");
  const [stored, setStored] = useState(false);

  useEffect(() => {
    let live = true;

    const load = () => {
      void listPiProviders().then((next) => {
        if (!live) return;
        setProviders(next);
      });
    };

    load();
    window.addEventListener(PI_GLASS_SETTINGS_CHANGED_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(PI_GLASS_SETTINGS_CHANGED_EVENT, load);
    };
  }, []);

  const cur = providers.find((item) => item.provider === provider) ?? null;

  useEffect(() => {
    if (provider) return;
    if (!providers[0]) return;
    setProvider(providers[0].provider);
  }, [provider, providers]);

  useEffect(() => {
    if (!provider) {
      setStored(false);
      return;
    }
    let live = true;
    void readPiApiKey(provider).then((key) => {
      if (!live) return;
      setStored(Boolean(key));
      setValue("");
    });
    return () => {
      live = false;
    };
  }, [provider]);

  return (
    <Panel
      title="Provider Keys"
      body={
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-2 text-muted-foreground">Provider</div>
            <div className="flex flex-wrap gap-2">
              {providers.map((item) => (
                <Button
                  key={item.provider}
                  type="button"
                  size="sm"
                  variant={provider === item.provider ? "default" : "outline"}
                  onClick={() => setProvider(item.provider)}
                >
                  {item.provider}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {cur?.credentialType === "oauth" || cur?.oauthSupported ? (
              <div className="rounded-lg border border-glass-border/80 bg-muted/20 px-3 py-2 text-muted-foreground">
                {cur.oauthSupported
                  ? `This provider uses OAuth in Pi${stored ? " and is currently logged in." : "."}`
                  : `This provider is currently using OAuth-style credentials from your local Pi config${stored ? "." : ", but Glass will not overwrite them as an API key."}`}
              </div>
            ) : (
              <>
                <div className="text-muted-foreground">
                  API key {stored ? "(stored)" : "(missing)"}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder={provider ? `Set key for ${provider}` : "Choose a provider"}
                    disabled={!provider}
                  />
                  <Button
                    type="button"
                    disabled={!provider || !value.trim()}
                    onClick={() => {
                      if (!provider || !value.trim()) return;
                      void writePiApiKey(provider, value.trim()).then(() => {
                        setStored(true);
                        setValue("");
                      });
                    }}
                  >
                    Save
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      }
    />
  );
}

export function GeneralSettingsPanel() {
  return (
    <div className="space-y-4 px-1 py-1">
      <ThemePanel />
      <WorkspacePanel />
      <DefaultsPanel />
      <KeysPanel />
    </div>
  );
}

export function ArchivedThreadsPanel() {
  return (
    <Panel
      title="Archived Threads"
      body={
        <p className="text-sm text-muted-foreground">
          Glass no longer keeps a separate archived-thread domain.
        </p>
      }
    />
  );
}

export function useSettingsRestore(onRestore?: () => void) {
  const defaults = usePiDefaults();
  const theme = useTheme();

  const changedSettingLabels = useMemo(() => {
    const out = [];
    if (theme.theme !== "system") out.push("Theme");
    if (defaults.stored) out.push("Pi defaults");
    if (defaults.thinkingLevel !== "off") out.push("Thinking");
    return out;
  }, [defaults.stored, defaults.thinkingLevel, theme.theme]);

  const restoreDefaults = async () => {
    theme.setTheme("system");
    await clearPiDefaultModel();
    await writePiDefaultThinkingLevel("off");
    onRestore?.();
  };

  return { changedSettingLabels, restoreDefaults };
}
