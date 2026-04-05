#!/usr/bin/env node
/**
 * Prints CSS rule fragments from Cursor's workbench bundle that mention `.rendered-markdown`,
 * for diffing when Cursor updates (see research-scratchpad.md).
 *
 * Usage:
 *   node scripts/extract-cursor-markdown-css.mjs
 *   CURSOR_WORKBENCH_CSS=/path/to/workbench.desktop.main.css node scripts/extract-cursor-markdown-css.mjs
 */

import fs from "node:fs";

const def =
  process.env.CURSOR_WORKBENCH_CSS ??
  "/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.css";

let raw;
try {
  raw = fs.readFileSync(def, "utf8");
} catch {
  console.error(`Cannot read ${def}. Set CURSOR_WORKBENCH_CSS to a valid path.`);
  process.exit(1);
}

const re = /\.[^{]*rendered-markdown[^{]*\{[^}]*\}/g;
const out = [];
let m;
while ((m = re.exec(raw))) {
  out.push(m[0]);
}
console.log(out.join("\n"));
