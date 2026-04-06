import * as Crypto from "node:crypto";
import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  protocol,
  shell,
} from "electron";
import type { MenuItemConstructorOptions } from "electron";
import * as Effect from "effect/Effect";
import type {
  ContextMenuItem,
  DesktopTheme,
  DesktopUpdateActionResult,
  DesktopUpdateCheckResult,
  PiPromptInput,
  DesktopUpdateState,
  PiSessionActiveEvent,
  PiSessionSummaryEvent,
  PiThinkingLevel,
} from "@glass/contracts";
import { autoUpdater } from "electron-updater";
import { RotatingFileSink } from "@glass/shared/logging";
import { showDesktopConfirmDialog } from "./confirmDialog";
import {
  EXT_UI_COMPOSER_DRAFT_CHANNEL,
  EXT_UI_REPLY_CHANNEL,
  ExtUiBridge,
  type ExtUiReply,
} from "./ext-ui-bridge";
import { AskHub } from "./glass-ext/ask";
import { registerPaperMcpBootRefresh } from "./glass-ext/paper-mcp-status";
import { GitService } from "./git-service";
import { PiConfigService } from "./pi-config-service";
import { PiSessionService } from "./pi-session-service";
import { ShellService } from "./shell-service";
import { probeSign } from "./sign";
import { syncShellEnvironment } from "./syncShellEnvironment";
import { getAutoUpdateDisabledReason, shouldBroadcastDownloadProgress } from "./updateState";
import {
  createInitialDesktopUpdateState,
  reduceDesktopUpdateStateOnCheckFailure,
  reduceDesktopUpdateStateOnCheckStart,
  reduceDesktopUpdateStateOnDownloadComplete,
  reduceDesktopUpdateStateOnDownloadFailure,
  reduceDesktopUpdateStateOnDownloadProgress,
  reduceDesktopUpdateStateOnDownloadStart,
  reduceDesktopUpdateStateOnInstallFailure,
  reduceDesktopUpdateStateOnNoUpdate,
  reduceDesktopUpdateStateOnUpdateAvailable,
} from "./updateMachine";
import { isArm64HostRunningIntelBuild, resolveDesktopRuntimeInfo } from "./runtimeArch";

syncShellEnvironment();

const CONFIRM_CHANNEL = "desktop:confirm";
const SET_THEME_CHANNEL = "desktop:set-theme";
const SET_VIBRANCY_CHANNEL = "desktop:set-vibrancy";
const CONTEXT_MENU_CHANNEL = "desktop:context-menu";
const MENU_ACTION_CHANNEL = "desktop:menu-action";
const UPDATE_STATE_CHANNEL = "desktop:update-state";
const UPDATE_GET_STATE_CHANNEL = "desktop:update-get-state";
const UPDATE_DOWNLOAD_CHANNEL = "desktop:update-download";
const UPDATE_INSTALL_CHANNEL = "desktop:update-install";
const UPDATE_CHECK_CHANNEL = "desktop:update-check";
const SESSION_LIST_CHANNEL = "glass:session.list";
const SESSION_LIST_ALL_CHANNEL = "glass:session.list-all";
const SESSION_LIST_ALL_BOOT_CHANNEL = "glass:session.list-all-boot";
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
const PI_GET_BOOT_CONFIG_CHANNEL = "glass:pi.get-boot-config";
const PI_SET_DEFAULT_MODEL_CHANNEL = "glass:pi.set-default-model";
const PI_CLEAR_DEFAULT_MODEL_CHANNEL = "glass:pi.clear-default-model";
const PI_SET_DEFAULT_THINKING_CHANNEL = "glass:pi.set-default-thinking";
const PI_GET_API_KEY_CHANNEL = "glass:pi.get-api-key";
const PI_SET_API_KEY_CHANNEL = "glass:pi.set-api-key";
const PI_SET_NATIVE_GLASS_EXT_CHANNEL = "glass:pi.set-native-glass-extensions";
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
const BASE_DIR = process.env.GLASS_HOME?.trim() || Path.join(OS.homedir(), ".glass");
const STATE_DIR = Path.join(BASE_DIR, "userdata");
const DESKTOP_SCHEME = "glass";
const ROOT_DIR = Path.resolve(__dirname, "../../..");
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const APP_DISPLAY_NAME = isDevelopment ? "Glass (Dev)" : "Glass";
const APP_USER_MODEL_ID = "com.glass.app";
const USER_DATA_DIR_NAME = isDevelopment ? "glass-dev" : "glass";
const LEGACY_USER_DATA_DIR_NAME = isDevelopment ? "Glass (Dev)" : "Glass";
const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,40}$/i;
const COMMIT_HASH_DISPLAY_LENGTH = 12;
const LOG_DIR = Path.join(STATE_DIR, "logs");
const LOG_FILE_MAX_BYTES = 10 * 1024 * 1024;
const LOG_FILE_MAX_FILES = 10;
const APP_RUN_ID = Crypto.randomBytes(6).toString("hex");
const AUTO_UPDATE_STARTUP_DELAY_MS = 15_000;
const AUTO_UPDATE_POLL_INTERVAL_MS = 4 * 60 * 60 * 1000;
const DESKTOP_UPDATE_CHANNEL = "latest";
const DESKTOP_UPDATE_ALLOW_PRERELEASE = false;

type DesktopUpdateErrorContext = DesktopUpdateState["errorContext"];

let mainWindow: BrowserWindow | null = null;
let gitWatch: FS.FSWatcher | null = null;
let isQuitting = false;
let desktopProtocolRegistered = false;
let aboutCommitHashCache: string | null | undefined;
let desktopLogSink: RotatingFileSink | null = null;
let restoreStdIoCapture: (() => void) | null = null;
let removeSessionEvents: (() => void) | null = null;
let removeAskEvents: (() => void) | null = null;
let removeGitEvents: (() => void) | null = null;
let sessionEventTimer: ReturnType<typeof setTimeout> | null = null;

const pendingSessionSummaries = new Map<string, PiSessionSummaryEvent>();
const pendingSessionActives = new Map<number, PiSessionActiveEvent[]>();
const watchedSessions = new Map<number, string>();
const watchedSenders = new Set<number>();

const pi = new PiConfigService();
const extUi = new ExtUiBridge();
const ask = new AskHub();

let oauthPromptResolve: ((value: string) => void) | null = null;

function oauthPromptReplyHandler(_event: Electron.IpcMainEvent, value: unknown) {
  if (typeof value !== "string") return;
  oauthPromptResolve?.(value);
  oauthPromptResolve = null;
}
const shellService = new ShellService(Path.join(resolveUserDataPath(), "shell.json"));
const sessionService = new PiSessionService(pi, shellService, extUi, ask);
const gitService = new GitService();

let destructiveMenuIconCache: Electron.NativeImage | null | undefined;
const desktopRuntimeInfo = resolveDesktopRuntimeInfo({
  platform: process.platform,
  processArch: process.arch,
  runningUnderArm64Translation: app.runningUnderARM64Translation === true,
});
const initialUpdateState = (): DesktopUpdateState =>
  createInitialDesktopUpdateState(app.getVersion(), desktopRuntimeInfo);

function logScope(scope: string): string {
  return `${scope} run=${APP_RUN_ID}`;
}

function writeDesktopLogHeader(message: string): void {
  if (!desktopLogSink) return;
  desktopLogSink.write(`[${new Date().toISOString()}] [${logScope("desktop")}] ${message}\n`);
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getSafeExternalUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return null;
  }

  return parsedUrl.toString();
}

function getSafeTheme(rawTheme: unknown): DesktopTheme | null {
  if (rawTheme === "light" || rawTheme === "dark" || rawTheme === "system") {
    return rawTheme;
  }

  return null;
}

function writeDesktopStreamChunk(
  streamName: "stdout" | "stderr",
  chunk: unknown,
  encoding: BufferEncoding | undefined,
): void {
  if (!desktopLogSink) return;
  const buffer = Buffer.isBuffer(chunk)
    ? chunk
    : Buffer.from(String(chunk), typeof chunk === "string" ? encoding : undefined);
  desktopLogSink.write(`[${new Date().toISOString()}] [${logScope(streamName)}] `);
  desktopLogSink.write(buffer);
  if (buffer.length === 0 || buffer[buffer.length - 1] !== 0x0a) {
    desktopLogSink.write("\n");
  }
}

function installStdIoCapture(): void {
  if (!app.isPackaged || desktopLogSink === null || restoreStdIoCapture !== null) {
    return;
  }

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  const patchWrite =
    (streamName: "stdout" | "stderr", originalWrite: typeof process.stdout.write) =>
    (
      chunk: string | Uint8Array,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ): boolean => {
      const encoding = typeof encodingOrCallback === "string" ? encodingOrCallback : undefined;
      writeDesktopStreamChunk(streamName, chunk, encoding);
      if (typeof encodingOrCallback === "function") {
        return originalWrite(chunk, encodingOrCallback);
      }
      if (callback !== undefined) {
        return originalWrite(chunk, encoding, callback);
      }
      if (encoding !== undefined) {
        return originalWrite(chunk, encoding);
      }
      return originalWrite(chunk);
    };

  process.stdout.write = patchWrite("stdout", originalStdoutWrite);
  process.stderr.write = patchWrite("stderr", originalStderrWrite);

  restoreStdIoCapture = () => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    restoreStdIoCapture = null;
  };
}

function initializePackagedLogging(): void {
  if (!app.isPackaged) return;
  try {
    desktopLogSink = new RotatingFileSink({
      filePath: Path.join(LOG_DIR, "desktop-main.log"),
      maxBytes: LOG_FILE_MAX_BYTES,
      maxFiles: LOG_FILE_MAX_FILES,
    });
    installStdIoCapture();
    writeDesktopLogHeader(`runtime log capture enabled logDir=${LOG_DIR}`);
  } catch (error) {
    // Logging setup should never block app startup.
    console.error("[desktop] failed to initialize packaged logging", error);
  }
}

initializePackagedLogging();

function getDestructiveMenuIcon(): Electron.NativeImage | undefined {
  if (process.platform !== "darwin") return undefined;
  if (destructiveMenuIconCache !== undefined) {
    return destructiveMenuIconCache ?? undefined;
  }
  try {
    const icon = nativeImage.createFromNamedImage("trash").resize({
      width: 14,
      height: 14,
    });
    if (icon.isEmpty()) {
      destructiveMenuIconCache = null;
      return undefined;
    }
    icon.setTemplateImage(true);
    destructiveMenuIconCache = icon;
    return icon;
  } catch {
    destructiveMenuIconCache = null;
    return undefined;
  }
}
let updatePollTimer: ReturnType<typeof setInterval> | null = null;
let updateStartupTimer: ReturnType<typeof setTimeout> | null = null;
let updateCheckInFlight = false;
let updateDownloadInFlight = false;
let updateInstallInFlight = false;
let updaterConfigured = false;
let updateState: DesktopUpdateState = initialUpdateState();

function resolveUpdaterErrorContext(): DesktopUpdateErrorContext {
  if (updateInstallInFlight) return "install";
  if (updateDownloadInFlight) return "download";
  if (updateCheckInFlight) return "check";
  return updateState.errorContext;
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: DESKTOP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function resolveAppRoot(): string {
  if (!app.isPackaged) {
    return ROOT_DIR;
  }
  return app.getAppPath();
}

/** Read the baked-in app-update.yml config (if applicable). */
function readAppUpdateYml(): Record<string, string> | null {
  try {
    // electron-updater reads from process.resourcesPath in packaged builds,
    // or dev-app-update.yml via app.getAppPath() in dev.
    const ymlPath = app.isPackaged
      ? Path.join(process.resourcesPath, "app-update.yml")
      : Path.join(app.getAppPath(), "dev-app-update.yml");
    const raw = FS.readFileSync(ymlPath, "utf-8");
    // The YAML is simple key-value pairs — avoid pulling in a YAML parser by
    // doing a line-based parse (fields: provider, owner, repo, releaseType, …).
    const entries: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match?.[1] && match[2]) entries[match[1]] = match[2].trim();
    }
    return entries.provider ? entries : null;
  } catch {
    return null;
  }
}

function normalizeCommitHash(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!COMMIT_HASH_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed.slice(0, COMMIT_HASH_DISPLAY_LENGTH).toLowerCase();
}

function resolveEmbeddedCommitHash(): string | null {
  const packageJsonPath = Path.join(resolveAppRoot(), "package.json");
  if (!FS.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const raw = FS.readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { glassCommitHash?: unknown };
    return normalizeCommitHash(parsed.glassCommitHash);
  } catch {
    return null;
  }
}

function resolveAboutCommitHash(): string | null {
  if (aboutCommitHashCache !== undefined) {
    return aboutCommitHashCache;
  }

  const envCommitHash = normalizeCommitHash(process.env.GLASS_COMMIT_HASH);
  if (envCommitHash) {
    aboutCommitHashCache = envCommitHash;
    return aboutCommitHashCache;
  }

  // Only packaged builds are required to expose commit metadata.
  if (!app.isPackaged) {
    aboutCommitHashCache = null;
    return aboutCommitHashCache;
  }

  aboutCommitHashCache = resolveEmbeddedCommitHash();

  return aboutCommitHashCache;
}

function resolveDesktopStaticDir(): string | null {
  const appRoot = resolveAppRoot();
  const candidates = [Path.join(appRoot, "apps/web/dist")];

  for (const candidate of candidates) {
    if (FS.existsSync(Path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  return null;
}

function resolveDesktopStaticPath(staticRoot: string, requestUrl: string): string {
  const url = new URL(requestUrl);
  const rawPath = decodeURIComponent(url.pathname);
  const normalizedPath = Path.posix.normalize(rawPath).replace(/^\/+/, "");
  if (normalizedPath.includes("..")) {
    return Path.join(staticRoot, "index.html");
  }

  const requestedPath = normalizedPath.length > 0 ? normalizedPath : "index.html";
  const resolvedPath = Path.join(staticRoot, requestedPath);

  if (Path.extname(resolvedPath)) {
    return resolvedPath;
  }

  const nestedIndex = Path.join(resolvedPath, "index.html");
  if (FS.existsSync(nestedIndex)) {
    return nestedIndex;
  }

  return Path.join(staticRoot, "index.html");
}

function isStaticAssetRequest(requestUrl: string): boolean {
  try {
    const url = new URL(requestUrl);
    return Path.extname(url.pathname).length > 0;
  } catch {
    return false;
  }
}

function handleFatalStartupError(stage: string, error: unknown): void {
  const message = formatErrorMessage(error);
  const detail =
    error instanceof Error && typeof error.stack === "string" ? `\n${error.stack}` : "";
  writeDesktopLogHeader(`fatal startup error stage=${stage} message=${message}`);
  console.error(`[desktop] fatal startup error (${stage})`, error);
  if (!isQuitting) {
    isQuitting = true;
    dialog.showErrorBox("Glass failed to start", `Stage: ${stage}\n${message}${detail}`);
  }
  sessionService.dispose();
  restoreStdIoCapture?.();
  app.quit();
}

function registerDesktopProtocol(): void {
  if (isDevelopment || desktopProtocolRegistered) return;

  const staticRoot = resolveDesktopStaticDir();
  if (!staticRoot) {
    throw new Error("Desktop static bundle missing. Build apps/web first.");
  }

  const staticRootResolved = Path.resolve(staticRoot);
  const staticRootPrefix = `${staticRootResolved}${Path.sep}`;
  const fallbackIndex = Path.join(staticRootResolved, "index.html");

  protocol.registerFileProtocol(DESKTOP_SCHEME, (request, callback) => {
    try {
      const candidate = resolveDesktopStaticPath(staticRootResolved, request.url);
      const resolvedCandidate = Path.resolve(candidate);
      const isInRoot =
        resolvedCandidate === fallbackIndex || resolvedCandidate.startsWith(staticRootPrefix);
      const isAssetRequest = isStaticAssetRequest(request.url);

      if (!isInRoot || !FS.existsSync(resolvedCandidate)) {
        if (isAssetRequest) {
          callback({ error: -6 });
          return;
        }
        callback({ path: fallbackIndex });
        return;
      }

      callback({ path: resolvedCandidate });
    } catch {
      callback({ path: fallbackIndex });
    }
  });

  desktopProtocolRegistered = true;
}

function dispatchMenuAction(action: string): void {
  const existingWindow =
    BrowserWindow.getFocusedWindow() ?? mainWindow ?? BrowserWindow.getAllWindows()[0];
  const targetWindow = existingWindow ?? createWindow();
  if (!existingWindow) {
    mainWindow = targetWindow;
  }

  const send = () => {
    if (targetWindow.isDestroyed()) return;
    targetWindow.webContents.send(MENU_ACTION_CHANNEL, action);
    if (!targetWindow.isVisible()) {
      targetWindow.show();
    }
    targetWindow.focus();
  };

  if (targetWindow.webContents.isLoadingMainFrame()) {
    targetWindow.webContents.once("did-finish-load", send);
    return;
  }

  send();
}

function handleCheckForUpdatesMenuClick(): void {
  const disabledReason = getAutoUpdateDisabledReason({
    isDevelopment,
    isPackaged: app.isPackaged,
    platform: process.platform,
    appImage: process.env.APPIMAGE,
    disabledByEnv: process.env.GLASS_DISABLE_AUTO_UPDATE === "1",
  });
  if (disabledReason) {
    console.info("[desktop-updater] Manual update check requested, but updates are disabled.");
    void dialog.showMessageBox({
      type: "info",
      title: "Updates unavailable",
      message: "Automatic updates are not available right now.",
      detail: disabledReason,
      buttons: ["OK"],
    });
    return;
  }

  if (!BrowserWindow.getAllWindows().length) {
    mainWindow = createWindow();
  }
  void checkForUpdatesFromMenu();
}

async function checkForUpdatesFromMenu(): Promise<void> {
  await checkForUpdates("menu");

  if (updateState.status === "up-to-date") {
    void dialog.showMessageBox({
      type: "info",
      title: "You're up to date!",
      message: `Glass ${updateState.currentVersion} is currently the newest version available.`,
      buttons: ["OK"],
    });
  } else if (updateState.status === "error") {
    void dialog.showMessageBox({
      type: "warning",
      title: "Update check failed",
      message: "Could not check for updates.",
      detail: updateState.message ?? "An unknown error occurred. Please try again later.",
      buttons: ["OK"],
    });
  }
}

function configureApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [];

  if (process.platform === "darwin") {
    template.push({
      label: app.name,
      submenu: [
        { role: "about" },
        {
          label: "Check for Updates...",
          click: () => handleCheckForUpdatesMenuClick(),
        },
        { type: "separator" },
        {
          label: "Settings...",
          accelerator: "CmdOrCtrl+,",
          click: () => dispatchMenuAction("open-settings"),
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  template.push(
    {
      label: "File",
      submenu: [
        ...(process.platform === "darwin"
          ? []
          : [
              {
                label: "Settings...",
                accelerator: "CmdOrCtrl+,",
                click: () => dispatchMenuAction("open-settings"),
              },
              { type: "separator" as const },
            ]),
        { role: process.platform === "darwin" ? "close" : "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn", accelerator: "CmdOrCtrl+=" },
        { role: "zoomIn", accelerator: "CmdOrCtrl+Plus", visible: false },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Check for Updates...",
          click: () => handleCheckForUpdatesMenuClick(),
        },
      ],
    },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function resolveResourcePath(fileName: string): string | null {
  const candidates = [
    Path.join(__dirname, "../resources", fileName),
    Path.join(__dirname, "../prod-resources", fileName),
    Path.join(process.resourcesPath, "resources", fileName),
    Path.join(process.resourcesPath, fileName),
  ];

  for (const candidate of candidates) {
    if (FS.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Resolve the Electron userData directory path.
 *
 * Electron derives the default userData path from `productName` in
 * package.json, which can produce directories with spaces and
 * parentheses (e.g. `~/.config/Glass` on Linux). This is
 * unfriendly for shell usage and violates Linux naming conventions.
 *
 * We override it to a clean lowercase name (`glass`). If the legacy
 * directory already exists we keep using it so existing users don't
 * lose their Chromium profile data (localStorage, cookies, sessions).
 */
function resolveUserDataPath(): string {
  const appDataBase =
    process.platform === "win32"
      ? process.env.APPDATA || Path.join(OS.homedir(), "AppData", "Roaming")
      : process.platform === "darwin"
        ? Path.join(OS.homedir(), "Library", "Application Support")
        : process.env.XDG_CONFIG_HOME || Path.join(OS.homedir(), ".config");

  const legacyPath = Path.join(appDataBase, LEGACY_USER_DATA_DIR_NAME);
  if (FS.existsSync(legacyPath)) {
    return legacyPath;
  }

  return Path.join(appDataBase, USER_DATA_DIR_NAME);
}

function configureAppIdentity(): void {
  app.setName(APP_DISPLAY_NAME);
  const commitHash = resolveAboutCommitHash();
  app.setAboutPanelOptions({
    applicationName: APP_DISPLAY_NAME,
    applicationVersion: app.getVersion(),
    version: commitHash ?? "unknown",
  });

  if (process.platform === "win32") {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }

  if (process.platform === "darwin" && app.dock) {
    const iconPath = resolveResourcePath("icon.png");
    if (iconPath) {
      app.dock.setIcon(iconPath);
    }
  }
}

function clearUpdatePollTimer(): void {
  if (updateStartupTimer) {
    clearTimeout(updateStartupTimer);
    updateStartupTimer = null;
  }
  if (updatePollTimer) {
    clearInterval(updatePollTimer);
    updatePollTimer = null;
  }
}

function emitUpdateState(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    window.webContents.send(UPDATE_STATE_CHANNEL, updateState);
  }
}

function setUpdateState(patch: Partial<DesktopUpdateState>): void {
  updateState = { ...updateState, ...patch };
  emitUpdateState();
}

function shouldEnableAutoUpdates(): boolean {
  return (
    getAutoUpdateDisabledReason({
      isDevelopment,
      isPackaged: app.isPackaged,
      platform: process.platform,
      appImage: process.env.APPIMAGE,
      disabledByEnv: process.env.GLASS_DISABLE_AUTO_UPDATE === "1",
    }) === null
  );
}

function getMockInstallBlock(): string | null {
  if (process.platform !== "darwin") {
    return null;
  }
  if (!process.env.GLASS_DESKTOP_MOCK_UPDATES) {
    return null;
  }
  const sign = probeSign(process.execPath);
  if (sign === "signed") {
    return null;
  }
  return "Local macOS mock updates require both the installed app and the downloaded update to be signed with the same identity. This build is unsigned or ad-hoc signed, so Squirrel.Mac will reject the install.";
}

async function checkForUpdates(reason: string): Promise<boolean> {
  if (isQuitting || !updaterConfigured || updateCheckInFlight) return false;
  if (updateState.status === "downloading" || updateState.status === "downloaded") {
    console.info(
      `[desktop-updater] Skipping update check (${reason}) while status=${updateState.status}.`,
    );
    return false;
  }
  updateCheckInFlight = true;
  setUpdateState(reduceDesktopUpdateStateOnCheckStart(updateState, new Date().toISOString()));
  console.info(`[desktop-updater] Checking for updates (${reason})...`);

  try {
    await autoUpdater.checkForUpdates();
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    setUpdateState(
      reduceDesktopUpdateStateOnCheckFailure(updateState, message, new Date().toISOString()),
    );
    console.error(`[desktop-updater] Failed to check for updates: ${message}`);
    return true;
  } finally {
    updateCheckInFlight = false;
  }
}

async function downloadAvailableUpdate(): Promise<{ accepted: boolean; completed: boolean }> {
  if (!updaterConfigured || updateDownloadInFlight || updateState.status !== "available") {
    return { accepted: false, completed: false };
  }
  updateDownloadInFlight = true;
  setUpdateState(reduceDesktopUpdateStateOnDownloadStart(updateState));
  autoUpdater.disableDifferentialDownload = isArm64HostRunningIntelBuild(desktopRuntimeInfo);
  console.info("[desktop-updater] Downloading update...");

  try {
    await autoUpdater.downloadUpdate();
    return { accepted: true, completed: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    setUpdateState(reduceDesktopUpdateStateOnDownloadFailure(updateState, message));
    console.error(`[desktop-updater] Failed to download update: ${message}`);
    return { accepted: true, completed: false };
  } finally {
    updateDownloadInFlight = false;
  }
}

async function installDownloadedUpdate(): Promise<{ accepted: boolean; completed: boolean }> {
  if (isQuitting || !updaterConfigured || updateState.status !== "downloaded") {
    return { accepted: false, completed: false };
  }

  const block = getMockInstallBlock();
  if (block) {
    setUpdateState(reduceDesktopUpdateStateOnInstallFailure(updateState, block));
    console.error(`[desktop-updater] Failed to install update: ${block}`);
    return { accepted: true, completed: false };
  }

  isQuitting = true;
  updateInstallInFlight = true;
  clearUpdatePollTimer();
  try {
    sessionService.dispose();
    if (process.platform === "win32") {
      // Destroy all windows before launching the NSIS installer to avoid the installer finding live windows it needs to close.
      for (const win of BrowserWindow.getAllWindows()) {
        win.destroy();
      }
    }
    // `quitAndInstall()` only starts the handoff to the updater. The actual
    // install may still fail asynchronously, so keep the action incomplete
    // until we either quit or receive an updater error.
    autoUpdater.quitAndInstall(true, true);
    return { accepted: true, completed: false };
  } catch (error: unknown) {
    const message = formatErrorMessage(error);
    updateInstallInFlight = false;
    isQuitting = false;
    setUpdateState(reduceDesktopUpdateStateOnInstallFailure(updateState, message));
    console.error(`[desktop-updater] Failed to install update: ${message}`);
    return { accepted: true, completed: false };
  }
}

function configureAutoUpdater(): void {
  const enabled = shouldEnableAutoUpdates();
  setUpdateState({
    ...createInitialDesktopUpdateState(app.getVersion(), desktopRuntimeInfo),
    enabled,
    status: enabled ? "idle" : "disabled",
  });
  if (!enabled) {
    return;
  }
  updaterConfigured = true;

  const githubToken =
    process.env.GLASS_DESKTOP_UPDATE_GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || "";
  const appUpdateYml = readAppUpdateYml();
  if (appUpdateYml?.provider === "github") {
    if (githubToken) {
      // When a token is provided, re-configure the feed with `private: true` so
      // electron-updater uses the GitHub API (api.github.com) instead of the
      // public Atom feed (github.com/…/releases.atom) which rejects Bearer auth.
      autoUpdater.setFeedURL({
        ...appUpdateYml,
        provider: "github" as const,
        private: true,
        token: githubToken,
      });
    } else {
      // Warn that private repos require a token - the default Atom feed will 404
      console.warn(
        "[desktop-updater] No GLASS_DESKTOP_UPDATE_GITHUB_TOKEN or GH_TOKEN provided. " +
          "Updates may fail if the repository is private.",
      );
    }
  }

  if (process.env.GLASS_DESKTOP_MOCK_UPDATES) {
    autoUpdater.setFeedURL({
      provider: "generic",
      url: `http://localhost:${process.env.GLASS_DESKTOP_MOCK_UPDATE_SERVER_PORT ?? 3000}`,
    });
  }

  // Runtime override: GLASS_DESKTOP_UPDATE_URL can point to any generic server
  const runtimeUpdateUrl = process.env.GLASS_DESKTOP_UPDATE_URL?.trim();
  if (runtimeUpdateUrl) {
    console.info(`[desktop-updater] Using runtime update URL: ${runtimeUpdateUrl}`);
    autoUpdater.setFeedURL({
      provider: "generic",
      url: runtimeUpdateUrl,
    });
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  // Keep alpha branding, but force all installs onto the stable update track.
  autoUpdater.channel = DESKTOP_UPDATE_CHANNEL;
  autoUpdater.allowPrerelease = DESKTOP_UPDATE_ALLOW_PRERELEASE;
  autoUpdater.allowDowngrade = false;
  autoUpdater.disableDifferentialDownload = isArm64HostRunningIntelBuild(desktopRuntimeInfo);
  let lastLoggedDownloadMilestone = -1;

  if (isArm64HostRunningIntelBuild(desktopRuntimeInfo)) {
    console.info(
      "[desktop-updater] Apple Silicon host detected while running Intel build; updates will switch to arm64 packages.",
    );
  }

  autoUpdater.on("checking-for-update", () => {
    console.info("[desktop-updater] Looking for updates...");
  });
  autoUpdater.on("update-available", (info) => {
    setUpdateState(
      reduceDesktopUpdateStateOnUpdateAvailable(
        updateState,
        info.version,
        new Date().toISOString(),
      ),
    );
    lastLoggedDownloadMilestone = -1;
    console.info(`[desktop-updater] Update available: ${info.version}`);
  });
  autoUpdater.on("update-not-available", () => {
    setUpdateState(reduceDesktopUpdateStateOnNoUpdate(updateState, new Date().toISOString()));
    lastLoggedDownloadMilestone = -1;
    console.info("[desktop-updater] No updates available.");
  });
  autoUpdater.on("error", (error) => {
    const message = formatErrorMessage(error);
    const isPrivateRepo404 =
      message.includes("404") &&
      message.includes("releases.atom") &&
      !process.env.GLASS_DESKTOP_UPDATE_GITHUB_TOKEN;
    const displayMessage = isPrivateRepo404
      ? "Update check failed: Private repository requires GLASS_DESKTOP_UPDATE_GITHUB_TOKEN"
      : message;

    if (updateInstallInFlight) {
      updateInstallInFlight = false;
      isQuitting = false;
      setUpdateState(reduceDesktopUpdateStateOnInstallFailure(updateState, displayMessage));
      console.error(`[desktop-updater] Updater error: ${message}`);
      return;
    }
    if (!updateCheckInFlight && !updateDownloadInFlight) {
      setUpdateState({
        status: "error",
        message: displayMessage,
        checkedAt: new Date().toISOString(),
        downloadPercent: null,
        errorContext: resolveUpdaterErrorContext(),
        canRetry: updateState.availableVersion !== null || updateState.downloadedVersion !== null,
      });
    }
    console.error(`[desktop-updater] Updater error: ${message}`);
  });
  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.floor(progress.percent);
    if (
      shouldBroadcastDownloadProgress(updateState, progress.percent) ||
      updateState.message !== null
    ) {
      setUpdateState(reduceDesktopUpdateStateOnDownloadProgress(updateState, progress.percent));
    }
    const milestone = percent - (percent % 10);
    if (milestone > lastLoggedDownloadMilestone) {
      lastLoggedDownloadMilestone = milestone;
      console.info(`[desktop-updater] Download progress: ${percent}%`);
    }
  });
  autoUpdater.on("update-downloaded", (info) => {
    setUpdateState(reduceDesktopUpdateStateOnDownloadComplete(updateState, info.version));
    console.info(`[desktop-updater] Update downloaded: ${info.version}`);
  });

  clearUpdatePollTimer();

  updateStartupTimer = setTimeout(() => {
    updateStartupTimer = null;
    void checkForUpdates("startup");
  }, AUTO_UPDATE_STARTUP_DELAY_MS);
  updateStartupTimer.unref();

  updatePollTimer = setInterval(() => {
    void checkForUpdates("poll");
  }, AUTO_UPDATE_POLL_INTERVAL_MS);
  updatePollTimer.unref();
}

function flushSessionEvents(): void {
  sessionEventTimer = null;
  if (pendingSessionSummaries.size === 0 && pendingSessionActives.size === 0) return;

  const sums = [...pendingSessionSummaries.values()];
  const acts = [...pendingSessionActives.entries()];
  pendingSessionSummaries.clear();
  pendingSessionActives.clear();

  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    for (const event of sums) {
      window.webContents.send(SESSION_SUMMARY_CHANNEL, event);
    }
  }

  for (const [id, events] of acts) {
    const window = BrowserWindow.getAllWindows().find((item) => item.webContents.id === id);
    if (!window || window.isDestroyed()) continue;
    for (const event of events) {
      window.webContents.send(SESSION_ACTIVE_CHANNEL, event);
    }
  }
}

function emitSessionEvent(event: unknown): void {
  if (!event || typeof event !== "object" || !("lane" in event)) return;

  if (event.lane === "summary") {
    const id = "sessionId" in event && typeof event.sessionId === "string" ? event.sessionId : null;
    if (!id) return;
    pendingSessionSummaries.set(id, event as PiSessionSummaryEvent);
  }

  if (event.lane === "active") {
    const id = "sessionId" in event && typeof event.sessionId === "string" ? event.sessionId : null;
    if (!id) return;
    for (const [wid, sid] of watchedSessions) {
      if (sid !== id) continue;
      const list = pendingSessionActives.get(wid) ?? [];
      list.push(event as PiSessionActiveEvent);
      pendingSessionActives.set(wid, list);
    }
  }

  if (sessionEventTimer) return;

  sessionEventTimer = setTimeout(flushSessionEvents, 16);
  sessionEventTimer.unref();
}

function clearWatchedSession(id: number): void {
  const cur = watchedSessions.get(id);
  watchedSessions.delete(id);
  pendingSessionActives.delete(id);
  if (!cur) return;
  Effect.runSync(sessionService.unwatch(cur));
}

function bindWatchedSession(sender: Electron.WebContents): void {
  if (watchedSenders.has(sender.id)) return;
  watchedSenders.add(sender.id);
  sender.once("destroyed", () => {
    watchedSenders.delete(sender.id);
    clearWatchedSession(sender.id);
  });
}

function clearAllWatchedSessions(): void {
  for (const id of watchedSessions.keys()) {
    clearWatchedSession(id);
  }
}

function restartGitWatch(root: string | null) {
  if (gitWatch) {
    gitWatch.close();
    gitWatch = null;
  }
  if (!root) return;
  const gitDir = Path.join(root, ".git");
  if (!FS.existsSync(gitDir)) return;
  let t: ReturnType<typeof setTimeout> | null = null;
  gitWatch = FS.watch(gitDir, { persistent: true }, () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      void Effect.runPromise(gitService.refresh(shellService.cwd)).catch(() => {});
    }, 250);
  });
}

function emitGlassBootRefresh() {
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue;
    w.webContents.send(GLASS_BOOT_REFRESH_CHANNEL);
  }
}

function registerIpcHandlers(): void {
  registerPaperMcpBootRefresh(emitGlassBootRefresh);
  removeSessionEvents?.();
  removeSessionEvents = sessionService.listen((event) => {
    emitSessionEvent(event);
  });
  removeAskEvents?.();
  removeAskEvents = ask.listen((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) continue;
      window.webContents.send(SESSION_ASK_CHANNEL, event);
    }
  });
  removeGitEvents?.();
  removeGitEvents = gitService.listen((state) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) continue;
      window.webContents.send(GIT_STATE_CHANNEL, state);
    }
  });

  ipcMain.removeHandler(CONFIRM_CHANNEL);
  ipcMain.handle(CONFIRM_CHANNEL, async (_event, message: unknown) => {
    if (typeof message !== "string") {
      return false;
    }

    const owner = BrowserWindow.getFocusedWindow() ?? mainWindow;
    return showDesktopConfirmDialog(message, owner);
  });

  ipcMain.removeHandler(SET_THEME_CHANNEL);
  ipcMain.handle(SET_THEME_CHANNEL, async (_event, rawTheme: unknown) => {
    const theme = getSafeTheme(rawTheme);
    if (!theme) {
      return;
    }

    nativeTheme.themeSource = theme;
  });

  ipcMain.removeHandler(SET_VIBRANCY_CHANNEL);
  ipcMain.handle(SET_VIBRANCY_CHANNEL, async (_event, enabled: unknown) => {
    const useVibrancy = enabled === true;
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) continue;
      if (process.platform === "darwin") {
        window.setVibrancy(useVibrancy ? "sidebar" : null);
      } else if (process.platform === "win32") {
        window.setBackgroundMaterial(useVibrancy ? "acrylic" : "none");
      }
    }
  });

  ipcMain.removeHandler(CONTEXT_MENU_CHANNEL);
  ipcMain.handle(
    CONTEXT_MENU_CHANNEL,
    async (_event, items: ContextMenuItem[], position?: { x: number; y: number }) => {
      const normalizedItems = items
        .filter((item) => typeof item.id === "string" && typeof item.label === "string")
        .map((item) => ({
          id: item.id,
          label: item.label,
          destructive: item.destructive === true,
          disabled: item.disabled === true,
        }));
      if (normalizedItems.length === 0) {
        return null;
      }

      const popupPosition =
        position &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y) &&
        position.x >= 0 &&
        position.y >= 0
          ? {
              x: Math.floor(position.x),
              y: Math.floor(position.y),
            }
          : null;

      const window = BrowserWindow.getFocusedWindow() ?? mainWindow;
      if (!window) return null;

      return new Promise<string | null>((resolve) => {
        const template: MenuItemConstructorOptions[] = [];
        let hasInsertedDestructiveSeparator = false;
        for (const item of normalizedItems) {
          if (item.destructive && !hasInsertedDestructiveSeparator && template.length > 0) {
            template.push({ type: "separator" });
            hasInsertedDestructiveSeparator = true;
          }
          const itemOption: MenuItemConstructorOptions = {
            label: item.label,
            enabled: !item.disabled,
            click: () => resolve(item.id),
          };
          if (item.destructive) {
            const destructiveIcon = getDestructiveMenuIcon();
            if (destructiveIcon) {
              itemOption.icon = destructiveIcon;
            }
          }
          template.push(itemOption);
        }

        const menu = Menu.buildFromTemplate(template);
        menu.popup({
          window,
          ...popupPosition,
          callback: () => resolve(null),
        });
      });
    },
  );

  ipcMain.removeAllListeners(SESSION_LIST_ALL_BOOT_CHANNEL);
  ipcMain.on(SESSION_LIST_ALL_BOOT_CHANNEL, (event) => {
    event.returnValue = sessionService.peek();
  });

  ipcMain.removeHandler(SESSION_LIST_CHANNEL);
  ipcMain.handle(SESSION_LIST_CHANNEL, async () => Effect.runPromise(sessionService.list()));

  ipcMain.removeHandler(SESSION_LIST_ALL_CHANNEL);
  ipcMain.handle(SESSION_LIST_ALL_CHANNEL, async () => Effect.runPromise(sessionService.listAll()));

  ipcMain.removeHandler(SESSION_CREATE_CHANNEL);
  ipcMain.handle(SESSION_CREATE_CHANNEL, async () => Effect.runPromise(sessionService.create()));

  ipcMain.removeHandler(SESSION_GET_CHANNEL);
  ipcMain.handle(SESSION_GET_CHANNEL, async (_event, sessionId: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new Error("Missing session id");
    }
    return Effect.runPromise(sessionService.get(sessionId));
  });

  ipcMain.removeHandler(SESSION_READ_CHANNEL);
  ipcMain.handle(SESSION_READ_CHANNEL, async (_event, sessionId: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new Error("Missing session id");
    }
    const snap = sessionService.read(sessionId);
    if (snap) return snap;
    return Effect.runPromise(sessionService.get(sessionId));
  });

  ipcMain.removeHandler(SESSION_WATCH_CHANNEL);
  ipcMain.handle(SESSION_WATCH_CHANNEL, async (event, sessionId: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new Error("Missing session id");
    }

    bindWatchedSession(event.sender);

    const current = watchedSessions.get(event.sender.id);
    if (current === sessionId) {
      return Effect.runPromise(sessionService.get(sessionId));
    }
    if (current) {
      clearWatchedSession(event.sender.id);
    }
    watchedSessions.set(event.sender.id, sessionId);
    return Effect.runPromise(
      sessionService.watch(sessionId).pipe(
        Effect.tapError(() =>
          Effect.sync(() => {
            watchedSessions.delete(event.sender.id);
            pendingSessionActives.delete(event.sender.id);
          }).pipe(Effect.andThen(sessionService.unwatch(sessionId))),
        ),
      ),
    );
  });

  ipcMain.removeHandler(SESSION_UNWATCH_CHANNEL);
  ipcMain.handle(SESSION_UNWATCH_CHANNEL, async (event) => {
    clearWatchedSession(event.sender.id);
  });

  ipcMain.removeHandler(SESSION_PROMPT_CHANNEL);
  ipcMain.handle(SESSION_PROMPT_CHANNEL, async (_event, sessionId: unknown, input: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new Error("Missing session id");
    }
    if (typeof input !== "string" && (typeof input !== "object" || input === null)) {
      throw new Error("Missing prompt input");
    }
    await Effect.runPromise(sessionService.prompt(sessionId, input as string | PiPromptInput));
  });

  ipcMain.removeHandler(SESSION_COMMANDS_CHANNEL);
  ipcMain.handle(SESSION_COMMANDS_CHANNEL, async (_event, sessionId: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new Error("Missing session id");
    }
    return Effect.runPromise(sessionService.commands(sessionId));
  });

  ipcMain.removeHandler(SESSION_READ_ASK_CHANNEL);
  ipcMain.handle(SESSION_READ_ASK_CHANNEL, async (_event, sessionId: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new Error("Missing session id");
    }
    return ask.read(sessionId);
  });

  ipcMain.removeHandler(SESSION_ANSWER_ASK_CHANNEL);
  ipcMain.handle(SESSION_ANSWER_ASK_CHANNEL, async (_event, sessionId: unknown, reply: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new Error("Missing session id");
    }
    if (!reply || typeof reply !== "object") {
      throw new Error("Missing ask reply");
    }
    ask.answer(sessionId, reply as Parameters<typeof ask.answer>[1]);
  });

  ipcMain.removeHandler(SESSION_ABORT_CHANNEL);
  ipcMain.handle(SESSION_ABORT_CHANNEL, async (_event, sessionId: unknown) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new Error("Missing session id");
    }
    await Effect.runPromise(sessionService.abort(sessionId));
  });

  ipcMain.removeHandler(SESSION_SET_MODEL_CHANNEL);
  ipcMain.handle(
    SESSION_SET_MODEL_CHANNEL,
    async (_event, sessionId: unknown, provider: unknown, model: unknown) => {
      if (typeof sessionId !== "string" || !sessionId.trim()) {
        throw new Error("Missing session id");
      }
      if (typeof provider !== "string" || !provider.trim()) {
        throw new Error("Missing provider");
      }
      if (typeof model !== "string" || !model.trim()) {
        throw new Error("Missing model");
      }
      await Effect.runPromise(sessionService.setModel(sessionId, provider, model));
    },
  );

  const thinkingLevels = new Set<PiThinkingLevel>([
    "off",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
  ]);
  ipcMain.removeHandler(SESSION_SET_THINKING_LEVEL_CHANNEL);
  ipcMain.handle(
    SESSION_SET_THINKING_LEVEL_CHANNEL,
    async (_event, sessionId: unknown, level: unknown) => {
      if (typeof sessionId !== "string" || !sessionId.trim()) {
        throw new Error("Missing session id");
      }
      if (typeof level !== "string" || !thinkingLevels.has(level as PiThinkingLevel)) {
        throw new Error("Invalid thinking level");
      }
      await Effect.runPromise(sessionService.setThinkingLevel(sessionId, level as PiThinkingLevel));
    },
  );

  ipcMain.removeAllListeners(PI_GET_BOOT_CONFIG_CHANNEL);
  ipcMain.on(PI_GET_BOOT_CONFIG_CHANNEL, (event) => {
    try {
      void Effect.runPromise(pi.prepare(shellService.cwd));
      event.returnValue = Effect.runSync(pi.getConfig(shellService.cwd));
    } catch {
      event.returnValue = null;
    }
  });

  ipcMain.removeHandler(PI_GET_CONFIG_CHANNEL);
  ipcMain.handle(PI_GET_CONFIG_CHANNEL, async () => {
    await Effect.runPromise(pi.prepare(shellService.cwd));
    return Effect.runSync(pi.getConfig(shellService.cwd));
  });

  ipcMain.removeHandler(PI_SET_DEFAULT_MODEL_CHANNEL);
  ipcMain.handle(
    PI_SET_DEFAULT_MODEL_CHANNEL,
    async (_event, provider: unknown, model: unknown) => {
      if (typeof provider !== "string" || !provider.trim()) {
        throw new Error("Missing provider");
      }
      if (typeof model !== "string" || !model.trim()) {
        throw new Error("Missing model");
      }
      await Effect.runPromise(pi.setDefaultModel(shellService.cwd, provider, model));
      emitGlassBootRefresh();
    },
  );

  ipcMain.removeHandler(PI_CLEAR_DEFAULT_MODEL_CHANNEL);
  ipcMain.handle(PI_CLEAR_DEFAULT_MODEL_CHANNEL, async () => {
    await Effect.runPromise(pi.clearDefaultModel(shellService.cwd));
    emitGlassBootRefresh();
  });

  ipcMain.removeHandler(PI_SET_DEFAULT_THINKING_CHANNEL);
  ipcMain.handle(PI_SET_DEFAULT_THINKING_CHANNEL, async (_event, thinking: unknown) => {
    if (typeof thinking !== "string" || !thinking.trim()) {
      throw new Error("Missing thinking level");
    }
    await Effect.runPromise(pi.setDefaultThinkingLevel(shellService.cwd, thinking));
    emitGlassBootRefresh();
  });

  ipcMain.removeHandler(PI_GET_API_KEY_CHANNEL);
  ipcMain.handle(PI_GET_API_KEY_CHANNEL, async (_event, provider: unknown) => {
    if (typeof provider !== "string" || !provider.trim()) {
      throw new Error("Missing provider");
    }
    return Effect.runPromise(pi.getApiKey(provider));
  });

  ipcMain.removeHandler(PI_SET_API_KEY_CHANNEL);
  ipcMain.handle(PI_SET_API_KEY_CHANNEL, async (_event, provider: unknown, key: unknown) => {
    if (typeof provider !== "string" || !provider.trim()) {
      throw new Error("Missing provider");
    }
    if (typeof key !== "string" || !key.trim()) {
      throw new Error("Missing key");
    }
    await Effect.runPromise(pi.setApiKey(provider, key));
    emitGlassBootRefresh();
  });

  ipcMain.removeHandler(PI_SET_NATIVE_GLASS_EXT_CHANNEL);
  ipcMain.handle(PI_SET_NATIVE_GLASS_EXT_CHANNEL, async (_event, enabled: unknown) => {
    if (typeof enabled !== "boolean") throw new Error("Invalid native extensions flag");
    await Effect.runPromise(pi.setNativeGlassExtensionsEnabled(enabled));
    emitGlassBootRefresh();
  });

  ipcMain.removeListener(PI_OAUTH_PROMPT_REPLY_CHANNEL, oauthPromptReplyHandler);
  ipcMain.on(PI_OAUTH_PROMPT_REPLY_CHANNEL, oauthPromptReplyHandler);

  ipcMain.removeAllListeners(EXT_UI_REPLY_CHANNEL);
  ipcMain.on(EXT_UI_REPLY_CHANNEL, (_event, data: ExtUiReply) => {
    if (!data || typeof data !== "object") return;
    if (typeof data.id !== "string" || !data.id) return;
    extUi.reply(data);
  });

  ipcMain.removeAllListeners(EXT_UI_COMPOSER_DRAFT_CHANNEL);
  ipcMain.on(EXT_UI_COMPOSER_DRAFT_CHANNEL, (_event, text: unknown) => {
    if (typeof text !== "string") return;
    extUi.setComposerDraft(text);
  });

  ipcMain.removeHandler(PI_START_OAUTH_LOGIN_CHANNEL);
  ipcMain.handle(PI_START_OAUTH_LOGIN_CHANNEL, async (_event, provider: unknown) => {
    if (typeof provider !== "string" || !provider.trim()) {
      throw new Error("Missing provider");
    }
    const id = provider.trim();
    await Effect.runPromise(
      pi.oauthLogin(shellService.cwd, id, {
        onAuth: (info) => {
          if (info.url) void shell.openExternal(info.url);
        },
        onPrompt: async (p) => {
          return new Promise((resolve, reject) => {
            const w = BrowserWindow.getFocusedWindow() ?? mainWindow;
            if (!w) {
              reject(new Error("No window"));
              return;
            }
            oauthPromptResolve = resolve;
            w.webContents.send(PI_OAUTH_PROMPT_CHANNEL, {
              message: p.message,
              placeholder: p.placeholder ?? "",
            });
          });
        },
        onManualCodeInput: () => {
          return new Promise((resolve, reject) => {
            const w = BrowserWindow.getFocusedWindow() ?? mainWindow;
            if (!w) {
              reject(new Error("No window"));
              return;
            }
            oauthPromptResolve = resolve;
            w.webContents.send(PI_OAUTH_PROMPT_CHANNEL, {
              message: "Paste redirect URL or code:",
              placeholder: "",
            });
          });
        },
      }),
    );
    emitGlassBootRefresh();
  });

  ipcMain.removeHandler(SHELL_GET_STATE_CHANNEL);
  ipcMain.handle(SHELL_GET_STATE_CHANNEL, async () => Effect.runPromise(shellService.getState()));

  ipcMain.removeHandler(SHELL_GET_EDITOR_ICONS_CHANNEL);
  ipcMain.handle(SHELL_GET_EDITOR_ICONS_CHANNEL, async () =>
    Effect.runPromise(shellService.getEditorIcons()),
  );

  ipcMain.removeHandler(SHELL_PICK_WORKSPACE_CHANNEL);
  ipcMain.handle(SHELL_PICK_WORKSPACE_CHANNEL, async () => {
    const owner = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const next = await Effect.runPromise(shellService.pickWorkspace(owner));
    if (next) {
      await pi.init(next.cwd);
      clearAllWatchedSessions();
      const state = await Effect.runPromise(gitService.refresh(next.cwd));
      restartGitWatch(state.gitRoot);
      emitGlassBootRefresh();
    }
    return next;
  });

  ipcMain.removeHandler(SHELL_SET_WORKSPACE_CHANNEL);
  ipcMain.handle(SHELL_SET_WORKSPACE_CHANNEL, async (_event, cwd: unknown) => {
    if (typeof cwd !== "string" || !cwd.trim()) {
      throw new Error("Missing cwd");
    }
    clearAllWatchedSessions();
    const next = await Effect.runPromise(shellService.setWorkspace(cwd));
    await pi.init(next.cwd);
    const state = await Effect.runPromise(gitService.refresh(next.cwd));
    restartGitWatch(state.gitRoot);
    emitGlassBootRefresh();
    return next;
  });

  ipcMain.removeHandler(SHELL_OPEN_IN_EDITOR_CHANNEL);
  ipcMain.handle(SHELL_OPEN_IN_EDITOR_CHANNEL, async (_event, path: unknown, editor: unknown) => {
    if (typeof path !== "string" || !path.trim()) {
      throw new Error("Missing path");
    }
    if (typeof editor !== "string" || !editor.trim()) {
      throw new Error("Missing editor");
    }
    await Effect.runPromise(shellService.openInEditor(path, editor));
  });

  ipcMain.removeHandler(SHELL_OPEN_EXTERNAL_CHANNEL);
  ipcMain.handle(SHELL_OPEN_EXTERNAL_CHANNEL, async (_event, rawUrl: unknown) => {
    const externalUrl = getSafeExternalUrl(rawUrl);
    if (!externalUrl) {
      return false;
    }
    return Effect.runPromise(shellService.openExternal(externalUrl));
  });

  ipcMain.removeHandler(SHELL_SUGGEST_FILES_CHANNEL);
  ipcMain.handle(SHELL_SUGGEST_FILES_CHANNEL, async (_event, query: unknown) => {
    if (typeof query !== "string") {
      throw new Error("Missing query");
    }
    return Effect.runPromise(shellService.suggestFiles(query));
  });

  ipcMain.removeHandler(SHELL_PREVIEW_FILE_CHANNEL);
  ipcMain.handle(SHELL_PREVIEW_FILE_CHANNEL, async (_event, path: unknown) => {
    if (typeof path !== "string" || !path.trim()) {
      throw new Error("Missing path");
    }
    return Effect.runPromise(shellService.previewFile(path));
  });

  ipcMain.removeHandler(SHELL_PICK_FILES_CHANNEL);
  ipcMain.handle(SHELL_PICK_FILES_CHANNEL, async () => {
    const owner = BrowserWindow.getFocusedWindow() ?? mainWindow;
    return Effect.runPromise(shellService.pickFiles(owner));
  });

  ipcMain.removeHandler(SHELL_INSPECT_FILES_CHANNEL);
  ipcMain.handle(SHELL_INSPECT_FILES_CHANNEL, async (_event, paths: unknown) => {
    if (!Array.isArray(paths) || paths.some((item) => typeof item !== "string" || !item.trim())) {
      throw new Error("Missing paths");
    }
    return Effect.runPromise(shellService.inspectFiles(paths));
  });

  ipcMain.removeHandler(GIT_GET_STATE_CHANNEL);
  ipcMain.handle(GIT_GET_STATE_CHANNEL, async (_event, cwd: unknown) => {
    if (typeof cwd !== "string" || !cwd.trim()) {
      throw new Error("Missing cwd");
    }
    const state = await Effect.runPromise(gitService.get(cwd));
    restartGitWatch(state.gitRoot);
    return state;
  });

  ipcMain.removeHandler(GIT_REFRESH_CHANNEL);
  ipcMain.handle(GIT_REFRESH_CHANNEL, async (_event, cwd: unknown) => {
    if (typeof cwd !== "string" || !cwd.trim()) {
      throw new Error("Missing cwd");
    }
    const state = await Effect.runPromise(gitService.refresh(cwd));
    restartGitWatch(state.gitRoot);
    return state;
  });

  ipcMain.removeHandler(GIT_INIT_CHANNEL);
  ipcMain.handle(GIT_INIT_CHANNEL, async (_event, cwd: unknown) => {
    if (typeof cwd !== "string" || !cwd.trim()) {
      throw new Error("Missing cwd");
    }
    const state = await Effect.runPromise(gitService.init(cwd));
    restartGitWatch(state.gitRoot);
    return state;
  });

  ipcMain.removeHandler(GIT_DISCARD_CHANNEL);
  ipcMain.handle(GIT_DISCARD_CHANNEL, async (_event, cwd: unknown, paths: unknown) => {
    if (typeof cwd !== "string" || !cwd.trim()) {
      throw new Error("Missing cwd");
    }
    if (!Array.isArray(paths) || !paths.every((p) => typeof p === "string")) {
      throw new Error("Missing paths");
    }
    const state = await Effect.runPromise(gitService.discard(cwd, paths as string[]));
    restartGitWatch(state.gitRoot);
    return state;
  });

  ipcMain.removeHandler(UPDATE_GET_STATE_CHANNEL);
  ipcMain.handle(UPDATE_GET_STATE_CHANNEL, async () => updateState);

  ipcMain.removeHandler(UPDATE_DOWNLOAD_CHANNEL);
  ipcMain.handle(UPDATE_DOWNLOAD_CHANNEL, async () => {
    const result = await downloadAvailableUpdate();
    return {
      accepted: result.accepted,
      completed: result.completed,
      state: updateState,
    } satisfies DesktopUpdateActionResult;
  });

  ipcMain.removeHandler(UPDATE_INSTALL_CHANNEL);
  ipcMain.handle(UPDATE_INSTALL_CHANNEL, async () => {
    if (isQuitting) {
      return {
        accepted: false,
        completed: false,
        state: updateState,
      } satisfies DesktopUpdateActionResult;
    }
    const result = await installDownloadedUpdate();
    return {
      accepted: result.accepted,
      completed: result.completed,
      state: updateState,
    } satisfies DesktopUpdateActionResult;
  });

  ipcMain.removeHandler(UPDATE_CHECK_CHANNEL);
  ipcMain.handle(UPDATE_CHECK_CHANNEL, async () => {
    if (!updaterConfigured) {
      return {
        checked: false,
        state: updateState,
      } satisfies DesktopUpdateCheckResult;
    }
    const checked = await checkForUpdates("web-ui");
    return {
      checked,
      state: updateState,
    } satisfies DesktopUpdateCheckResult;
  });
}

function getIconOption(): { icon: string } | Record<string, never> {
  if (process.platform === "darwin") return {}; // macOS uses .icns from app bundle
  const ext = process.platform === "win32" ? "ico" : "png";
  const iconPath = resolveResourcePath(`icon.${ext}`);
  return iconPath ? { icon: iconPath } : {};
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    transparent: true,
    backgroundColor: "#00000000",
    vibrancy: "sidebar",
    ...getIconOption(),
    title: APP_DISPLAY_NAME,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 14 },
    webPreferences: {
      preload: Path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.on("context-menu", (event, params) => {
    event.preventDefault();

    const menuTemplate: MenuItemConstructorOptions[] = [];

    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        menuTemplate.push({
          label: suggestion,
          click: () => window.webContents.replaceMisspelling(suggestion),
        });
      }
      if (params.dictionarySuggestions.length === 0) {
        menuTemplate.push({ label: "No suggestions", enabled: false });
      }
      menuTemplate.push({ type: "separator" });
    }

    menuTemplate.push(
      { role: "cut", enabled: params.editFlags.canCut },
      { role: "copy", enabled: params.editFlags.canCopy },
      { role: "paste", enabled: params.editFlags.canPaste },
      { role: "selectAll", enabled: params.editFlags.canSelectAll },
    );

    Menu.buildFromTemplate(menuTemplate).popup({ window });
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    const externalUrl = getSafeExternalUrl(url);
    if (externalUrl) {
      void shell.openExternal(externalUrl);
    }
    return { action: "deny" };
  });

  window.on("page-title-updated", (event) => {
    event.preventDefault();
    window.setTitle(APP_DISPLAY_NAME);
  });
  window.webContents.on("did-finish-load", () => {
    window.setTitle(APP_DISPLAY_NAME);
    emitUpdateState();
  });
  window.once("ready-to-show", () => {
    window.show();
  });

  if (isDevelopment) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL as string);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    void window.loadURL(`${DESKTOP_SCHEME}://app/index.html`);
  }

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
}

// Override Electron's userData path before the `ready` event so that
// Chromium session data uses a filesystem-friendly directory name.
// Must be called synchronously at the top level — before `app.whenReady()`.
app.setPath("userData", resolveUserDataPath());

configureAppIdentity();

async function bootstrap(): Promise<void> {
  writeDesktopLogHeader("bootstrap start");
  await pi.init(shellService.cwd);
  registerIpcHandlers();
  writeDesktopLogHeader("bootstrap ipc handlers registered");
  await Effect.runPromise(
    Effect.match(sessionService.listAll(), {
      onFailure: () => [],
      onSuccess: (items) => items,
    }),
  );
  writeDesktopLogHeader("bootstrap session summaries primed");
  mainWindow = createWindow();
  writeDesktopLogHeader("bootstrap main window created");
}

app.on("before-quit", () => {
  isQuitting = true;
  updateInstallInFlight = false;
  writeDesktopLogHeader("before-quit received");
  clearUpdatePollTimer();
  gitWatch?.close();
  gitWatch = null;
  removeGitEvents?.();
  removeGitEvents = null;
  removeSessionEvents?.();
  removeSessionEvents = null;
  sessionService.dispose();
  restoreStdIoCapture?.();
});

app
  .whenReady()
  .then(() => {
    writeDesktopLogHeader("app ready");
    configureAppIdentity();
    configureApplicationMenu();
    registerDesktopProtocol();
    configureAutoUpdater();
    void bootstrap().catch((error) => {
      handleFatalStartupError("bootstrap", error);
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
      }
    });
  })
  .catch((error) => {
    handleFatalStartupError("whenReady", error);
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !isQuitting) {
    app.quit();
  }
});

if (process.platform !== "win32") {
  process.on("SIGINT", () => {
    if (isQuitting) return;
    isQuitting = true;
    writeDesktopLogHeader("SIGINT received");
    clearUpdatePollTimer();
    gitWatch?.close();
    gitWatch = null;
    removeGitEvents?.();
    removeGitEvents = null;
    removeSessionEvents?.();
    removeSessionEvents = null;
    sessionService.dispose();
    restoreStdIoCapture?.();
    app.quit();
  });

  process.on("SIGTERM", () => {
    if (isQuitting) return;
    isQuitting = true;
    writeDesktopLogHeader("SIGTERM received");
    clearUpdatePollTimer();
    gitWatch?.close();
    gitWatch = null;
    removeGitEvents?.();
    removeGitEvents = null;
    removeSessionEvents?.();
    removeSessionEvents = null;
    sessionService.dispose();
    restoreStdIoCapture?.();
    app.quit();
  });
}
