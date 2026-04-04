import { spawn } from "node:child_process";
import { devNull } from "node:os";

import type { GitFileSummary, GitState } from "@glass/contracts";
import * as Effect from "effect/Effect";

type Out = {
  out: string;
  err: string;
  code: number;
};

function run(cwd: string, args: string[]) {
  return new Promise<Out>((res, rej) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];

    child.stdout.on("data", (buf: Buffer) => {
      out.push(buf);
    });
    child.stderr.on("data", (buf: Buffer) => {
      err.push(buf);
    });
    child.on("error", (err) => {
      rej(err instanceof Error ? err : new Error(String(err)));
    });
    child.on("close", (code) => {
      res({
        out: Buffer.concat(out).toString("utf8"),
        err: Buffer.concat(err).toString("utf8"),
        code: code ?? 0,
      });
    });
  });
}

function fail(args: string[], out: Out) {
  const text = out.err.trim() || out.out.trim() || `git ${args.join(" ")} failed`;
  return new Error(text);
}

async function root(cwd: string) {
  const out = await run(cwd, ["rev-parse", "--show-toplevel"]);
  if (out.code !== 0) return null;
  const dir = out.out.trim();
  if (!dir) return null;
  return dir;
}

function staged(x: string) {
  if (x === "?") return false;
  return x !== ".";
}

function unstaged(y: string) {
  if (y === "?") return true;
  return y !== ".";
}

function kind(tag: string, x: string, y: string): GitFileSummary["state"] {
  if (tag === "?") return "untracked";
  if (tag === "u" || x === "U" || y === "U") return "conflicted";
  if (x === "R" || y === "R") return "renamed";
  if (x === "D" || y === "D") return "deleted";
  if (x === "A" || y === "A" || x === "C" || y === "C") return "added";
  if (x === "T" || y === "T") return "typechange";
  return "modified";
}

function file(tag: string, xy: string, path: string, prev: string | null) {
  const x = xy[0] ?? ".";
  const y = xy[1] ?? ".";
  return {
    id: prev ? `${prev}->${path}` : path,
    path,
    prevPath: prev,
    state: kind(tag, x, y),
    staged: staged(x),
    unstaged: unstaged(y),
  } satisfies GitFileSummary;
}

export function rows(raw: string) {
  const out: GitFileSummary[] = [];
  const vals = raw.split("\0").filter(Boolean);

  for (let i = 0; i < vals.length; i += 1) {
    const cur = vals[i] ?? "";
    const tag = cur[0] ?? "";

    if (tag === "?") {
      out.push(file(tag, "??", cur.slice(2), null));
      continue;
    }

    if (tag === "1") {
      const cols = cur.slice(2).split(" ");
      const xy = cols[0] ?? "..";
      const path = cols.slice(7).join(" ");
      if (path) out.push(file(tag, xy, path, null));
      continue;
    }

    if (tag === "2") {
      const cols = cur.slice(2).split(" ");
      const xy = cols[0] ?? "..";
      const path = cols.slice(8).join(" ");
      const prev = vals[i + 1] ?? "";
      i += 1;
      if (path && prev) out.push(file(tag, xy, path, prev));
      continue;
    }

    if (tag !== "u") continue;

    const cols = cur.slice(2).split(" ");
    const xy = cols[0] ?? "..";
    const path = cols.slice(9).join(" ");
    if (path) out.push(file(tag, xy, path, null));
  }

  return out;
}

async function list(cwd: string) {
  const args = ["status", "--porcelain=v2", "-z", "--untracked-files=all"];
  const out = await run(cwd, args);
  if (out.code !== 0) throw fail(args, out);
  return rows(out.out).toSorted((left, right) => left.path.localeCompare(right.path));
}

async function tracked(cwd: string) {
  const args = ["diff", "--no-ext-diff", "--binary", "--find-renames", "HEAD", "--"];
  const out = await run(cwd, args);
  if (out.code !== 0 && out.code !== 1) throw fail(args, out);
  return out.out;
}

async function untracked(cwd: string, path: string) {
  const args = ["diff", "--no-index", "--binary", "--", devNull, path];
  const out = await run(cwd, args);
  if (out.code !== 0 && out.code !== 1) throw fail(args, out);
  return out.out;
}

async function patch(cwd: string, files: GitFileSummary[]) {
  const out = [await tracked(cwd)];

  for (const item of files) {
    if (item.state !== "untracked") continue;
    out.push(await untracked(cwd, item.path));
  }

  return out.filter(Boolean).join("\n");
}

async function snap(cwd: string) {
  const gitRoot = await root(cwd);
  if (!gitRoot) {
    return {
      cwd,
      gitRoot: null,
      repo: false,
      clean: true,
      count: 0,
      files: [],
      patch: "",
    } satisfies GitState;
  }

  const files = await list(gitRoot);
  return {
    cwd,
    gitRoot,
    repo: true,
    clean: files.length === 0,
    count: files.length,
    files,
    patch: files.length === 0 ? "" : await patch(gitRoot, files),
  } satisfies GitState;
}

function same(left: GitState | undefined, right: GitState) {
  if (!left) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

export class GitService {
  private vals = new Map<string, GitState>();
  private fns = new Set<(state: GitState) => void>();

  listen(fn: (state: GitState) => void) {
    this.fns.add(fn);
    return () => {
      this.fns.delete(fn);
    };
  }

  private emit(state: GitState) {
    for (const fn of this.fns) fn(state);
  }

  get(cwd: string): Effect.Effect<GitState, Error> {
    return Effect.tryPromise({
      try: async () => {
        const cur = this.vals.get(cwd);
        if (cur) return cur;
        const next = await snap(cwd);
        this.vals.set(cwd, next);
        return next;
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  refresh(cwd: string): Effect.Effect<GitState, Error> {
    return Effect.tryPromise({
      try: async () => {
        const next = await snap(cwd);
        const cur = this.vals.get(cwd);
        this.vals.set(cwd, next);
        if (!same(cur, next)) this.emit(next);
        return next;
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  init(cwd: string): Effect.Effect<GitState, Error> {
    return Effect.tryPromise({
      try: async () => {
        const args = ["init"];
        const out = await run(cwd, args);
        if (out.code !== 0) throw fail(args, out);
        const next = await snap(cwd);
        const cur = this.vals.get(cwd);
        this.vals.set(cwd, next);
        if (!same(cur, next)) this.emit(next);
        return next;
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }
}
