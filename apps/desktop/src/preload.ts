import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopBootSnapshot,
  GlassBridge,
  PiAskEvent,
  PiAskReply,
  PiAskState,
  PiExtensionScope,
  PiPromptInput,
  PiSessionActiveEvent,
  PiSessionSummaryEvent,
  PiThinkingLevel,
} from "@glass/contracts";

const CONFIRM_CHANNEL = "desktop:confirm";
const SET_THEME_CHANNEL = "desktop:set-theme";
const SET_VIBRANCY_CHANNEL = "desktop:set-vibrancy";
const CONTEXT_MENU_CHANNEL = "desktop:context-menu";
const MENU_ACTION_CHANNEL = "desktop:menu-action";
const UPDATE_STATE_CHANNEL = "desktop:update-state";
const UPDATE_GET_STATE_CHANNEL = "desktop:update-get-state";
const UPDATE_CHECK_CHANNEL = "desktop:update-check";
const UPDATE_DOWNLOAD_CHANNEL = "desktop:update-download";
const UPDATE_INSTALL_CHANNEL = "desktop:update-install";
const GLASS_READ_BOOT_CHANNEL = "glass:boot.read";
const EXT_UI_REQUEST_CHANNEL = "glass:ext-ui.request";
const EXT_UI_REPLY_CHANNEL = "glass:ext-ui.reply";
const EXT_UI_NOTIFY_CHANNEL = "glass:ext-ui.notify";
const EXT_UI_SET_EDITOR_CHANNEL = "glass:ext-ui.set-editor";
const EXT_UI_COMPOSER_DRAFT_CHANNEL = "glass:ext-ui.composer-draft";
const SESSION_LIST_CHANNEL = "glass:session.list";
const SESSION_LIST_ALL_CHANNEL = "glass:session.list-all";
const SESSION_CREATE_CHANNEL = "glass:session.create";
const SESSION_GET_CHANNEL = "glass:session.get";
const SESSION_READ_CHANNEL = "glass:session.read";
const SESSION_WATCH_CHANNEL = "glass:session.watch";
const SESSION_UNWATCH_CHANNEL = "glass:session.unwatch";
const SESSION_PROMPT_CHANNEL = "glass:session.prompt";
const SESSION_ABORT_CHANNEL = "glass:session.abort";
const SESSION_SET_MODEL_CHANNEL = "glass:session.set-model";
const SESSION_SET_THINKING_LEVEL_CHANNEL = "glass:session.set-thinking-level";
const SESSION_COMMANDS_CHANNEL = "glass:session.commands";
const SESSION_READ_ASK_CHANNEL = "glass:session.read-ask";
const SESSION_ANSWER_ASK_CHANNEL = "glass:session.answer-ask";
const SESSION_ASK_CHANNEL = "glass:session.ask";
const SESSION_SUMMARY_CHANNEL = "glass:session.summary";
const SESSION_ACTIVE_CHANNEL = "glass:session.active";
const PI_GET_CONFIG_CHANNEL = "glass:pi.get-config";
const PI_SET_DEFAULT_MODEL_CHANNEL = "glass:pi.set-default-model";
const PI_CLEAR_DEFAULT_MODEL_CHANNEL = "glass:pi.clear-default-model";
const PI_SET_DEFAULT_THINKING_CHANNEL = "glass:pi.set-default-thinking";
const PI_SET_EXTENSION_ENABLED_CHANNEL = "glass:pi.set-extension-enabled";
const PI_GET_API_KEY_CHANNEL = "glass:pi.get-api-key";
const PI_SET_API_KEY_CHANNEL = "glass:pi.set-api-key";
const PI_CLEAR_AUTH_CHANNEL = "glass:pi.clear-auth";
const PI_START_OAUTH_LOGIN_CHANNEL = "glass:pi.start-oauth-login";
const PI_OAUTH_PROMPT_CHANNEL = "glass:pi.oauth-prompt";
const PI_OAUTH_PROMPT_REPLY_CHANNEL = "glass:pi.oauth-prompt-reply";
const SHELL_GET_STATE_CHANNEL = "glass:shell.get-state";
const SHELL_PICK_WORKSPACE_CHANNEL = "glass:shell.pick-workspace";
const SHELL_SET_WORKSPACE_CHANNEL = "glass:shell.set-workspace";
const SHELL_OPEN_IN_EDITOR_CHANNEL = "glass:shell.open-in-editor";
const SHELL_OPEN_EXTERNAL_CHANNEL = "glass:shell.open-external";
const SHELL_SUGGEST_FILES_CHANNEL = "glass:shell.suggest-files";
const SHELL_PREVIEW_FILE_CHANNEL = "glass:shell.preview-file";
const SHELL_PICK_FILES_CHANNEL = "glass:shell.pick-files";
const SHELL_INSPECT_FILES_CHANNEL = "glass:shell.inspect-files";
const SHELL_GET_EDITOR_ICONS_CHANNEL = "glass:shell.get-editor-icons";
const GIT_GET_STATE_CHANNEL = "glass:git.get-state";
const GIT_REFRESH_CHANNEL = "glass:git.refresh";
const GIT_INIT_CHANNEL = "glass:git.init";
const GIT_DISCARD_CHANNEL = "glass:git.discard";
const GIT_STATE_CHANNEL = "glass:git.state";
const GLASS_BOOT_REFRESH_CHANNEL = "glass:boot.refresh";

function bootSnapshot() {
  try {
    const data = ipcRenderer.sendSync(GLASS_READ_BOOT_CHANNEL);
    if (typeof data !== "object" || data === null) return null;
    return data as DesktopBootSnapshot;
  } catch {
    return null;
  }
}

const piBridge = {
  getConfig: () => ipcRenderer.invoke(PI_GET_CONFIG_CHANNEL),
  setDefaultModel: (provider: string, model: string) =>
    ipcRenderer.invoke(PI_SET_DEFAULT_MODEL_CHANNEL, provider, model),
  clearDefaultModel: () => ipcRenderer.invoke(PI_CLEAR_DEFAULT_MODEL_CHANNEL),
  setDefaultThinkingLevel: (thinkingLevel: PiThinkingLevel) =>
    ipcRenderer.invoke(PI_SET_DEFAULT_THINKING_CHANNEL, thinkingLevel),
  setExtensionEnabled: (resolvedPath: string, scope: PiExtensionScope, enabled: boolean) =>
    ipcRenderer.invoke(PI_SET_EXTENSION_ENABLED_CHANNEL, resolvedPath, scope, enabled),
  getApiKey: (provider: string) => ipcRenderer.invoke(PI_GET_API_KEY_CHANNEL, provider),
  setApiKey: (provider: string, key: string) =>
    ipcRenderer.invoke(PI_SET_API_KEY_CHANNEL, provider, key),
  clearAuth: (provider: string) => ipcRenderer.invoke(PI_CLEAR_AUTH_CHANNEL, provider),
  startOAuthLogin: (provider: string) => ipcRenderer.invoke(PI_START_OAUTH_LOGIN_CHANNEL, provider),
};

const sessionBridge = {
  list: () => ipcRenderer.invoke(SESSION_LIST_CHANNEL),
  listAll: () => ipcRenderer.invoke(SESSION_LIST_ALL_CHANNEL),
  create: () => ipcRenderer.invoke(SESSION_CREATE_CHANNEL),
  get: (sessionId: string) => ipcRenderer.invoke(SESSION_GET_CHANNEL, sessionId),
  read: (sessionId: string) => ipcRenderer.invoke(SESSION_READ_CHANNEL, sessionId),
  watch: (sessionId: string) => ipcRenderer.invoke(SESSION_WATCH_CHANNEL, sessionId),
  unwatch: () => ipcRenderer.invoke(SESSION_UNWATCH_CHANNEL),
  prompt: (sessionId: string, input: string | PiPromptInput) =>
    ipcRenderer.invoke(SESSION_PROMPT_CHANNEL, sessionId, input),
  abort: (sessionId: string) => ipcRenderer.invoke(SESSION_ABORT_CHANNEL, sessionId),
  setModel: (sessionId: string, provider: string, model: string) =>
    ipcRenderer.invoke(SESSION_SET_MODEL_CHANNEL, sessionId, provider, model),
  setThinkingLevel: (sessionId: string, thinkingLevel: PiThinkingLevel) =>
    ipcRenderer.invoke(SESSION_SET_THINKING_LEVEL_CHANNEL, sessionId, thinkingLevel),
  commands: (sessionId: string) => ipcRenderer.invoke(SESSION_COMMANDS_CHANNEL, sessionId),
  readAsk: (sessionId: string) =>
    ipcRenderer.invoke(SESSION_READ_ASK_CHANNEL, sessionId) as Promise<PiAskState | null>,
  answerAsk: (sessionId: string, reply: PiAskReply) =>
    ipcRenderer.invoke(SESSION_ANSWER_ASK_CHANNEL, sessionId, reply),
  onAsk: (listener: (event: PiAskEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, data: unknown) => {
      if (typeof data !== "object" || data === null) return;
      fetch("http://localhost:60380/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "preload-on-ask",
          data: {
            sessionId: (data as PiAskEvent).sessionId,
            active: Boolean((data as PiAskEvent).state),
            toolCallId: (data as PiAskEvent).state?.toolCallId ?? null,
          },
        }),
      }).catch(() => {});
      listener(data as PiAskEvent);
    };
    ipcRenderer.on(SESSION_ASK_CHANNEL, wrapped);
    return () => {
      ipcRenderer.removeListener(SESSION_ASK_CHANNEL, wrapped);
    };
  },
  onSummary: (listener: (event: PiSessionSummaryEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, data: unknown) => {
      if (typeof data !== "object" || data === null) return;
      fetch("http://localhost:60380/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "preload-on-summary",
          data: {
            sessionId: (data as PiSessionSummaryEvent).sessionId,
            type: (data as PiSessionSummaryEvent).type,
          },
        }),
      }).catch(() => {});
      listener(data as PiSessionSummaryEvent);
    };
    ipcRenderer.on(SESSION_SUMMARY_CHANNEL, wrapped);
    return () => {
      ipcRenderer.removeListener(SESSION_SUMMARY_CHANNEL, wrapped);
    };
  },
  onActive: (listener: (event: PiSessionActiveEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, data: unknown) => {
      if (typeof data !== "object" || data === null) return;
      fetch("http://localhost:60380/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "preload-on-active",
          data: {
            sessionId: (data as PiSessionActiveEvent).sessionId,
            deltaType: (data as PiSessionActiveEvent).delta.type,
          },
        }),
      }).catch(() => {});
      listener(data as PiSessionActiveEvent);
    };
    ipcRenderer.on(SESSION_ACTIVE_CHANNEL, wrapped);
    return () => {
      ipcRenderer.removeListener(SESSION_ACTIVE_CHANNEL, wrapped);
    };
  },
};

const bootListeners = new Set<() => void>();
ipcRenderer.on(GLASS_BOOT_REFRESH_CHANNEL, () => {
  for (const cb of bootListeners) cb();
});

contextBridge.exposeInMainWorld("glass", {
  session: sessionBridge,
  pi: piBridge,
  shell: {
    getState: () => ipcRenderer.invoke(SHELL_GET_STATE_CHANNEL),
    getEditorIcons: () => ipcRenderer.invoke(SHELL_GET_EDITOR_ICONS_CHANNEL),
    pickWorkspace: () => ipcRenderer.invoke(SHELL_PICK_WORKSPACE_CHANNEL),
    setWorkspace: (cwd) => ipcRenderer.invoke(SHELL_SET_WORKSPACE_CHANNEL, cwd),
    openInEditor: (path, editor) => ipcRenderer.invoke(SHELL_OPEN_IN_EDITOR_CHANNEL, path, editor),
    openExternal: (url) => ipcRenderer.invoke(SHELL_OPEN_EXTERNAL_CHANNEL, url),
    suggestFiles: (query) => ipcRenderer.invoke(SHELL_SUGGEST_FILES_CHANNEL, query),
    previewFile: (path) => ipcRenderer.invoke(SHELL_PREVIEW_FILE_CHANNEL, path),
    pickFiles: () => ipcRenderer.invoke(SHELL_PICK_FILES_CHANNEL),
    inspectFiles: (paths) => ipcRenderer.invoke(SHELL_INSPECT_FILES_CHANNEL, paths),
  },
  git: {
    getState: (cwd) => ipcRenderer.invoke(GIT_GET_STATE_CHANNEL, cwd),
    refresh: (cwd) => ipcRenderer.invoke(GIT_REFRESH_CHANNEL, cwd),
    init: (cwd) => ipcRenderer.invoke(GIT_INIT_CHANNEL, cwd),
    discard: (cwd, paths) => ipcRenderer.invoke(GIT_DISCARD_CHANNEL, cwd, paths),
    onState: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, data: unknown) => {
        if (typeof data !== "object" || data === null) return;
        listener(data as Parameters<typeof listener>[0]);
      };
      ipcRenderer.on(GIT_STATE_CHANNEL, wrapped);
      return () => {
        ipcRenderer.removeListener(GIT_STATE_CHANNEL, wrapped);
      };
    },
  },
  desktop: {
    readBootSnapshot: bootSnapshot,
    onBootRefresh: (cb) => {
      bootListeners.add(cb);
      return () => bootListeners.delete(cb);
    },
    confirm: (message) => ipcRenderer.invoke(CONFIRM_CHANNEL, message),
    setTheme: (theme) => ipcRenderer.invoke(SET_THEME_CHANNEL, theme),
    setVibrancy: (enabled) => ipcRenderer.invoke(SET_VIBRANCY_CHANNEL, enabled),
    showContextMenu: (items, position) => ipcRenderer.invoke(CONTEXT_MENU_CHANNEL, items, position),
    onMenuAction: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, action: unknown) => {
        if (typeof action !== "string") return;
        listener(action);
      };
      ipcRenderer.on(MENU_ACTION_CHANNEL, wrapped);
      return () => {
        ipcRenderer.removeListener(MENU_ACTION_CHANNEL, wrapped);
      };
    },
    onExtensionUiRequest: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, data: unknown) => {
        if (typeof data !== "object" || data === null) return;
        listener(data as Parameters<typeof listener>[0]);
      };
      ipcRenderer.on(EXT_UI_REQUEST_CHANNEL, wrapped);
      return () => {
        ipcRenderer.removeListener(EXT_UI_REQUEST_CHANNEL, wrapped);
      };
    },
    onExtensionUiNotify: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, data: unknown) => {
        if (typeof data !== "object" || data === null) return;
        listener(data as Parameters<typeof listener>[0]);
      };
      ipcRenderer.on(EXT_UI_NOTIFY_CHANNEL, wrapped);
      return () => {
        ipcRenderer.removeListener(EXT_UI_NOTIFY_CHANNEL, wrapped);
      };
    },
    onExtensionSetEditor: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, data: unknown) => {
        if (typeof data !== "object" || data === null) return;
        listener(data as Parameters<typeof listener>[0]);
      };
      ipcRenderer.on(EXT_UI_SET_EDITOR_CHANNEL, wrapped);
      return () => {
        ipcRenderer.removeListener(EXT_UI_SET_EDITOR_CHANNEL, wrapped);
      };
    },
    replyExtensionUi: async (reply) => {
      ipcRenderer.send(EXT_UI_REPLY_CHANNEL, reply);
    },
    setComposerDraft: (text) => {
      ipcRenderer.send(EXT_UI_COMPOSER_DRAFT_CHANNEL, text);
    },
    getUpdateState: () => ipcRenderer.invoke(UPDATE_GET_STATE_CHANNEL),
    checkForUpdate: () => ipcRenderer.invoke(UPDATE_CHECK_CHANNEL),
    downloadUpdate: () => ipcRenderer.invoke(UPDATE_DOWNLOAD_CHANNEL),
    installUpdate: () => ipcRenderer.invoke(UPDATE_INSTALL_CHANNEL),
    onUpdateState: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, state: unknown) => {
        if (typeof state !== "object" || state === null) return;
        listener(state as Parameters<typeof listener>[0]);
      };
      ipcRenderer.on(UPDATE_STATE_CHANNEL, wrapped);
      return () => {
        ipcRenderer.removeListener(UPDATE_STATE_CHANNEL, wrapped);
      };
    },
  },
} satisfies GlassBridge);

ipcRenderer.on(
  PI_OAUTH_PROMPT_CHANNEL,
  (_e, payload: { message: string; placeholder?: string }) => {
    const v = window.prompt(payload.message, payload.placeholder ?? "");
    ipcRenderer.send(PI_OAUTH_PROMPT_REPLY_CHANNEL, v ?? "");
  },
);
