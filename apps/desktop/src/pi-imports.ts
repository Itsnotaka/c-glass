import { existsSync } from "node:fs";
import * as Path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type * as Pi from "@mariozechner/pi-coding-agent";

const dir = Path.dirname(fileURLToPath(import.meta.url));
const dirs = [Path.resolve(dir, "../node_modules"), Path.resolve(dir, "../../../node_modules")];

const root = (() => {
  const dir = dirs.find((item) =>
    existsSync(Path.join(item, "@mariozechner", "pi-coding-agent", "dist", "index.js")),
  );
  if (!dir) {
    throw new Error("Could not resolve Pi runtime package from desktop bundle");
  }
  return dir;
})();

let pip: Promise<typeof Pi> | null = null;

export function loadPi() {
  pip ??= import(
    pathToFileURL(Path.join(root, "@mariozechner", "pi-coding-agent", "dist", "index.js")).href
  ) as Promise<typeof Pi>;
  return pip;
}
