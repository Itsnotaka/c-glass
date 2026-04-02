import { spawn } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import { dialog, shell } from "electron";
import * as Effect from "effect/Effect";
import { EDITORS } from "@glass/contracts";

function pathValue(env: NodeJS.ProcessEnv) {
  return env.PATH ?? env.Path ?? env.path ?? "";
}

function pathExt(env: NodeJS.ProcessEnv) {
  const raw = env.PATHEXT;
  if (!raw) return [".COM", ".EXE", ".BAT", ".CMD"];
  const list = raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (entry.startsWith(".") ? entry.toUpperCase() : `.${entry.toUpperCase()}`));
  return list.length > 0 ? [...new Set(list)] : [".COM", ".EXE", ".BAT", ".CMD"];
}

function candidates(command: string, platform: NodeJS.Platform, ext: readonly string[]) {
  if (platform !== "win32") return [command];
  const cur = Path.extname(command);
  const upper = cur.toUpperCase();
  if (cur && ext.includes(upper)) {
    const base = command.slice(0, -cur.length);
    return [...new Set([command, `${base}${upper}`, `${base}${upper.toLowerCase()}`])];
  }
  const list = ext.flatMap((item) => [`${command}${item}`, `${command}${item.toLowerCase()}`]);
  return [...new Set(list)];
}

function executable(file: string, platform: NodeJS.Platform, ext: readonly string[]) {
  try {
    const stat = statSync(file);
    if (!stat.isFile()) return false;
    if (platform === "win32") {
      const cur = Path.extname(file);
      if (!cur) return false;
      return ext.includes(cur.toUpperCase());
    }
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function delimiter(platform: NodeJS.Platform) {
  return platform === "win32" ? ";" : ":";
}

function available(command: string, env: NodeJS.ProcessEnv = process.env) {
  const platform = process.platform;
  const ext = platform === "win32" ? pathExt(env) : [];
  const list = candidates(command, platform, ext);
  if (command.includes("/") || command.includes("\\")) {
    return list.some((item) => executable(item, platform, ext));
  }
  const raw = pathValue(env);
  if (!raw) return false;
  const dirs = raw
    .split(delimiter(platform))
    .map((entry) => entry.trim().replace(/^"+|"+$/g, ""))
    .filter(Boolean);
  return dirs.some((dir) => list.some((item) => executable(Path.join(dir, item), platform, ext)));
}

function fileManager() {
  if (process.platform === "darwin") return "open";
  if (process.platform === "win32") return "explorer";
  return "xdg-open";
}

function resolveLaunch(path: string, editor: (typeof EDITORS)[number]) {
  if (editor.command) {
    if (editor.supportsGoto && /:\d+(?::\d+)?$/.test(path)) {
      return { command: editor.command, args: ["--goto", path] };
    }
    return { command: editor.command, args: [path] };
  }
  return { command: fileManager(), args: [path] };
}

function runDetached(command: string, args: readonly string[]) {
  return Effect.tryPromise({
    try: () =>
      new Promise<void>((resolve, reject) => {
        let done = false;
        const fail = (err: unknown) => {
          if (done) return;
          done = true;
          reject(err instanceof Error ? err : new Error(String(err)));
        };

        try {
          const child = spawn(command, [...args], {
            detached: true,
            stdio: "ignore",
            shell: process.platform === "win32",
          });

          child.once("spawn", () => {
            if (done) return;
            done = true;
            child.unref();
            resolve();
          });
          child.once("error", fail);
        } catch (err) {
          fail(err);
        }
      }),
    catch: (err) => (err instanceof Error ? err : new Error(String(err))),
  });
}

function defaultCwd() {
  const cwd = process.cwd();
  try {
    if (statSync(cwd).isDirectory()) return cwd;
  } catch {}
  return OS.homedir();
}

function saved(path: string | null) {
  if (!path || !existsSync(path)) return null;
  return Effect.runSync(
    Effect.match(
      Effect.sync(() => {
        const data = JSON.parse(readFileSync(path, "utf8")) as { cwd?: unknown };
        if (typeof data.cwd !== "string" || !data.cwd.trim()) return null;
        if (!statSync(data.cwd).isDirectory()) return null;
        return data.cwd;
      }),
      {
        onFailure: () => null,
        onSuccess: (cwd) => cwd,
      },
    ),
  );
}

export class ShellService {
  cwd: string;
  private path: string | null;

  constructor(path?: string) {
    this.path = path ?? null;
    this.cwd = saved(this.path) ?? defaultCwd();
  }

  private save() {
    if (!this.path) return;
    mkdirSync(Path.dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify({ cwd: this.cwd }), "utf8");
  }

  availableEditors() {
    const list = EDITORS.filter((item) => available(item.command ?? fileManager()));
    return list.map((item) => item.id);
  }

  getState() {
    return Effect.sync(() => ({
      cwd: this.cwd,
      name: Path.basename(this.cwd) || this.cwd,
      availableEditors: this.availableEditors(),
    }));
  }

  pickWorkspace(owner?: Electron.BrowserWindow | null) {
    return Effect.tryPromise({
      try: async () => {
        const result = owner
          ? await dialog.showOpenDialog(owner, {
              properties: ["openDirectory", "createDirectory"],
            })
          : await dialog.showOpenDialog({
              properties: ["openDirectory", "createDirectory"],
            });
        const next = result.canceled ? null : (result.filePaths[0] ?? null);
        if (!next) return null;
        this.cwd = next;
        this.save();
        return {
          cwd: this.cwd,
          name: Path.basename(this.cwd) || this.cwd,
          availableEditors: this.availableEditors(),
        };
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  openInEditor(path: string, editorId: string) {
    return Effect.gen(function* () {
      const editor = EDITORS.find((item) => item.id === editorId);
      if (!editor) {
        return yield* Effect.fail(new Error(`Unknown editor: ${editorId}`));
      }
      const launch = resolveLaunch(path, editor);
      if (!available(launch.command)) {
        return yield* Effect.fail(new Error(`Editor command not found: ${launch.command}`));
      }
      yield* runDetached(launch.command, launch.args);
    });
  }

  openExternal(url: string) {
    return Effect.tryPromise({
      try: async () => {
        await shell.openExternal(url);
        return true;
      },
      catch: () => false,
    });
  }
}
