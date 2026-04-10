#!/usr/bin/env node
/**
 * Replaces Effect.fn("span")(function* …)() with
 * Effect.gen(function* …).pipe(Effect.withSpan("span"))
 * to satisfy @effect/language-service TS46 (no Effect.fn IIFE).
 *
 * Unsafe on files with nested `{`/`}` inside the generator that confuse brace
 * counting (large service factories). Prefer targeted edits or small files only.
 */
import * as FS from "node:fs";
import * as Path from "node:path";

const root = process.argv[2] ?? process.cwd();
const dirs = [Path.join(root, "apps/server/src"), Path.join(root, "apps/server/scripts")];

function convert(text) {
  const marker = 'Effect.fn("';
  let cursor = 0;
  let out = "";
  while (cursor < text.length) {
    const start = text.indexOf(marker, cursor);
    if (start === -1) {
      out += text.slice(cursor);
      break;
    }
    out += text.slice(cursor, start);
    const spanStart = start + marker.length;
    const spanEnd = text.indexOf('"', spanStart);
    if (spanEnd < 0) {
      out += text[start];
      cursor = start + 1;
      continue;
    }
    const span = text.slice(spanStart, spanEnd);
    const fnIdx = text.indexOf("(function*", spanEnd);
    if (fnIdx < 0) {
      cursor = start + 1;
      out += text.slice(start, start + 1);
      continue;
    }
    const braceStart = text.indexOf("{", fnIdx);
    if (braceStart < 0) {
      cursor = start + 1;
      out += text.slice(start, start + 1);
      continue;
    }
    let depth = 1;
    let i = braceStart + 1;
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (c === "{") {
        depth += 1;
      }
      if (c === "}") {
        depth -= 1;
      }
      i += 1;
    }
    if (depth !== 0) {
      cursor = start + 1;
      out += text.slice(start, start + 1);
      continue;
    }
    let j = i;
    while (j < text.length && /\s/.test(text[j])) {
      j += 1;
    }
    if (text[j] !== ")") {
      cursor = start + 1;
      out += text.slice(start, start + 1);
      continue;
    }
    j += 1;
    while (j < text.length && /\s/.test(text[j])) {
      j += 1;
    }
    if (text[j] !== "(") {
      cursor = start + 1;
      out += text.slice(start, start + 1);
      continue;
    }
    j += 1;
    if (text[j] !== ")") {
      cursor = start + 1;
      out += text.slice(start, start + 1);
      continue;
    }
    j += 1;
    const inner = text.slice(fnIdx, i);
    out += `Effect.gen${inner}).pipe(Effect.withSpan("${span}"))`;
    cursor = j;
  }
  return out;
}

function walk(dir, out) {
  if (!FS.existsSync(dir)) {
    return;
  }
  for (const ent of FS.readdirSync(dir, { withFileTypes: true })) {
    const p = Path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p, out);
    } else if (ent.isFile() && ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
}

const files = [];
for (const d of dirs) {
  walk(d, files);
}

let n = 0;
for (const file of files) {
  const text = FS.readFileSync(file, "utf8");
  if (!text.includes('Effect.fn("') || !text.includes("})()")) {
    continue;
  }
  const next = convert(text);
  if (next === text) {
    continue;
  }
  FS.writeFileSync(file, next);
  n += 1;
  console.log(Path.relative(root, file));
}
console.error(`rewrote ${n} files`);
