import { accessSync, constants } from "node:fs";
import { readFile } from "node:fs/promises";
import * as OS from "node:os";
import * as Path from "node:path";

const spaces = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const nbsp = "\u202F";

const imgs = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".bmp", "image/bmp"],
  [".svg", "image/svg+xml"],
]);

const texts = new Map([
  [".txt", "text/plain"],
  [".md", "text/markdown"],
  [".mdx", "text/markdown"],
  [".json", "application/json"],
  [".jsonc", "application/json"],
  [".yaml", "application/yaml"],
  [".yml", "application/yaml"],
  [".toml", "application/toml"],
  [".xml", "application/xml"],
  [".html", "text/html"],
  [".htm", "text/html"],
  [".css", "text/css"],
  [".js", "text/javascript"],
  [".cjs", "text/javascript"],
  [".mjs", "text/javascript"],
  [".ts", "text/typescript"],
  [".tsx", "text/tsx"],
  [".jsx", "text/jsx"],
  [".sh", "text/x-shellscript"],
  [".bash", "text/x-shellscript"],
  [".zsh", "text/x-shellscript"],
  [".env", "text/plain"],
  [".ini", "text/plain"],
  [".conf", "text/plain"],
  [".log", "text/plain"],
  [".csv", "text/csv"],
  [".sql", "text/sql"],
  [".py", "text/x-python"],
  [".rb", "text/plain"],
  [".go", "text/plain"],
  [".rs", "text/plain"],
  [".java", "text/plain"],
  [".kt", "text/plain"],
  [".swift", "text/plain"],
  [".c", "text/plain"],
  [".cc", "text/plain"],
  [".cpp", "text/plain"],
  [".h", "text/plain"],
  [".hpp", "text/plain"],
  [".lock", "text/plain"],
]);

function ok(file: string) {
  try {
    accessSync(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function expand(file: string) {
  const next = (file.startsWith("@") ? file.slice(1) : file).replace(spaces, " ");
  if (next === "~") return OS.homedir();
  if (next.startsWith("~/")) return Path.join(OS.homedir(), next.slice(2));
  return next;
}

export function resolveFile(file: string, cwd: string) {
  const next = expand(file);
  const raw = Path.isAbsolute(next) ? next : Path.resolve(cwd, next);
  if (ok(raw)) return raw;

  const vars = [
    raw.replace(/ (AM|PM)\./g, `${nbsp}$1.`),
    raw.normalize("NFD"),
    raw.replace(/'/g, "\u2019"),
    raw.normalize("NFD").replace(/'/g, "\u2019"),
  ];
  return vars.find((item) => item !== raw && ok(item)) ?? raw;
}

export function image(file: string, buf?: Buffer) {
  if (buf) {
    if (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    ) {
      return "image/png";
    }
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return "image/jpeg";
    }
    if (buf.length >= 6 && buf.subarray(0, 6).toString("ascii") === "GIF87a") {
      return "image/gif";
    }
    if (buf.length >= 6 && buf.subarray(0, 6).toString("ascii") === "GIF89a") {
      return "image/gif";
    }
    if (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString("ascii") === "RIFF" &&
      buf.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return "image/webp";
    }
    if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) {
      return "image/bmp";
    }
  }

  return imgs.get(Path.extname(file).toLowerCase()) ?? null;
}

export function mime(file: string, buf?: Buffer) {
  const img = image(file, buf);
  if (img) return img;
  return texts.get(Path.extname(file).toLowerCase()) ?? null;
}

function looks(buf: Buffer) {
  if (buf.length === 0) return true;

  let bad = 0;
  for (const byte of buf) {
    if (byte === 0) return false;
    if (byte === 9 || byte === 10 || byte === 13) continue;
    if (byte >= 32 && byte < 127) continue;
    if (byte >= 128) continue;
    bad += 1;
  }

  return bad / buf.length < 0.05;
}

export function text(file: string, buf?: Buffer, type?: string | null) {
  const kind = type ?? mime(file, buf);
  if (kind?.startsWith("text/")) return true;
  if (kind && texts.has(Path.extname(file).toLowerCase())) return true;
  if (!buf) return false;
  return looks(buf);
}

export function short(cwd: string, file: string) {
  const rel = Path.relative(cwd, file);
  if (!rel || rel.startsWith("..")) return file;
  return rel;
}

export async function readText(file: string, max = 12_000) {
  const buf = await readFile(file);
  const cut = buf.length > max;
  const raw = cut ? buf.subarray(0, max) : buf;
  const out = raw.toString("utf8");
  return { text: out, truncated: cut };
}
