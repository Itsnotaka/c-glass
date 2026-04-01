import { contextBridge, ipcRenderer } from "electron";
import type { GlassBridge } from "@glass/contracts";

const CONFIRM_CHANNEL = "desktop:confirm";
const SET_THEME_CHANNEL = "desktop:set-theme";
const CONTEXT_MENU_CHANNEL = "desktop:context-menu";
const MENU_ACTION_CHANNEL = "desktop:menu-action";
const UPDATE_STATE_CHANNEL = "desktop:update-state";
const UPDATE_GET_STATE_CHANNEL = "desktop:update-get-state";
const UPDATE_CHECK_CHANNEL = "desktop:update-check";
const UPDATE_DOWNLOAD_CHANNEL = "desktop:update-download";
const UPDATE_INSTALL_CHANNEL = "desktop:update-install";
const SESSION_LIST_CHANNEL = "glass:session.list";
const SESSION_CREATE_CHANNEL = "glass:session.create";
const SESSION_GET_CHANNEL = "glass:session.get";
const SESSION_PROMPT_CHANNEL = "glass:session.prompt";
const SESSION_ABORT_CHANNEL = "glass:session.abort";
const SESSION_SET_MODEL_CHANNEL = "glass:session.set-model";
const SESSION_EVENT_CHANNEL = "glass:session.event";
const PI_GET_CONFIG_CHANNEL = "glass:pi.get-config";
const PI_SET_DEFAULT_MODEL_CHANNEL = "glass:pi.set-default-model";
const PI_CLEAR_DEFAULT_MODEL_CHANNEL = "glass:pi.clear-default-model";
const PI_SET_DEFAULT_THINKING_CHANNEL = "glass:pi.set-default-thinking";
const PI_GET_API_KEY_CHANNEL = "glass:pi.get-api-key";
const PI_SET_API_KEY_CHANNEL = "glass:pi.set-api-key";
const SHELL_GET_STATE_CHANNEL = "glass:shell.get-state";
const SHELL_PICK_WORKSPACE_CHANNEL = "glass:shell.pick-workspace";
const SHELL_OPEN_IN_EDITOR_CHANNEL = "glass:shell.open-in-editor";
const SHELL_OPEN_EXTERNAL_CHANNEL = "glass:shell.open-external";

contextBridge.exposeInMainWorld("glass", {
  session: {
    list: () => ipcRenderer.invoke(SESSION_LIST_CHANNEL),
    create: () => ipcRenderer.invoke(SESSION_CREATE_CHANNEL),
    get: (sessionId) => ipcRenderer.invoke(SESSION_GET_CHANNEL, sessionId),
    prompt: (sessionId, text) => ipcRenderer.invoke(SESSION_PROMPT_CHANNEL, sessionId, text),
    abort: (sessionId) => ipcRenderer.invoke(SESSION_ABORT_CHANNEL, sessionId),
    setModel: (sessionId, provider, model) =>
      ipcRenderer.invoke(SESSION_SET_MODEL_CHANNEL, sessionId, provider, model),
    onEvent: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, data: unknown) => {
        if (typeof data !== "object" || data === null) return;
        listener(data as Parameters<typeof listener>[0]);
      };
      ipcRenderer.on(SESSION_EVENT_CHANNEL, wrapped);
      return () => {
        ipcRenderer.removeListener(SESSION_EVENT_CHANNEL, wrapped);
      };
    },
  },
  pi: {
    getConfig: () => ipcRenderer.invoke(PI_GET_CONFIG_CHANNEL),
    setDefaultModel: (provider, model) =>
      ipcRenderer.invoke(PI_SET_DEFAULT_MODEL_CHANNEL, provider, model),
    clearDefaultModel: () => ipcRenderer.invoke(PI_CLEAR_DEFAULT_MODEL_CHANNEL),
    setDefaultThinkingLevel: (thinkingLevel) =>
      ipcRenderer.invoke(PI_SET_DEFAULT_THINKING_CHANNEL, thinkingLevel),
    getApiKey: (provider) => ipcRenderer.invoke(PI_GET_API_KEY_CHANNEL, provider),
    setApiKey: (provider, key) => ipcRenderer.invoke(PI_SET_API_KEY_CHANNEL, provider, key),
  },
  shell: {
    getState: () => ipcRenderer.invoke(SHELL_GET_STATE_CHANNEL),
    pickWorkspace: () => ipcRenderer.invoke(SHELL_PICK_WORKSPACE_CHANNEL),
    openInEditor: (path, editor) => ipcRenderer.invoke(SHELL_OPEN_IN_EDITOR_CHANNEL, path, editor),
    openExternal: (url) => ipcRenderer.invoke(SHELL_OPEN_EXTERNAL_CHANNEL, url),
  },
  desktop: {
    confirm: (message) => ipcRenderer.invoke(CONFIRM_CHANNEL, message),
    setTheme: (theme) => ipcRenderer.invoke(SET_THEME_CHANNEL, theme),
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
