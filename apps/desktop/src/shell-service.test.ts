import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";
import { spawnSync } from "node:child_process";

import * as Effect from "effect/Effect";
import { afterEach, describe, expect, it } from "vitest";

import { ShellService } from "./shell-service";

function git(cwd: string, args: string[]) {
  const out = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (out.status === 0) return out.stdout;
  throw new Error(out.stderr.trim() || out.stdout.trim() || `git ${args.join(" ")} failed`);
}

describe("ShellService", () => {
  let dir = "";

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("filters node_modules while walking non-git workspaces", async () => {
    dir = mkdtempSync(Path.join(OS.tmpdir(), "glass-shell-"));
    mkdirSync(Path.join(dir, "src"), { recursive: true });
    mkdirSync(Path.join(dir, "node_modules", "pkg"), { recursive: true });
    writeFileSync(Path.join(dir, "src", "keep.ts"), "export const keep = 1;\n");
    writeFileSync(Path.join(dir, "node_modules", "pkg", "index.js"), "module.exports = {};\n");

    const svc = new ShellService();
    svc.cwd = dir;

    const rows = await Effect.runPromise(svc.suggestFiles(""));
    const paths = rows.map((row) => row.path);

    expect(paths).toContain("src");
    expect(paths).toContain("src/keep.ts");
    expect(paths.some((path) => path.startsWith("node_modules"))).toBe(false);
  });

  it("filters ignored and tracked-ignored paths in git workspaces", async () => {
    dir = mkdtempSync(Path.join(OS.tmpdir(), "glass-shell-git-"));
    git(dir, ["init"]);
    git(dir, ["config", "user.name", "Glass"]);
    git(dir, ["config", "user.email", "glass@example.com"]);

    mkdirSync(Path.join(dir, ".convex", "local"), { recursive: true });
    mkdirSync(Path.join(dir, "node_modules", "pkg"), { recursive: true });
    mkdirSync(Path.join(dir, "src"), { recursive: true });
    writeFileSync(Path.join(dir, ".convex", "local", "data.json"), "{}\n");
    writeFileSync(Path.join(dir, "src", "keep.ts"), "export const keep = 1;\n");
    writeFileSync(Path.join(dir, "node_modules", "pkg", "index.js"), "module.exports = {};\n");
    git(dir, ["add", ".convex/local/data.json", "src/keep.ts"]);
    git(dir, ["commit", "-m", "init"]);
    writeFileSync(Path.join(dir, ".gitignore"), ".convex/\n");

    const svc = new ShellService();
    svc.cwd = dir;

    const rows = await Effect.runPromise(svc.suggestFiles(""));
    const paths = rows.map((row) => row.path);

    expect(paths).toContain("src");
    expect(paths).toContain("src/keep.ts");
    expect(paths).toContain(".gitignore");
    expect(paths.some((path) => path.startsWith(".convex"))).toBe(false);
    expect(paths.some((path) => path.startsWith("node_modules"))).toBe(false);
  });
});
