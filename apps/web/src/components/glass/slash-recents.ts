import type { GlassSlashItemKind } from "./slash-types";

const keys = {
  commands: "glass.slash.recent.commands",
  skills: "glass.slash.recent.skills",
  subagents: "glass.slash.recent.subagents",
  global: "glass.slash.recent.global",
} as const;

const cap = { per: 5, global: 15 } as const;

function read(key: string): string[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
}

function write(key: string, ids: string[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(ids));
}

function push(key: string, id: string, max: number) {
  const cur = read(key).filter((x) => x !== id);
  cur.unshift(id);
  write(key, cur.slice(0, max));
}

function kindKey(kind: GlassSlashItemKind) {
  if (kind === "skill") return keys.skills;
  if (kind === "subagent") return keys.subagents;
  return keys.commands;
}

export function recordSlashUse(id: string, kind: GlassSlashItemKind) {
  push(keys.global, id, cap.global);
  if (kind === "app") return;
  push(kindKey(kind), id, cap.per);
}

export type SlashRecentsSnapshot = {
  global: string[];
  commands: string[];
  skills: string[];
  subagents: string[];
};

export function readSlashRecents(): SlashRecentsSnapshot {
  return {
    global: read(keys.global),
    commands: read(keys.commands),
    skills: read(keys.skills),
    subagents: read(keys.subagents),
  };
}

/** Higher rank = more recent (0 = not in list). */
export function recentBoost(
  id: string,
  kind: GlassSlashItemKind,
  snap: SlashRecentsSnapshot,
): number {
  const g = snap.global.indexOf(id);
  const k =
    kind === "app"
      ? -1
      : kind === "skill"
        ? snap.skills.indexOf(id)
        : kind === "subagent"
          ? snap.subagents.indexOf(id)
          : snap.commands.indexOf(id);
  let boost = 0;
  if (g >= 0) boost += (cap.global - g) * 0.4;
  if (k >= 0) boost += (cap.per - k) * 0.6;
  return boost;
}
