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
import { readdir, readFile, stat } from "node:fs/promises";
import * as OS from "node:os";
import * as Path from "node:path";

import type { EditorIcon, ShellFileHit, ShellPickedFile, ShellFilePreview } from "@glass/contracts";
import { EDITORS } from "@glass/contracts";
import { dialog, nativeImage, shell } from "electron";
import * as Effect from "effect/Effect";
import { image, mime, readText, resolveFile, short, text } from "./files";

const skip = new Set([
  ".git",
  ".convex",
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "out",
  ".cache",
]);
const max = 25_000;
const ttl = 15_000;

type Row = ShellFileHit;

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
    const root = command.slice(0, -cur.length);
    return [...new Set([command, `${root}${upper}`, `${root}${upper.toLowerCase()}`])];
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

export function commandAvailable(command: string, env: NodeJS.ProcessEnv = process.env) {
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

function bundle(editor: (typeof EDITORS)[number]) {
  if (process.platform !== "darwin" || !editor.app) return null;
  return (
    [
      Path.join("/Applications", `${editor.app}.app`),
      Path.join("/System/Volumes/Data/Applications", `${editor.app}.app`),
      Path.join(OS.homedir(), "Applications", `${editor.app}.app`),
    ].find((item) => existsSync(item)) ?? null
  );
}

function bin(editor: (typeof EDITORS)[number]) {
  if (!editor.command) return null;
  const app = bundle(editor);
  if (!app) return null;
  const file = Path.join(app, "Contents/Resources/app/bin", editor.command);
  return executable(file, process.platform, []) ? file : null;
}

function runner(editor: (typeof EDITORS)[number]) {
  if (!editor.command) {
    return { command: fileManager(), args: [] };
  }
  if (commandAvailable(editor.command)) {
    return { command: editor.command, args: [] };
  }
  const file = bin(editor);
  if (file) {
    return { command: file, args: [] };
  }
  if (process.platform === "darwin" && editor.app && bundle(editor)) {
    return { command: "open", args: ["-a", editor.app] };
  }
  return null;
}

function resolveLaunch(path: string, editor: (typeof EDITORS)[number]) {
  const base = runner(editor);
  if (!base) return null;
  if (base.command === "open" && base.args[0] === "-a") {
    if (editor.supportsGoto && /:\d+(?::\d+)?$/.test(path)) {
      return { command: base.command, args: [...base.args, "--args", "--goto", path] };
    }
    return { command: base.command, args: [...base.args, path] };
  }
  if (editor.supportsGoto && /:\d+(?::\d+)?$/.test(path)) {
    return { command: base.command, args: [...base.args, "--goto", path] };
  }
  return { command: base.command, args: [...base.args, path] };
}

function runDetached(command: string, args: readonly string[]) {
  return Effect.tryPromise({
    try: () =>
      new Promise<void>((resolve, reject) => {
        let done = false;
        const fail = (err: Error | string | null | undefined) => {
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
          fail(err instanceof Error ? err : new Error(String(err)));
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
        const data = JSON.parse(readFileSync(path, "utf8")) as { cwd?: string };
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

function clean(query: string) {
  const raw = query.trim();
  if (!raw) return "";
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length > 1) {
    return raw.slice(1, -1);
  }
  if (raw.startsWith('"')) return raw.slice(1);
  return raw;
}

function norm(query: string) {
  return clean(query)
    .trim()
    .replace(/^[@./]+/, "")
    .toLowerCase();
}

function fuzz(text: string, key: string) {
  if (!key) return 0;

  let pos = 0;
  let first = -1;
  let last = -1;
  let gap = 0;

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== key[pos]) continue;
    if (first < 0) first = i;
    if (last >= 0) {
      gap += i - last - 1;
    }
    last = i;
    pos += 1;
    if (pos === key.length) {
      const span = i - first + 1 - key.length;
      const len = Math.min(64, text.length - key.length);
      return first * 2 + gap * 3 + span + len;
    }
  }

  return null;
}

function score(row: Row, raw: string) {
  const query = norm(raw);
  if (!query) return row.kind === "dir" ? 0 : 1;

  const path = row.path.toLowerCase();
  const name = row.name.toLowerCase();

  if (name === query) return 0;
  if (path === query) return 1;
  if (name.startsWith(query)) return 2;
  if (path.startsWith(query)) return 3;
  if (path.includes(`/${query}`)) return 4;
  if (name.includes(query)) return 5;
  if (path.includes(query)) return 6;

  const byName = fuzz(name, query);
  if (byName !== null) return 100 + byName;

  const byPath = fuzz(path, query);
  if (byPath !== null) return 200 + byPath;

  return null;
}

function base(path: string) {
  const cut = path.lastIndexOf("/");
  if (cut < 0) return path;
  return path.slice(cut + 1);
}

function ignored(path: string) {
  const head = path.split("/")[0];
  if (!head) return false;
  return skip.has(head);
}

function parents(path: string) {
  const list = path.split("/").filter(Boolean);
  if (list.length <= 1) return [];

  const out: string[] = [];
  for (let i = 1; i < list.length; i += 1) {
    out.push(list.slice(0, i).join("/"));
  }
  return out;
}

function run(cwd: string, args: string[], input?: string) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    let out = "";
    const child = spawn("git", args, {
      cwd,
      stdio: ["pipe", "pipe", "ignore"],
      env: process.env,
    });

    child.stdout?.on("data", (chunk: Buffer | string) => {
      out += chunk.toString();
    });
    child.once("error", () => {
      resolve({ code: null, out: "" });
    });
    child.once("close", (code) => {
      resolve({ code, out });
    });
    child.stdin?.end(input);
  });
}

async function inspectPath(cwd: string, path: string): Promise<ShellPickedFile | null> {
  const file = resolveFile(path, cwd);
  let info;
  try {
    info = await stat(file);
  } catch {
    return null;
  }
  if (!info.isFile()) return null;

  const buf =
    info.size > 0 ? await readFile(file).then((item) => item.subarray(0, 512)) : undefined;
  const img = image(file, buf);
  const kind = img ? "image" : "file";
  return {
    path: file,
    name: Path.basename(file) || file,
    kind,
    size: info.size,
    mimeType: img ?? mime(file, buf),
  };
}

export class ShellService {
  cwd: string;
  private path: string | null;
  private cache: { cwd: string; at: number; rows: Row[] } | null = null;
  private walk: Promise<Row[]> | null = null;

  constructor(path?: string) {
    this.path = path ?? null;
    this.cwd = saved(this.path) ?? defaultCwd();
  }

  private save() {
    if (!this.path) return;
    mkdirSync(Path.dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify({ cwd: this.cwd }), "utf8");
  }

  private clear() {
    this.cache = null;
    this.walk = null;
  }

  private async gitRows() {
    const list = await run(this.cwd, ["ls-files", "--cached", "--others", "--exclude-standard"]);
    if (list.code !== 0) return null;

    const raw = list.out
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && !ignored(item));
    if (raw.length === 0) return [];

    const check = await run(
      this.cwd,
      ["check-ignore", "--stdin", "--no-index"],
      `${raw.join("\n")}\n`,
    );
    const seen =
      check.code === 0 || check.code === 1
        ? new Set(
            check.out
              .split(/\r?\n/)
              .map((item) => item.trim())
              .filter(Boolean),
          )
        : new Set<string>();
    const files = raw.filter((item) => !seen.has(item));
    const dirs = [...new Set(files.flatMap((item) => parents(item)))]
      .toSorted((left, right) => left.localeCompare(right))
      .map((path) => ({ path, name: base(path), kind: "dir" as const })) satisfies Row[];
    const rows = files
      .toSorted((left, right) => left.localeCompare(right))
      .map((path) => ({
        path,
        name: base(path),
        kind: image(path) ? ("image" as const) : ("file" as const),
      })) satisfies Row[];
    return [...dirs, ...rows].slice(0, max);
  }

  private async scanDir(root: string, dir: string, rows: Row[]) {
    if (rows.length >= max) return;

    const list = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of list) {
      if (rows.length >= max) return;
      if (skip.has(entry.name)) continue;

      const file = Path.join(dir, entry.name);
      const rel = short(root, file).split(Path.sep).join("/");
      if (!rel || rel === file) continue;

      if (entry.isDirectory()) {
        rows.push({ path: rel, name: entry.name, kind: "dir" });
        await this.scanDir(root, file, rows);
        continue;
      }

      if (entry.isFile()) {
        rows.push({
          path: rel,
          name: entry.name,
          kind: image(file) ? "image" : "file",
        });
        continue;
      }

      if (!entry.isSymbolicLink()) continue;

      const next = await stat(file).catch(() => null);
      if (!next) continue;
      if (next.isDirectory()) {
        rows.push({ path: rel, name: entry.name, kind: "dir" });
        continue;
      }
      if (!next.isFile()) continue;
      rows.push({
        path: rel,
        name: entry.name,
        kind: image(file) ? "image" : "file",
      });
    }
  }

  private async rows() {
    const now = Date.now();
    if (this.cache?.cwd === this.cwd && now - this.cache.at < ttl) {
      return this.cache.rows;
    }
    if (this.walk) return this.walk;

    const job = (async () => {
      const git = await this.gitRows();
      const rows = git ?? [];
      if (!git) {
        await this.scanDir(this.cwd, this.cwd, rows);
      }
      this.cache = { cwd: this.cwd, at: Date.now(), rows };
      this.walk = null;
      return rows;
    })().catch((err) => {
      this.walk = null;
      throw err;
    });

    this.walk = job;
    return job;
  }

  availableEditors() {
    const list = EDITORS.filter((item) => runner(item));
    return list.map((item) => item.id);
  }

  getState() {
    return Effect.sync(() => ({
      cwd: this.cwd,
      name: Path.basename(this.cwd) || this.cwd,
      home: OS.homedir(),
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
        this.clear();
        this.save();
        return {
          cwd: this.cwd,
          name: Path.basename(this.cwd) || this.cwd,
          home: OS.homedir(),
          availableEditors: this.availableEditors(),
        };
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  setWorkspace(cwd: string) {
    return Effect.try({
      try: () => {
        const next = statSync(cwd);
        if (!next.isDirectory()) {
          throw new Error(`Workspace is not a directory: ${cwd}`);
        }
        this.cwd = cwd;
        this.clear();
        this.save();
        return {
          cwd: this.cwd,
          name: Path.basename(this.cwd) || this.cwd,
          home: OS.homedir(),
          availableEditors: this.availableEditors(),
        };
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  suggestFiles(query: string) {
    return Effect.tryPromise({
      try: async () => {
        const rows = await this.rows();
        return rows
          .map((row) => ({ row, score: score(row, query) }))
          .filter((item): item is { row: Row; score: number } => item.score !== null)
          .toSorted((left, right) => {
            if (left.score !== right.score) return left.score - right.score;
            return left.row.path.localeCompare(right.row.path);
          })
          .slice(0, 24)
          .map((item) => item.row);
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  previewFile(path: string) {
    return Effect.tryPromise({
      try: async () => {
        const file = resolveFile(path, this.cwd);
        const info = await stat(file).catch(() => null);
        if (!info?.isFile()) return null;

        const buf =
          info.size > 0 ? await readFile(file).then((item) => item.subarray(0, 512)) : undefined;
        const type = mime(file, buf);
        const img = image(file, buf);
        if (img) {
          const raw = nativeImage.createFromPath(file);
          if (raw.isEmpty()) return null;
          const size = raw.getSize();
          const next = size.width > 640 ? raw.resize({ width: 640 }) : raw;
          return {
            path: file,
            kind: "image",
            mimeType: type,
            data: next.toPNG().toString("base64"),
          } satisfies ShellFilePreview;
        }

        if (!text(file, buf, type)) return null;
        const out = await readText(file);
        return {
          path: file,
          kind: "text",
          mimeType: type,
          text: out.text,
          truncated: out.truncated,
        } satisfies ShellFilePreview;
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  pickFiles(owner?: Electron.BrowserWindow | null) {
    return Effect.tryPromise({
      try: async () => {
        const result = owner
          ? await dialog.showOpenDialog(owner, {
              properties: ["openFile", "multiSelections"],
            })
          : await dialog.showOpenDialog({
              properties: ["openFile", "multiSelections"],
            });
        if (result.canceled || result.filePaths.length === 0) return [];
        const rows = await Promise.all(result.filePaths.map((path) => inspectPath(this.cwd, path)));
        return rows.filter((item): item is ShellPickedFile => Boolean(item));
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  inspectFiles(paths: string[]) {
    return Effect.tryPromise({
      try: async () => {
        const rows = await Promise.all(paths.map((path) => inspectPath(this.cwd, path)));
        return rows.filter((item): item is ShellPickedFile => Boolean(item));
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
      if (!launch) {
        return yield* Effect.fail(new Error(`Editor command not found: ${editorId}`));
      }
      if (!commandAvailable(launch.command)) {
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

  getEditorIcons(): Effect.Effect<EditorIcon[], Error> {
    return Effect.sync(() => {
      const available = EDITORS.filter((item) => runner(item));
      return available.map(
        (editor): EditorIcon => ({
          id: editor.id,
          icon: editorSvgPaths[editor.id] ?? null,
        }),
      );
    });
  }
}

// SVG icon paths for editors - using official brand assets
const editorSvgPaths: Record<string, string> = {
  cursor: "/icons/cursor/cursor.svg",
  vscode: "/icons/vscode/vscode.svg",
  "vscode-insiders": "/icons/vscode/vscode.svg",
  vscodium: "/icons/vscode/vscode.svg",
  zed: "/icons/zed/zed.svg",
};
