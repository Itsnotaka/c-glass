import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";
import { spawnSync } from "node:child_process";

import * as Effect from "effect/Effect";
import { afterEach, describe, expect, it } from "vitest";

import { GitService, rows } from "./git-service";

function run(cwd: string, args: string[]) {
  const out = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (out.status === 0) return out.stdout;
  throw new Error(out.stderr.trim() || out.stdout.trim() || `git ${args.join(" ")} failed`);
}

describe("GitService", () => {
  let dir = "";

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("lists deleted tracked files and untracked files inside dirs", async () => {
    dir = mkdtempSync(Path.join(OS.tmpdir(), "glass-git-"));
    run(dir, ["init"]);
    run(dir, ["config", "user.name", "Glass"]);
    run(dir, ["config", "user.email", "glass@example.com"]);
    writeFileSync(Path.join(dir, "gone.ts"), "export const gone = 1;\n");
    writeFileSync(Path.join(dir, "keep.ts"), "export const keep = 1;\n");
    run(dir, ["add", "."]);
    run(dir, ["commit", "-m", "init"]);

    rmSync(Path.join(dir, "gone.ts"));
    mkdirSync(Path.join(dir, "nest"), { recursive: true });
    writeFileSync(Path.join(dir, "nest", "ask.ts"), "export const ask = 1;\n");

    const svc = new GitService();
    const state = await Effect.runPromise(svc.get(dir));

    expect(state.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "gone.ts", state: "deleted" }),
        expect.objectContaining({ path: "nest/ask.ts", state: "untracked" }),
      ]),
    );
    expect(state.files.some((file) => file.path === "nest/")).toBe(false);
  });

  it("parses tracked, renamed, conflicted, and untracked paths from porcelain v2", () => {
    const raw = [
      "1 .D N... 100644 100644 000000 aaa bbb src/gone.ts",
      "2 R. N... 100644 100644 100644 aaa bbb R100 src/new.ts",
      "src/old.ts",
      "u UU N... 100644 100644 100644 100644 aaa bbb ccc src/conflict.ts",
      "? src/fresh.ts",
      "",
    ].join("\0");

    expect(
      rows(raw).map((file) => ({
        path: file.path,
        prevPath: file.prevPath,
        state: file.state,
      })),
    ).toEqual([
      { path: "src/gone.ts", prevPath: null, state: "deleted" },
      { path: "src/new.ts", prevPath: "src/old.ts", state: "renamed" },
      { path: "src/conflict.ts", prevPath: null, state: "conflicted" },
      { path: "src/fresh.ts", prevPath: null, state: "untracked" },
    ]);
  });
});
