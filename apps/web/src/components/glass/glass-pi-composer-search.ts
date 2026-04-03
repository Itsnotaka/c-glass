import type { ShellFileHit } from "@glass/contracts";

const marks = new Set([" ", "\t", '"', "'", "="]);

export type FileMatch = {
  token: string;
  query: string;
  start: number;
  end: number;
  quoted: boolean;
};

export type SlashMatch = {
  query: string;
  start: number;
  end: number;
};

function last(text: string) {
  for (let i = text.length - 1; i >= 0; i -= 1) {
    if (marks.has(text[i] ?? "")) return i;
  }
  return -1;
}

function quote(text: string) {
  let on = false;
  let at = -1;

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '"') continue;
    on = !on;
    if (on) at = i;
  }

  return on ? at : null;
}

function quoted(text: string) {
  const at = quote(text);
  if (at === null) return null;
  if (at > 0 && text[at - 1] === "@") {
    if (!(at - 1 === 0 || marks.has(text[at - 2] ?? ""))) return null;
    return text.slice(at - 1);
  }
  if (!(at === 0 || marks.has(text[at - 1] ?? ""))) return null;
  return text.slice(at);
}

function line(value: string, cursor: number) {
  const start = value.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const next = value.indexOf("\n", cursor);
  const end = next < 0 ? value.length : next;
  return {
    start,
    end,
    before: value.slice(start, cursor),
    after: value.slice(cursor, end),
  };
}

function parse(prefix: string) {
  if (prefix.startsWith('@"')) {
    return { raw: prefix.slice(2), at: true, quoted: true };
  }
  if (prefix.startsWith('"')) {
    return { raw: prefix.slice(1), at: false, quoted: true };
  }
  if (prefix.startsWith("@")) {
    return { raw: prefix.slice(1), at: true, quoted: false };
  }
  return { raw: prefix, at: false, quoted: false };
}

export function fileMatch(value: string, cursor: number): FileMatch | null {
  const row = line(value, cursor);
  const hit = quoted(row.before);
  if (hit?.startsWith('@"')) {
    return {
      token: hit,
      query: parse(hit).raw,
      start: row.start + row.before.length - hit.length,
      end: cursor,
      quoted: true,
    };
  }

  const cut = last(row.before);
  const start = cut < 0 ? 0 : cut + 1;
  if (row.before[start] !== "@") return null;
  const token = row.before.slice(start);
  return {
    token,
    query: token.slice(1),
    start: row.start + start,
    end: cursor,
    quoted: false,
  };
}

export function slashMatch(value: string, cursor: number): SlashMatch | null {
  const row = line(value, cursor);
  if (!row.before.startsWith("/")) return null;
  const cut = row.before.indexOf(" ");
  if (cut >= 0) return null;
  return {
    query: row.before.slice(1),
    start: row.start,
    end: cursor,
  };
}

export function rank<T>(items: T[], query: string, pick: (item: T) => string) {
  const raw = query.trim().toLowerCase();
  if (!raw) return items;

  const seq = (text: string) => {
    let pos = 0;
    for (const char of raw) {
      pos = text.indexOf(char, pos);
      if (pos < 0) return false;
      pos += 1;
    }
    return true;
  };

  const score = (item: T) => {
    const text = pick(item).toLowerCase();
    if (text === raw) return 100;
    if (text.startsWith(raw)) return 80 - text.length / 64;
    if (text.includes(raw)) return 60 - text.indexOf(raw) / 8;
    if (seq(text)) return 30 - text.length / 96;
    return -1;
  };

  return items
    .map((item) => ({ item, score: score(item) }))
    .filter((item) => item.score >= 0)
    .toSorted((left, right) => right.score - left.score)
    .map((item) => item.item);
}

export function applySlash(value: string, hit: SlashMatch, name: string) {
  const next = `${value.slice(0, hit.start)}/${name} ${value.slice(hit.end)}`;
  return {
    value: next,
    cursor: hit.start + name.length + 2,
  };
}

export function buildFileValue(path: string, opts: { dir: boolean; quoted: boolean }) {
  const need = opts.quoted || path.includes(" ");
  if (!need) return `@${path}`;
  return `@"${path}"`;
}

export function applyFile(value: string, hit: FileMatch, item: ShellFileHit) {
  const next = buildFileValue(item.path, { dir: item.kind === "dir", quoted: hit.quoted });
  const tail = value.slice(hit.end);
  const keep = hit.quoted && next.endsWith('"') && tail.startsWith('"') ? tail.slice(1) : tail;
  const gap = item.kind === "dir" ? "" : " ";
  const text = `${value.slice(0, hit.start)}${next}${gap}${keep}`;
  const close = item.kind === "dir" && next.endsWith('"') ? next.length - 1 : next.length;
  return {
    value: text,
    cursor: hit.start + close + gap.length,
    reopen: item.kind === "dir",
  };
}
