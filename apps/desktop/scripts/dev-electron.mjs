import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, watch, writeFileSync } from "node:fs";
import { join } from "node:path";

import { desktopDir, resolveElectronPath } from "./electron-launcher.mjs";
import { waitForResources } from "./wait-for-resources.mjs";

const port = Number(process.env.ELECTRON_RENDERER_PORT ?? 5733);
const devServerUrl = `http://localhost:${port}`;
const requiredFiles = ["dist-electron/main.js", "dist-electron/preload.js"];
const watchedDirectories = [
  { directory: "dist-electron", files: new Set(["main.js", "preload.js"]) },
];
const forcedShutdownTimeoutMs = 1_500;
const restartDebounceMs = 120;
const childTreeGracePeriodMs = 1_200;
const runDir = join(desktopDir, ".electron-runtime");
const pidPath = join(runDir, `dev-electron-${port}.json`);
const args = [
  `--glass-dev-root=${desktopDir}`,
  `--glass-dev-port=${port}`,
  "dist-electron/main.js",
];

await waitForResources({
  baseDir: desktopDir,
  files: requiredFiles,
  tcpPort: port,
});

const childEnv = { ...process.env };
delete childEnv.ELECTRON_RUN_AS_NODE;

let shuttingDown = false;
let restartTimer = null;
let currentApp = null;
let restartQueue = Promise.resolve();
const expectedExits = new WeakSet();
const watchers = [];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function kill(pid, signal) {
  if (!alive(pid)) {
    return;
  }

  try {
    process.kill(pid, signal);
  } catch {}
}

async function waitForExit(pid, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (alive(pid) && Date.now() < end) {
    await wait(100);
  }
}

function escape(value) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

async function claim() {
  mkdirSync(runDir, { recursive: true });

  const pid = readJson(pidPath)?.pid;
  if (pid && pid !== process.pid) {
    kill(pid, "SIGTERM");
    await waitForExit(pid, forcedShutdownTimeoutMs);

    if (alive(pid)) {
      kill(pid, "SIGKILL");
      await waitForExit(pid, forcedShutdownTimeoutMs);
    }

    if (alive(pid)) {
      throw new Error(`dev-electron is already running for port ${port} (pid ${pid})`);
    }
  }

  writeFileSync(
    pidPath,
    `${JSON.stringify({ pid: process.pid, port, root: desktopDir }, null, 2)}\n`,
  );
}

function release() {
  if (readJson(pidPath)?.pid !== process.pid) {
    return;
  }

  rmSync(pidPath, { force: true });
}

function killChildTreeByPid(pid, signal) {
  if (process.platform === "win32" || typeof pid !== "number") {
    return;
  }

  spawnSync("pkill", [`-${signal}`, "-P", String(pid)], { stdio: "ignore" });
}

function cleanupStaleDevApps() {
  if (process.platform === "win32") {
    return;
  }

  spawnSync(
    "pkill",
    ["-f", "--", `--glass-dev-root=${escape(desktopDir)}.*--glass-dev-port=${port}`],
    { stdio: "ignore" },
  );
}

function startApp() {
  if (shuttingDown || currentApp !== null) {
    return;
  }

  const app = spawn(resolveElectronPath(), args, {
    cwd: desktopDir,
    env: {
      ...childEnv,
      VITE_DEV_SERVER_URL: devServerUrl,
    },
    stdio: "inherit",
  });

  currentApp = app;

  app.once("error", () => {
    if (currentApp === app) {
      currentApp = null;
    }

    if (!shuttingDown) {
      scheduleRestart();
    }
  });

  app.once("exit", (code, signal) => {
    if (currentApp === app) {
      currentApp = null;
    }

    const exitedAbnormally = signal !== null || code !== 0;
    if (!shuttingDown && !expectedExits.has(app) && exitedAbnormally) {
      scheduleRestart();
    }
  });
}

async function stopApp() {
  const app = currentApp;
  if (!app) {
    return;
  }

  currentApp = null;
  expectedExits.add(app);

  await new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    };

    app.once("exit", finish);
    app.kill("SIGTERM");
    killChildTreeByPid(app.pid, "TERM");

    setTimeout(() => {
      if (settled) {
        return;
      }

      app.kill("SIGKILL");
      killChildTreeByPid(app.pid, "KILL");
      finish();
    }, forcedShutdownTimeoutMs).unref();
  });
}

function scheduleRestart() {
  if (shuttingDown) {
    return;
  }

  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(() => {
    restartTimer = null;
    restartQueue = restartQueue
      .catch(() => undefined)
      .then(async () => {
        await stopApp();
        if (!shuttingDown) {
          startApp();
        }
      });
  }, restartDebounceMs);
}

function startWatchers() {
  for (const { directory, files } of watchedDirectories) {
    const watcher = watch(
      join(desktopDir, directory),
      { persistent: true },
      (_eventType, filename) => {
        if (typeof filename !== "string" || !files.has(filename)) {
          return;
        }

        scheduleRestart();
      },
    );

    watchers.push(watcher);
  }
}

function killChildTree(signal) {
  if (process.platform === "win32") {
    return;
  }

  // Kill direct children as a final fallback in case normal shutdown leaves stragglers.
  spawnSync("pkill", [`-${signal}`, "-P", String(process.pid)], { stdio: "ignore" });
}

async function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  for (const watcher of watchers) {
    watcher.close();
  }

  await stopApp();
  killChildTree("TERM");
  await wait(childTreeGracePeriodMs);
  killChildTree("KILL");
  release();

  process.exit(exitCode);
}

await claim();
startWatchers();
cleanupStaleDevApps();
startApp();

process.once("exit", () => {
  release();
});
process.once("SIGINT", () => {
  void shutdown(130);
});
process.once("SIGTERM", () => {
  void shutdown(143);
});
process.once("SIGHUP", () => {
  void shutdown(129);
});
