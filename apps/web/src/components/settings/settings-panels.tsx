import type { PiConfig } from "@glass/contracts";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconArrowRotateCounterClockwise } from "central-icons";

import { useGlassAppearance } from "../../hooks/use-glass-appearance";
import { usePiDefaults } from "../../hooks/use-pi-models";
import { useShellState } from "../../hooks/use-shell-cwd";
import { useTheme } from "../../hooks/use-theme";
import { getGlass } from "../../host";
import {
  clearPiDefaultModel,
  readPiApiKey,
  startPiOAuthLogin,
  writePiApiKey,
  writePiDefaultModel,
  writePiDefaultThinkingLevel,
} from "../../lib/pi-models";
import { PI_GLASS_SHELL_CHANGED_EVENT } from "../../lib/pi-glass-constants";
import {
  type ColorPaletteId,
  resetGlassAppearance,
  setCodeFontFamily,
  setCodeFontSize,
  setColorPalette,
  setReduceTransparency,
  setTintHue,
  setTintSaturation,
  setUiFontFamily,
  setUiFontSize,
  setWindowTransparency,
} from "../../lib/glass-appearance";
import { usePiCfg, usePiCfgStatus, usePiStore } from "../../lib/pi-session-store";
import { cn } from "../../lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { GlassSelect } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { GlassOpenPicker } from "../glass/open-picker";
import { GlassTintPopover } from "../glass/tint-popover";
import { PiModelPicker } from "../glass/pi-model-picker";

const levels = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
function SettingsSection(props: { label: string; children: ReactNode }) {
  return (
    <div className="mt-8 first:mt-0">
      <div data-glass-settings-section className="mb-2 font-medium text-muted-foreground">
        {props.label}
      </div>
      <div className="divide-y divide-border/70 border-border/70 border-b">{props.children}</div>
    </div>
  );
}

function SettingsRow(props: { label: string; description: string; control?: ReactNode }) {
  return (
    <div className="flex min-h-14 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <div data-glass-settings-label className="font-medium text-foreground">
          {props.label}
        </div>
        <div data-glass-settings-description className="mt-0.5 text-muted-foreground">
          {props.description}
        </div>
      </div>
      {props.control != null ? (
        <div className="shrink-0 sm:max-w-[min(100%,20rem)] sm:justify-end">{props.control}</div>
      ) : null}
    </div>
  );
}

function FontInput(props: {
  value: string;
  placeholder: string;
  className?: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(props.value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const last = useRef(props.value);

  if (props.value !== last.current) {
    last.current = props.value;
    setDraft(props.value);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function commit(v: string) {
    clearTimeout(timer.current);
    last.current = v.trim();
    props.onCommit(v);
  }

  return (
    <Input
      className={props.className}
      value={draft}
      placeholder={props.placeholder}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(v), 400);
      }}
      onBlur={() => commit(draft)}
    />
  );
}

function scale(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function ToneSlider(props: {
  value: number;
  min: number;
  max: number;
  track: string;
  suffix?: string;
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
}) {
  const left = scale(props.value, props.min, props.max);

  return (
    <div className={cn("flex min-w-[16rem] items-center gap-3", props.disabled && "opacity-50")}>
      <div className="relative flex h-10 min-w-[14rem] flex-1 items-center rounded-full">
        <div
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-[18px] -translate-y-1/2 rounded-full bg-foreground/10 dark:bg-foreground/12"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-[18px] -translate-y-1/2 rounded-full border border-glass-stroke/60 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-white)_18%,transparent)]"
          style={{ background: props.track }}
        />
        <div
          aria-hidden
          className="absolute top-1/2 h-[18px] w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-glass-border/60 bg-background shadow-[0_4px_14px_rgb(0_0_0/0.14)] dark:shadow-[0_4px_14px_rgb(0_0_0/0.35)]"
          style={{ left: `${left}%` }}
        />
        <input
          type="range"
          min={props.min}
          max={props.max}
          step={1}
          value={props.value}
          disabled={props.disabled}
          aria-label={props.label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:outline-none disabled:cursor-not-allowed"
          onChange={(event) => props.onChange(Number(event.target.value))}
        />
      </div>
      <span className="min-w-11 text-right font-medium tabular-nums text-body text-foreground">
        {props.value}
        {props.suffix ?? ""}
      </span>
    </div>
  );
}

function AppearancePage() {
  const theme = useTheme();
  const g = useGlassAppearance();
  const tintOff = g.palette !== "glass";
  const transparencyTrack =
    "linear-gradient(90deg, color-mix(in srgb, var(--glass-base-surface) 96%, var(--background)), color-mix(in srgb, var(--glass-base-surface) 54%, transparent))";

  return (
    <div className="glass-settings-page mx-auto w-full max-w-2xl px-1 py-2">
      <h1 className="font-semibold text-foreground tracking-tight" data-glass-settings-title>
        Appearance
      </h1>
      <p className="mt-1 text-muted-foreground" data-glass-settings-lead>
        Customize how Glass looks and feels.
      </p>

      <SettingsSection label="Theme">
        <SettingsRow
          label="Appearance mode"
          description="Match the system, or use light or dark."
          control={
            <GlassSelect
              value={theme.theme}
              onValueChange={(v) => theme.setTheme(v as "system" | "light" | "dark")}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          }
        />
        <SettingsRow
          label="Color palette"
          description="Glass default or Pierre colors for the workbench."
          control={
            <GlassSelect
              value={g.palette}
              onValueChange={(v) => setColorPalette(v as ColorPaletteId)}
              options={[
                { value: "glass", label: "Glass default" },
                { value: "pierre", label: "Pierre" },
              ]}
            />
          }
        />
      </SettingsSection>

      <SettingsSection label="Glass Window">
        <SettingsRow
          label="Window transparency"
          description="Higher values let more of the Electron glass show through the shell surfaces."
          control={
            <ToneSlider
              label="Window transparency"
              min={0}
              max={100}
              track={transparencyTrack}
              value={g.transparency}
              onChange={setWindowTransparency}
            />
          }
        />
        <SettingsRow
          label="Hue and saturation"
          description={
            tintOff
              ? "Available when the Glass default palette is active. Values are kept while you use Pierre."
              : "Open the picker and drag in the field to shift hue and saturation without changing light or dark mode."
          }
          control={
            <GlassTintPopover
              disabled={tintOff}
              hue={g.hue}
              saturation={g.saturation}
              onHueChange={setTintHue}
              onSatChange={setTintSaturation}
            />
          }
        />
        <SettingsRow
          label="Reduce transparency"
          description="Replace translucent surfaces with opaque backgrounds."
          control={
            <Switch checked={g.reduceTransparency} onCheckedChange={setReduceTransparency} />
          }
        />
      </SettingsSection>

      <SettingsSection label="Typography">
        <SettingsRow
          label="UI font size"
          description="Base size for the Glass interface."
          control={
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="size-9 px-0"
                onClick={() => setUiFontSize(Math.max(11, g.uiFontSize - 1))}
              >
                −
              </Button>
              <span className="min-w-8 text-center tabular-nums" data-glass-settings-number>
                {g.uiFontSize}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="size-9 px-0"
                onClick={() => setUiFontSize(Math.min(16, g.uiFontSize + 1))}
              >
                +
              </Button>
            </div>
          }
        />
        <SettingsRow
          label="Code font size"
          description="Font size for code editors and diffs."
          control={
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="size-9 px-0"
                onClick={() => setCodeFontSize(Math.max(10, g.codeFontSize - 1))}
              >
                −
              </Button>
              <span className="min-w-8 text-center tabular-nums" data-glass-settings-number>
                {g.codeFontSize}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="size-9 px-0"
                onClick={() => setCodeFontSize(Math.min(18, g.codeFontSize + 1))}
              >
                +
              </Button>
            </div>
          }
        />
        <SettingsRow
          label="UI font family"
          description="Override the Glass interface typeface (comma-separated stack)."
          control={
            <FontInput
              className="min-w-[12rem] font-sans"
              value={g.uiFont}
              placeholder="Inter, system-ui, sans-serif"
              onCommit={setUiFontFamily}
            />
          }
        />
        <SettingsRow
          label="Code font family"
          description="Override the font for code and diffs."
          control={
            <FontInput
              className="min-w-[12rem] font-mono text-body"
              value={g.codeFont}
              placeholder='"Berkeley Mono", ui-monospace, monospace'
              onCommit={setCodeFontFamily}
            />
          }
        />
      </SettingsSection>
    </div>
  );
}

function WorkspaceRows() {
  const shell = useShellState();
  const reset = usePiStore((item) => item.resetForWorkspaceChange);

  return (
    <>
      <SettingsRow
        label="Current folder"
        description="Workspace used for agents and tools."
        control={
          <span className="max-w-xs truncate text-right text-body" title={shell.cwd ?? ""}>
            {shell.cwd ?? "Not available"}
          </span>
        }
      />
      <SettingsRow
        label="Actions"
        description="Pick a folder or open the current workspace in your editor."
        control={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void getGlass()
                  .shell.pickWorkspace()
                  .then((state) => {
                    if (!state) return;
                    reset();
                    window.dispatchEvent(new CustomEvent(PI_GLASS_SHELL_CHANGED_EVENT));
                  })
                  .catch(() => {
                    void Promise.all([
                      usePiStore.getState().refreshCfg(),
                      usePiStore.getState().refreshSums(),
                    ]);
                  });
              }}
            >
              Choose workspace
            </Button>
            <GlassOpenPicker variant="settings" />
          </div>
        }
      />
    </>
  );
}

function DefaultsSection() {
  const defaults = usePiDefaults();
  const hasReasoning = useMemo(
    () => defaults.items.some((item) => item.reasoning),
    [defaults.items],
  );

  return (
    <>
      <SettingsRow
        label="Global Pi mode"
        description="Default model and reasoning for new sessions. Shown here so you do not need the hero picker."
        control={
          <div className="flex min-w-0 max-w-md flex-col items-end gap-2">
            <PiModelPicker
              variant="settings"
              items={defaults.items}
              status={defaults.status}
              selection={{ model: defaults.model, thinkingLevel: defaults.thinkingLevel }}
              disabled={defaults.status !== "ready"}
              onSelect={(item) => {
                void writePiDefaultModel(item);
              }}
              {...(hasReasoning
                ? {
                    onThinkingLevel: (level: (typeof levels)[number]) => {
                      void writePiDefaultThinkingLevel(level);
                    },
                  }
                : {})}
            />
            {defaults.status === "ready" && !hasReasoning ? (
              <GlassSelect
                value={defaults.thinkingLevel}
                onValueChange={(v) => {
                  void writePiDefaultThinkingLevel(v as (typeof levels)[number]);
                }}
                options={levels.map((item) => ({ value: item, label: item }))}
              />
            ) : null}
          </div>
        }
      />
      <SettingsRow
        label="Reset Pi defaults"
        description="Clear saved default model and thinking level."
        control={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              void clearPiDefaultModel();
              void writePiDefaultThinkingLevel("off");
            }}
          >
            <IconArrowRotateCounterClockwise className="size-3.5" />
            Reset
          </Button>
        }
      />
    </>
  );
}

function KeysSection() {
  const cfg = usePiCfg();
  const status = usePiCfgStatus();
  const [active, setActive] = useState("");
  const [query, setQuery] = useState("");
  const [value, setValue] = useState("");
  const [stored, setStored] = useState(false);
  const [oauthBusy, setOauthBusy] = useState("");

  const providers = useMemo(
    () =>
      cfg?.providers.toSorted((left, right) => left.provider.localeCompare(right.provider)) ?? [],
    [cfg],
  );

  const connected = useMemo(
    () => providers.filter((item) => item.credentialType != null),
    [providers],
  );

  const discover = useMemo(
    () => providers.filter((item) => item.credentialType == null),
    [providers],
  );

  const filteredDiscover = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return discover;
    return discover.filter((item) => item.provider.toLowerCase().includes(q));
  }, [discover, query]);

  useEffect(() => {
    if (active && providers.some((item) => item.provider === active)) return;
    if (connected[0]) {
      setActive(connected[0].provider);
      return;
    }
    if (discover[0]) {
      setActive(discover[0].provider);
      return;
    }
    setActive("");
  }, [active, connected, discover, providers]);

  const cur = providers.find((item) => item.provider === active) ?? null;

  useEffect(() => {
    if (!active || status !== "ready") {
      setStored(false);
      return;
    }
    let live = true;
    void readPiApiKey(active).then((key) => {
      if (!live) return;
      setStored(Boolean(key));
      setValue("");
    });
    return () => {
      live = false;
    };
  }, [active, status]);

  const oauthBlock =
    cur?.credentialType === "oauth" ||
    (cur != null && cur.oauthSupported && cur.credentialType !== "api_key");

  return (
    <>
      <SettingsRow
        label="Connected accounts"
        description="Providers with a stored API key or OAuth session in Pi."
        control={
          status === "loading" ? (
            <p className="max-w-md text-right text-muted-foreground text-body">
              Loading providers…
            </p>
          ) : status === "error" ? (
            <p className="max-w-md text-right text-muted-foreground text-body">
              Unable to load providers.
            </p>
          ) : connected.length === 0 ? (
            <p className="max-w-md text-right text-muted-foreground text-body">
              None yet. Add a provider below.
            </p>
          ) : (
            <ul className="flex w-full max-w-md flex-col gap-1">
              {connected.map((item) => (
                <li key={item.provider}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setActive(item.provider)}
                    className={cn(
                      "flex h-auto w-full items-center justify-between gap-2 rounded-glass-control border px-3 py-2 text-left text-body font-normal",
                      active === item.provider
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/80 bg-background hover:bg-muted/40",
                    )}
                  >
                    <span className="min-w-0 truncate font-medium">{item.provider}</span>
                    <span className="shrink-0 rounded-glass-control bg-muted px-2 py-0.5 text-muted-foreground text-detail">
                      {item.credentialType === "oauth" ? "OAuth" : "API key"}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )
        }
      />
      {cur && active && status === "ready" ? (
        oauthBlock ? (
          <SettingsRow
            label={`${active} · auth`}
            description="OAuth-managed in Pi."
            control={
              <p className="max-w-sm text-right text-muted-foreground text-body">
                {cur.oauthSupported
                  ? `Uses OAuth${stored ? " and is signed in." : "."} You can re-authenticate from “Add a provider” if needed.`
                  : `Uses OAuth-style credentials from your local Pi config.`}
              </p>
            }
          />
        ) : (
          <SettingsRow
            label={`${active} · API key`}
            description={stored ? "A key is stored locally." : "No key stored yet."}
            control={
              <div className="flex w-full min-w-[min(100%,20rem)] max-w-md flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="password"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={`Set key for ${active}`}
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  disabled={!value.trim()}
                  onClick={() => {
                    if (!value.trim()) return;
                    void writePiApiKey(active, value.trim()).then(() => {
                      setStored(true);
                      setValue("");
                    });
                  }}
                >
                  Save
                </Button>
              </div>
            }
          />
        )
      ) : null}
      <SettingsRow
        label="Add a provider"
        description="Search providers you have not connected yet. OAuth opens your browser; API keys are saved locally."
        control={
          <div className="flex w-full max-w-md flex-col gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search providers…"
              className="w-full"
              disabled={status !== "ready"}
            />
            {status === "loading" ? (
              <p className="text-muted-foreground text-body">Loading providers…</p>
            ) : status === "error" ? (
              <p className="text-muted-foreground text-body">Unable to load providers.</p>
            ) : (
              <ul className="max-h-60 space-y-1 overflow-y-auto pr-0.5">
                {filteredDiscover.length === 0 ? (
                  <li className="text-muted-foreground text-body">No matching providers.</li>
                ) : (
                  filteredDiscover.map((item) => (
                    <li
                      key={item.provider}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-glass-control border border-border/70 bg-background px-3 py-2"
                    >
                      <span className="min-w-0 truncate font-mono text-body">{item.provider}</span>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {item.oauthSupported ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={oauthBusy === item.provider}
                            onClick={() => {
                              setOauthBusy(item.provider);
                              void startPiOAuthLogin(item.provider)
                                .catch(() => {})
                                .finally(() => setOauthBusy(""));
                            }}
                          >
                            {oauthBusy === item.provider ? "Signing in…" : "Connect with OAuth"}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setActive(item.provider)}
                          >
                            Add API key
                          </Button>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        }
      />
    </>
  );
}

function scopeLabel(scope: PiConfig["extensions"][number]["scope"]) {
  if (scope === "project") return "Workspace";
  if (scope === "user") return "User";
  return "Other";
}

export function ExtensionsSettingsPanel() {
  const cfg = usePiCfg();
  const status = usePiCfgStatus();
  const exts = useMemo(
    () =>
      cfg?.extensions.toSorted(
        (left, right) =>
          left.name.localeCompare(right.name) ||
          left.resolvedPath.localeCompare(right.resolvedPath),
      ) ?? [],
    [cfg],
  );
  const errs = useMemo(
    () =>
      cfg?.extensionErrors.toSorted(
        (left, right) =>
          left.path.localeCompare(right.path) || left.error.localeCompare(right.error),
      ) ?? [],
    [cfg],
  );

  return (
    <div className="glass-settings-page mx-auto w-full max-w-2xl px-1 py-2">
      <h1 className="font-semibold text-foreground tracking-tight" data-glass-settings-title>
        Extensions
      </h1>
      <p className="mt-1 text-muted-foreground" data-glass-settings-lead>
        Extensions Pi discovers from the workspace and user agent directories.
      </p>
      <SettingsSection label="Discovery">
        <SettingsRow
          label="Sources"
          description="Glass now follows Pi's standard extension discovery. Workspace `.pi/extensions` and user `~/.pi/agent/extensions` folders are loaded directly by the runtime."
        />
      </SettingsSection>
      <SettingsSection label="Loaded">
        {status === "loading" ? (
          <div className="py-3 text-muted-foreground text-body">Loading extensions…</div>
        ) : status === "error" ? (
          <div className="py-3 text-muted-foreground text-body">Unable to load extensions.</div>
        ) : exts.length === 0 ? (
          <div className="py-3 text-muted-foreground text-body">No extensions discovered.</div>
        ) : (
          <ul className="space-y-2 py-3">
            {exts.map((item) => (
              <li
                key={item.resolvedPath}
                className="rounded-glass-control border border-border/70 bg-background px-3 py-2"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-body">{item.name}</div>
                    <div
                      className="mt-1 truncate font-mono text-detail text-muted-foreground"
                      title={item.path}
                    >
                      {item.path}
                    </div>
                    <div
                      className="mt-1 truncate text-muted-foreground/80 text-detail"
                      title={item.resolvedPath}
                    >
                      {item.resolvedPath}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-glass-control bg-muted px-2 py-0.5 text-muted-foreground text-detail">
                    {scopeLabel(item.scope)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
      {errs.length > 0 ? (
        <SettingsSection label="Load issues">
          <ul className="space-y-2 py-3">
            {errs.map((item) => (
              <li
                key={`${item.path}:${item.error}`}
                className="rounded-glass-control border border-border/70 bg-background px-3 py-2"
              >
                <div className="truncate font-mono text-detail text-foreground" title={item.path}>
                  {item.path}
                </div>
                <div className="mt-1 text-muted-foreground text-body">{item.error}</div>
              </li>
            ))}
          </ul>
        </SettingsSection>
      ) : null}
    </div>
  );
}

export function AppearanceSettingsPanel() {
  return <AppearancePage />;
}

export function AgentsSettingsPanel() {
  return (
    <div className="glass-settings-page mx-auto w-full max-w-2xl px-1 py-2">
      <h1 className="font-semibold text-foreground tracking-tight" data-glass-settings-title>
        Agents
      </h1>
      <p className="mt-1 text-muted-foreground" data-glass-settings-lead>
        Defaults and credentials for Pi.
      </p>
      <SettingsSection label="Workspace">
        <WorkspaceRows />
      </SettingsSection>
      <SettingsSection label="Pi defaults">
        <DefaultsSection />
      </SettingsSection>
      <SettingsSection label="Provider keys">
        <KeysSection />
      </SettingsSection>
    </div>
  );
}

/** @deprecated Prefer AppearanceSettingsPanel + AgentsSettingsPanel routes */
export function GeneralSettingsPanel() {
  return (
    <div className="space-y-6">
      <AppearancePage />
      <div className="glass-settings-page mx-auto w-full max-w-2xl px-1 py-2">
        <SettingsSection label="Workspace">
          <WorkspaceRows />
        </SettingsSection>
        <SettingsSection label="Pi defaults">
          <DefaultsSection />
        </SettingsSection>
        <SettingsSection label="Provider keys">
          <KeysSection />
        </SettingsSection>
      </div>
    </div>
  );
}

export function ArchivedThreadsPanel() {
  return (
    <div className="glass-settings-page mx-auto w-full max-w-2xl px-1 py-2">
      <h1 className="font-semibold text-foreground tracking-tight" data-glass-settings-title>
        Archived
      </h1>
      <p className="mt-1 text-muted-foreground" data-glass-settings-lead>
        Archived thread behavior.
      </p>
      <SettingsSection label="Threads">
        <SettingsRow
          label="Archived threads"
          description="Glass no longer keeps a separate archived-thread domain."
        />
      </SettingsSection>
    </div>
  );
}

export function useSettingsRestore(onRestore?: () => void) {
  const defaults = usePiDefaults();
  const theme = useTheme();
  const glass = useGlassAppearance();

  const changedSettingLabels = useMemo(() => {
    const out = [];
    if (theme.theme !== "system") out.push("Theme");
    const appearanceDirty =
      glass.palette !== "glass" ||
      glass.reduceTransparency ||
      glass.transparency !== 18 ||
      glass.hue !== 255 ||
      glass.saturation !== 33 ||
      glass.uiFontSize !== 13 ||
      glass.codeFontSize !== 12 ||
      Boolean(glass.uiFont) ||
      Boolean(glass.codeFont);
    if (appearanceDirty) out.push("Appearance");
    if (defaults.stored) out.push("Pi defaults");
    if (defaults.thinkingLevel !== "off") out.push("Thinking");
    return out;
  }, [
    defaults.stored,
    defaults.thinkingLevel,
    theme.theme,
    glass.palette,
    glass.reduceTransparency,
    glass.transparency,
    glass.hue,
    glass.saturation,
    glass.uiFontSize,
    glass.codeFontSize,
    glass.uiFont,
    glass.codeFont,
  ]);

  const restoreDefaults = async () => {
    theme.setTheme("system");
    resetGlassAppearance();
    await clearPiDefaultModel();
    await writePiDefaultThinkingLevel("off");
    onRestore?.();
  };

  return { changedSettingLabels, restoreDefaults };
}
