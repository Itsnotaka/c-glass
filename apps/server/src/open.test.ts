import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { resolveAvailableEditors, resolveEditorLaunch } from "./open";

const dirs: string[] = [];

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "glass-open-"));
  dirs.push(dir);
  return dir;
}

function app(home: string, name: string): string {
  const dir = join(home, "Applications", name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function bin(home: string, name: string): string {
  const file = join(home, "bin", name);
  mkdirSync(join(home, "bin"), { recursive: true });
  writeFileSync(file, "#!/bin/sh\n");
  chmodSync(file, 0o755);
  return file;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveAvailableEditors", () => {
  it("detects darwin editors from installed app bundles", () => {
    const home = temp();
    app(home, "Visual Studio Code.app");
    app(home, "Zed.app");

    const got = resolveAvailableEditors("darwin", { HOME: home, PATH: "" }, [
      join(home, "Applications"),
    ]);

    expect(got).toContain("vscode");
    expect(got).toContain("zed");
  });
});

describe("resolveEditorLaunch", () => {
  it("uses open for darwin app bundles when cli shims are missing", () => {
    const home = temp();
    const dir = app(home, "Visual Studio Code.app");

    const got = Effect.runSync(
      resolveEditorLaunch(
        { cwd: "/tmp/repo/src/main.ts:12:3", editor: "vscode" },
        "darwin",
        { HOME: home, PATH: "" },
        [join(home, "Applications")],
      ),
    );

    expect(got).toEqual({
      command: "/usr/bin/open",
      args: ["-a", dir, "--args", "--goto", "/tmp/repo/src/main.ts:12:3"],
    });
  });

  it("prefers cli shims over darwin app bundles", () => {
    const home = temp();
    app(home, "Visual Studio Code.app");
    bin(home, "code");

    const got = Effect.runSync(
      resolveEditorLaunch(
        { cwd: "/tmp/repo", editor: "vscode" },
        "darwin",
        { HOME: home, PATH: join(home, "bin") },
        [join(home, "Applications")],
      ),
    );

    expect(got).toEqual({
      command: "code",
      args: ["/tmp/repo"],
    });
  });
});
