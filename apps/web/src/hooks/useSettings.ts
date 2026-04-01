import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ServerSettings,
  ServerSettingsPatch,
  ServerConfig,
  ModelSelection,
  ThreadEnvMode,
} from "@glass/contracts";
import { DEFAULT_SERVER_SETTINGS } from "@glass/contracts";
import {
  type ClientSettings,
  ClientSettingsSchema,
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_UNIFIED_SETTINGS,
  SidebarProjectSortOrder,
  SidebarThreadSortOrder,
  TimestampFormat,
  UnifiedSettings,
} from "@glass/contracts/settings";
import { serverConfigQueryOptions, serverQueryKeys } from "~/lib/serverReactQuery";
import { ensureNativeApi } from "~/nativeApi";
import { useLocalStorage } from "./useLocalStorage";
import { normalizeCustomModelSlugs } from "~/modelSelection";
import { Predicate, Schema, Struct } from "effect";
import { DeepMutable } from "effect/Types";
import { deepMerge } from "@glass/shared/Struct";

const CLIENT_SETTINGS_STORAGE_KEY = "glass:client-settings:v1";
const OLD_SETTINGS_KEY = "t3code:app-settings:v1";

const SERVER_SETTINGS_KEYS = new Set<string>(Struct.keys(ServerSettings.fields));

function splitPatch(patch: Partial<UnifiedSettings>): {
  serverPatch: ServerSettingsPatch;
  clientPatch: Partial<ClientSettings>;
} {
  const serverPatch: Record<string, unknown> = {};
  const clientPatch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (SERVER_SETTINGS_KEYS.has(key)) {
      serverPatch[key] = value;
    } else {
      clientPatch[key] = value;
    }
  }
  return {
    serverPatch: serverPatch as ServerSettingsPatch,
    clientPatch: clientPatch as Partial<ClientSettings>,
  };
}

export function useSettings<T extends UnifiedSettings = UnifiedSettings>(
  selector?: (s: UnifiedSettings) => T,
): T {
  const { data: serverConfig } = useQuery(serverConfigQueryOptions());
  const [clientSettings] = useLocalStorage(
    CLIENT_SETTINGS_STORAGE_KEY,
    DEFAULT_CLIENT_SETTINGS,
    ClientSettingsSchema,
  );

  const merged = useMemo<UnifiedSettings>(
    () => ({
      ...(serverConfig?.settings ?? DEFAULT_SERVER_SETTINGS),
      ...clientSettings,
    }),
    [serverConfig?.settings, clientSettings],
  );

  return useMemo(() => (selector ? selector(merged) : (merged as T)), [merged, selector]);
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const [, setClientSettings] = useLocalStorage(
    CLIENT_SETTINGS_STORAGE_KEY,
    DEFAULT_CLIENT_SETTINGS,
    ClientSettingsSchema,
  );

  const updateSettings = useCallback(
    (patch: Partial<UnifiedSettings>) => {
      const { serverPatch, clientPatch } = splitPatch(patch);

      if (Object.keys(serverPatch).length > 0) {
        queryClient.setQueryData<ServerConfig>(serverQueryKeys.config(), (old) => {
          if (!old) return old;
          return {
            ...old,
            settings: deepMerge(old.settings, serverPatch),
          };
        });
        void ensureNativeApi().server.updateSettings(serverPatch);
      }

      if (Object.keys(clientPatch).length > 0) {
        setClientSettings((prev) => ({ ...prev, ...clientPatch }));
      }
    },
    [queryClient, setClientSettings],
  );

  const resetSettings = useCallback(() => {
    updateSettings(DEFAULT_UNIFIED_SETTINGS);
  }, [updateSettings]);

  return {
    updateSettings,
    resetSettings,
  };
}

export function buildLegacyServerSettingsMigrationPatch(legacySettings: Record<string, unknown>) {
  const patch: DeepMutable<ServerSettingsPatch> = {};

  if (Predicate.isBoolean(legacySettings.enableAssistantStreaming)) {
    patch.enableAssistantStreaming = legacySettings.enableAssistantStreaming;
  }

  if (Schema.is(ThreadEnvMode)(legacySettings.defaultThreadEnvMode)) {
    patch.defaultThreadEnvMode = legacySettings.defaultThreadEnvMode;
  }

  if (Schema.is(ModelSelection)(legacySettings.textGenerationModelSelection)) {
    patch.textGenerationModelSelection = legacySettings.textGenerationModelSelection;
  }

  if (typeof legacySettings.codexBinaryPath === "string") {
    patch.providers ??= {};
    patch.providers.pi ??= {};
    patch.providers.pi.binaryPath = legacySettings.codexBinaryPath;
  }

  if (typeof legacySettings.codexHomePath === "string") {
    patch.providers ??= {};
    patch.providers.pi ??= {};
    patch.providers.pi.homePath = legacySettings.codexHomePath;
  }

  if (Array.isArray(legacySettings.customCodexModels)) {
    patch.providers ??= {};
    patch.providers.pi ??= {};
    patch.providers.pi.customModels = normalizeCustomModelSlugs(
      legacySettings.customCodexModels,
      new Set<string>(),
      "pi",
    );
  }

  if (Predicate.isString(legacySettings.claudeBinaryPath)) {
    patch.providers ??= {};
    patch.providers.pi ??= {};
    if (patch.providers.pi.binaryPath === undefined) {
      patch.providers.pi.binaryPath = legacySettings.claudeBinaryPath;
    }
  }

  if (Array.isArray(legacySettings.customClaudeModels)) {
    patch.providers ??= {};
    patch.providers.pi ??= {};
    const prior = patch.providers.pi.customModels ?? [];
    patch.providers.pi.customModels = normalizeCustomModelSlugs(
      [...prior, ...legacySettings.customClaudeModels],
      new Set<string>(),
      "pi",
    );
  }

  return patch;
}

export function buildLegacyClientSettingsMigrationPatch(
  legacySettings: Record<string, unknown>,
): Partial<DeepMutable<ClientSettings>> {
  const patch: Partial<DeepMutable<ClientSettings>> = {};

  if (Predicate.isBoolean(legacySettings.confirmThreadArchive)) {
    patch.confirmThreadArchive = legacySettings.confirmThreadArchive;
  }

  if (Predicate.isBoolean(legacySettings.confirmThreadDelete)) {
    patch.confirmThreadDelete = legacySettings.confirmThreadDelete;
  }

  if (Predicate.isBoolean(legacySettings.diffWordWrap)) {
    patch.diffWordWrap = legacySettings.diffWordWrap;
  }

  if (Schema.is(SidebarProjectSortOrder)(legacySettings.sidebarProjectSortOrder)) {
    patch.sidebarProjectSortOrder = legacySettings.sidebarProjectSortOrder;
  }

  if (Schema.is(SidebarThreadSortOrder)(legacySettings.sidebarThreadSortOrder)) {
    patch.sidebarThreadSortOrder = legacySettings.sidebarThreadSortOrder;
  }

  if (Schema.is(TimestampFormat)(legacySettings.timestampFormat)) {
    patch.timestampFormat = legacySettings.timestampFormat;
  }

  return patch;
}

export function migrateLocalSettingsToServer(): void {
  if (typeof window === "undefined") return;

  const raw = localStorage.getItem(OLD_SETTINGS_KEY);
  if (!raw) return;

  try {
    const old = JSON.parse(raw);
    if (!Predicate.isObject(old)) return;

    const serverPatch = buildLegacyServerSettingsMigrationPatch(old);
    if (Object.keys(serverPatch).length > 0) {
      const api = ensureNativeApi();
      void api.server.updateSettings(serverPatch);
    }

    const clientPatch = buildLegacyClientSettingsMigrationPatch(old);
    if (Object.keys(clientPatch).length > 0) {
      const existing = localStorage.getItem(CLIENT_SETTINGS_STORAGE_KEY);
      const current = existing ? (JSON.parse(existing) as Record<string, unknown>) : {};
      localStorage.setItem(
        CLIENT_SETTINGS_STORAGE_KEY,
        JSON.stringify({ ...current, ...clientPatch }),
      );
    }
  } catch (error) {
    console.error("[MIGRATION] Error migrating local settings:", error);
  } finally {
    localStorage.removeItem(OLD_SETTINGS_KEY);
  }
}
