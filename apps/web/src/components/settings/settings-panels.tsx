import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconArrowRotateCounterClockwise, IconSquareArrowTopRight } from "central-icons";
import type { HarnessDescriptor } from "@glass/contracts";

import { useGlassAppearance } from "../../hooks/use-glass-appearance";
import { useRuntimeDefaults } from "../../hooks/use-runtime-models";
import { useShellState } from "../../hooks/use-shell-cwd";
import { useTheme } from "../../hooks/use-theme";

import { pickWorkspace } from "../../lib/glass-workspace";
import {
  clearPiAuth,
  clearPiDefaultModel,
  startPiOAuthLogin,
  writePiApiKey,
  writePiDefaultModel,
  writePiDefaultThinkingLevel,
} from "../../lib/runtime-models";
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
import { setDefaultHarness, setHarnessEnabled, useHarnessList } from "../../lib/harness-store";
import { usePiCfg, usePiCfgStatus, useThreadSessionStore } from "../../lib/thread-session-store";
import { cn } from "../../lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { GlassSelect } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { GlassOpenPicker } from "../glass/open-picker";
import { GlassTintPopover } from "../glass/tint-popover";
import { GlassModelPicker } from "../glass/model-picker";

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

function scopeLabel(scope: "user" | "project" | "other") {
  if (scope === "project") return "Workspace";
  if (scope === "user") return "User";
  return "Other";
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
      <div className="relative flex h-10 min-w-56 flex-1 items-center rounded-full">
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
              className="min-w-48 font-sans"
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
              size="default"
              variant="outline"
              onClick={() => void pickWorkspace()}
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
  const defaults = useRuntimeDefaults();
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
            <GlassModelPicker
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
  const [query, setQuery] = useState("");
  const [oauthBusy, setOauthBusy] = useState("");
  const [wipe, setWipe] = useState("");
  const [addKey, setAddKey] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState("");

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

  const drop = (provider: string) => {
    if (wipe) return;
    setWipe(provider);
    void clearPiAuth(provider).finally(() => setWipe(""));
  };

  const saveKey = (provider: string) => {
    if (!keyValue.trim()) return;
    void writePiApiKey(provider, keyValue.trim()).then(() => {
      setAddKey(null);
      setKeyValue("");
    });
  };

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
                <li key={item.provider} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 rounded-glass-control border border-border/80 bg-background px-3 py-2">
                    <span className="min-w-0 truncate font-medium text-body">{item.provider}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-w-[5.5rem] justify-center"
                    disabled={Boolean(wipe)}
                    onClick={() => drop(item.provider)}
                  >
                    {wipe === item.provider
                      ? item.credentialType === "oauth"
                        ? "Logging out…"
                        : "Clearing…"
                      : item.credentialType === "oauth"
                        ? "Logout"
                        : "Clear"}
                  </Button>
                </li>
              ))}
            </ul>
          )
        }
      />
      {addKey && (
        <SettingsRow
          label={`${addKey} · API key`}
          description="Enter the API key for this provider."
          control={
            <div className="flex w-full min-w-[min(100%,20rem)] max-w-md flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="password"
                value={keyValue}
                onChange={(event) => setKeyValue(event.target.value)}
                placeholder={`API key for ${addKey}`}
                className="min-w-0 flex-1"
              />
              <Button type="button" disabled={!keyValue.trim()} onClick={() => saveKey(addKey)}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setAddKey(null)}>
                Cancel
              </Button>
            </div>
          }
        />
      )}
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
                      className="flex items-center justify-between gap-2 rounded-glass-control border border-border/70 bg-background px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-body">
                        {item.provider}
                      </span>
                      <div className="flex shrink-0 justify-end">
                        {item.oauthSupported ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-w-[8.5rem] justify-center"
                            disabled={oauthBusy === item.provider}
                            onClick={() => {
                              setOauthBusy(item.provider);
                              void startPiOAuthLogin(item.provider)
                                .catch(() => {})
                                .finally(() => setOauthBusy(""));
                            }}
                          >
                            {oauthBusy === item.provider ? (
                              "Signing in…"
                            ) : (
                              <>
                                Connect <IconSquareArrowTopRight className="size-3.5" />
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-w-[8.5rem] justify-center"
                            onClick={() => setAddKey(item.provider)}
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

function HarnessRow(props: {
  descriptor: HarnessDescriptor;
  isDefault: boolean;
  onToggle: (enabled: boolean) => void;
  onSetDefault: () => void;
}) {
  const { descriptor, isDefault, onToggle, onSetDefault } = props;

  return (
    <div className="flex min-h-14 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="font-medium text-foreground">{descriptor.label}</div>
          {descriptor.version && (
            <span className="text-xs text-muted-foreground">({descriptor.version})</span>
          )}
          {!descriptor.available && (
            <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
              Not installed
            </span>
          )}
        </div>
        <div className="mt-0.5 text-muted-foreground">
          {descriptor.reason || (descriptor.available ? "Available" : "Unavailable")}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="default-harness"
            checked={isDefault}
            onChange={onSetDefault}
            disabled={!descriptor.available || !descriptor.enabled}
            className="h-4 w-4"
          />
          Default
        </label>
        <Switch
          checked={descriptor.enabled}
          onCheckedChange={onToggle}
          disabled={!descriptor.available}
        />
      </div>
    </div>
  );
}

function HarnessListSection() {
  const { descriptors, defaultKind, loading, error } = useHarnessList();

  if (loading) {
    return (
      <SettingsRow
        label="Loading harnesses..."
        description="Fetching available harnesses from the backend."
      />
    );
  }

  if (error) {
    return <SettingsRow label="Error loading harnesses" description={error} />;
  }

  if (descriptors.length === 0) {
    return (
      <SettingsRow
        label="No harnesses available"
        description="No harness adapters are currently registered."
      />
    );
  }

  return (
    <>
      {descriptors.map((desc) => (
        <HarnessRow
          key={desc.kind}
          descriptor={desc}
          isDefault={defaultKind === desc.kind}
          onToggle={(enabled) => setHarnessEnabled(desc.kind, enabled)}
          onSetDefault={() => setDefaultHarness(desc.kind)}
        />
      ))}
    </>
  );
}

function PiDefaultsSection() {
  const piDescriptor = useHarnessList().descriptors.find((d) => d.kind === "pi");
  const hasModelPicker = piDescriptor?.capabilities.modelPicker ?? true;
  const hasThinkingLevels = piDescriptor?.capabilities.thinkingLevels ?? true;

  if (!hasModelPicker && !hasThinkingLevels) return null;

  return (
    <SettingsSection label="Pi defaults">{hasModelPicker && <DefaultsSection />}</SettingsSection>
  );
}

export function AgentsSettingsPanel() {
  return (
    <div className="glass-settings-page mx-auto w-full max-w-2xl px-1 py-2">
      <h1 className="font-semibold text-foreground tracking-tight" data-glass-settings-title>
        Harnesses
      </h1>
      <p className="mt-1 text-muted-foreground" data-glass-settings-lead>
        Configure AI harnesses and their capabilities.
      </p>
      <SettingsSection label="Installed harnesses">
        <HarnessListSection />
      </SettingsSection>
      <SettingsSection label="Workspace">
        <WorkspaceRows />
      </SettingsSection>
      <PiDefaultsSection />
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
        <SettingsSection label="Installed harnesses">
          <HarnessListSection />
        </SettingsSection>
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
  const defaults = useRuntimeDefaults();
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

function mark(name: string) {
  const head = name.trim()[0]?.toUpperCase() ?? "?";
  const num = name.match(/\d+/u)?.[0] ?? "";
  return `${head}${num}`.slice(0, 2);
}

function showPath(path: string, agent: string, cwd: string | null) {
  if (cwd && path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1);
  if (!agent) return path;
  if (path.startsWith(`${agent}/`)) return `~/.pi/agent/${path.slice(agent.length + 1)}`;
  if (!agent.endsWith("/.pi/agent")) return path;
  const home = agent.slice(0, -"/.pi/agent".length);
  if (path.startsWith(`${home}/`)) return `~/${path.slice(home.length + 1)}`;
  return path;
}

export function ExtensionsSettingsPanel() {
  const cfg = usePiCfg();
  const status = usePiCfgStatus();
  const shell = useShellState();
  const refetch = useThreadSessionStore((state) => state.refreshCfg);
  const [tab, setTab] = useState<"all" | "user" | "project">("all");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const exts = useMemo(
    () =>
      cfg?.extensions.toSorted(
        (left, right) =>
          left.name.localeCompare(right.name) ||
          left.scope.localeCompare(right.scope) ||
          left.resolvedPath.localeCompare(right.resolvedPath),
      ) ?? [],
    [cfg],
  );
  const rows = useMemo(() => {
    if (tab === "all") return exts;
    return exts.filter((item) => item.scope === tab);
  }, [exts, tab]);
  const sums = useMemo(
    () => ({
      all: exts.length,
      user: exts.filter((item) => item.scope === "user").length,
      project: exts.filter((item) => item.scope === "project").length,
    }),
    [exts],
  );
  const errs = useMemo(
    () =>
      cfg?.extensionErrors.toSorted(
        (left, right) =>
          left.path.localeCompare(right.path) || left.error.localeCompare(right.error),
      ) ?? [],
    [cfg],
  );

  function toggle(item: (typeof exts)[number], next: boolean) {
    const glass = typeof window !== "undefined" ? window.glass : undefined;
    if (!glass) return;
    if (item.scope !== "user" && item.scope !== "project") return;
    const key = item.resolvedPath;
    setBusy((state) => ({ ...state, [key]: true }));
    void glass.pi
      .setExtensionEnabled(item.resolvedPath, item.scope, next)
      .then(() => refetch())
      .catch(() => {})
      .finally(() => {
        setBusy((state) => {
          const nextState = { ...state };
          delete nextState[key];
          return nextState;
        });
      });
  }

  return (
    <div className="glass-settings-page mx-auto w-full max-w-2xl px-1 py-2">
      <h1 className="font-semibold text-foreground tracking-tight" data-glass-settings-title>
        Extensions
      </h1>
      <p className="mt-1 text-muted-foreground" data-glass-settings-lead>
        Extensions Pi discovers from the workspace and user agent directories.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-1">
        {[
          { id: "all" as const, label: "All", count: sums.all },
          { id: "user" as const, label: "User", count: sums.user },
          { id: "project" as const, label: "Workspace", count: sums.project },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "inline-flex min-h-7 items-center gap-1 rounded-glass-control px-2 py-1 text-body transition-colors",
              tab === item.id
                ? "bg-glass-active text-foreground"
                : "text-muted-foreground hover:bg-glass-hover hover:text-foreground",
            )}
            onClick={() => setTab(item.id)}
          >
            <span>{item.label}</span>
            <span className="rounded-glass-pill bg-muted/70 px-1.5 py-0.5 text-caption text-muted-foreground">
              {item.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        <div data-glass-settings-section className="mb-2 font-medium text-muted-foreground">
          Discovery
        </div>
        <div className="overflow-hidden rounded-glass-card border border-glass-border/40 bg-glass-bubble/55">
          <div className="px-3 py-2.5 text-body text-muted-foreground">
            Glass follows Pi&apos;s standard extension discovery. Workspace{" "}
            <code className="rounded bg-glass-hover/45 px-1 py-0.5 font-mono text-detail text-foreground/88">
              .pi/extensions
            </code>{" "}
            and user{" "}
            <code className="rounded bg-glass-hover/45 px-1 py-0.5 font-mono text-detail text-foreground/88">
              ~/.pi/agent/extensions
            </code>{" "}
            folders are loaded directly by the runtime.
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div data-glass-settings-section className="font-medium text-muted-foreground">
            Discovered
          </div>
          <div className="text-detail text-muted-foreground">{rows.length} shown</div>
        </div>
        {status === "loading" ? (
          <div className="py-3 text-muted-foreground text-body">Loading extensions…</div>
        ) : status === "error" ? (
          <div className="py-3 text-muted-foreground text-body">Unable to load extensions.</div>
        ) : rows.length === 0 ? (
          <div className="py-3 text-muted-foreground text-body">
            {tab === "all" ? "No extensions discovered." : "No extensions in this scope."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-glass-card border border-glass-border/40 bg-glass-bubble/55">
            {rows.map((item, i) => {
              const key = item.resolvedPath;
              const off = item.scope === "other" || Boolean(busy[key]);

              return (
                <div
                  key={key}
                  className={cn(
                    "flex min-w-0 items-center gap-3 px-3 py-2.5",
                    i > 0 && "border-glass-border/35 border-t",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border text-detail font-medium",
                      item.enabled
                        ? "border-emerald-500/22 bg-emerald-500/10 text-emerald-300"
                        : "border-glass-border/45 bg-muted/30 text-muted-foreground/70",
                    )}
                  >
                    {mark(item.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="min-w-0 truncate text-body font-medium text-foreground">
                        {item.name}
                      </div>
                      <span className="shrink-0 rounded-glass-pill bg-muted/70 px-1.5 py-0.5 text-caption text-muted-foreground">
                        {scopeLabel(item.scope)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-2 text-detail text-muted-foreground">
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            item.enabled ? "bg-emerald-400" : "bg-muted-foreground/40",
                          )}
                        />
                        {item.enabled ? "Active" : "Disabled"}
                      </span>
                      <span
                        className="min-w-0 truncate font-mono text-muted-foreground/78"
                        title={item.resolvedPath}
                      >
                        {showPath(item.resolvedPath, cfg?.agentDir ?? "", shell.cwd)}
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={item.enabled}
                    disabled={off}
                    onCheckedChange={(next) => toggle(item, next)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      {errs.length > 0 ? (
        <div className="mt-6">
          <div data-glass-settings-section className="mb-2 font-medium text-muted-foreground">
            Load issues
          </div>
          <div className="overflow-hidden rounded-glass-card border border-glass-border/40 bg-glass-bubble/55">
            {errs.map((item, i) => (
              <div
                key={`${item.path}:${item.error}`}
                className={cn("px-3 py-2.5", i > 0 && "border-glass-border/35 border-t")}
              >
                <div className="truncate font-mono text-detail text-foreground" title={item.path}>
                  {item.path}
                </div>
                <div className="mt-1 text-body text-muted-foreground">{item.error}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppearanceSettingsPanel() {
  return <AppearancePage />;
}
