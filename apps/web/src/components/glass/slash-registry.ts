import type { PiSlashCommand } from "@glass/contracts";
import { rank } from "./pi-composer-search";
import { recentBoost, type SlashRecentsSnapshot } from "./slash-recents";
import type { GlassSlashItemKind } from "./slash-types";

const cap = { global: 15, recent: 15 } as const;

export type { GlassSlashItemKind } from "./slash-types";

export type GlassSlashItem = {
  id: string;
  kind: GlassSlashItemKind;
  name: string;
  description?: string;
  source: "pi" | "app" | "local";
  /** Trailing pill (`commands` for Pi prompts, `skill`, or `app`). */
  pill: string;
  section: "recent" | "commands" | "skills" | "subagents" | "app";
  keyword?: string[];
  run: {
    type: "insert" | "navigate" | "open-settings" | "new-chat";
    value?: string;
  };
};

type Cmd = Omit<PiSlashCommand, "source"> & {
  source: PiSlashCommand["source"] | "app";
};

function kindFrom(cmd: Cmd): GlassSlashItemKind {
  if (cmd.source === "app") return "app";
  if (cmd.source === "skill") return "skill";
  return "command";
}

function idFor(cmd: Cmd) {
  if (cmd.source === "app") return `app:${cmd.name}`;
  return `pi:${cmd.source}:${cmd.name}`;
}

function sectionFor(kind: GlassSlashItemKind): GlassSlashItem["section"] {
  if (kind === "app") return "app";
  if (kind === "skill") return "skills";
  if (kind === "subagent") return "subagents";
  return "commands";
}

function runFor(cmd: Cmd): GlassSlashItem["run"] {
  if (cmd.source === "app" && cmd.name === "new") return { type: "new-chat" };
  if (cmd.source === "app" && cmd.name === "settings") return { type: "open-settings" };
  return { type: "insert", value: cmd.name };
}

function pillFor(cmd: Cmd): string {
  if (cmd.source === "app") return "app";
  if (cmd.source === "prompt") return "commands";
  return cmd.source;
}

export function rankSlashItems(
  items: GlassSlashItem[],
  query: string,
  snap: SlashRecentsSnapshot,
): GlassSlashItem[] {
  const raw = query.trim().toLowerCase();
  const base = raw ? rank(items, query, (item) => item.name) : items;
  const score = (item: GlassSlashItem) => {
    const b = recentBoost(item.id, item.kind, snap);
    const len = item.name.length;
    return b * 4 + (100 - Math.min(len, 64));
  };
  return base.toSorted((left, right) => score(right) - score(left));
}

export function mergeSlashItems(locals: Cmd[], remote: Cmd[]): GlassSlashItem[] {
  const all = [...locals, ...remote.filter((cmd) => cmd.source !== "extension")];
  return all.map((cmd) => {
    const kind = kindFrom(cmd);
    const base: GlassSlashItem = {
      id: idFor(cmd),
      kind,
      name: cmd.name,
      source: cmd.source === "app" ? "app" : "pi",
      pill: pillFor(cmd),
      section: sectionFor(kind),
      run: runFor(cmd),
    };
    if (cmd.description !== undefined) base.description = cmd.description;
    return base;
  });
}

export type SlashMenuRow =
  | { kind: "header"; key: string; label: string }
  | { kind: "option"; item: GlassSlashItem; optionIndex: number };

export function buildSlashMenuRows(
  items: GlassSlashItem[],
  query: string,
  snap: SlashRecentsSnapshot,
): SlashMenuRow[] {
  const ranked = rankSlashItems(items, query, snap);
  const showRecent = query.trim().length <= 1;
  const recentIds = new Set(snap.global.slice(0, cap.global));
  const recentItems = showRecent
    ? ranked.filter((x) => recentIds.has(x.id)).slice(0, cap.recent)
    : [];
  const used = new Set(recentItems.map((x) => x.id));
  const rest = ranked.filter((x) => !used.has(x.id));

  const byKind = (k: GlassSlashItemKind) => rest.filter((x) => x.kind === k);

  const rows: SlashMenuRow[] = [];
  let optionIndex = 0;

  if (recentItems.length > 0) {
    rows.push({ kind: "header", key: "recent", label: "Recent" });
    for (const item of recentItems) {
      rows.push({ kind: "option", item, optionIndex: optionIndex++ });
    }
  }

  const pushKind = (k: GlassSlashItemKind, label: string, key: string) => {
    const list = byKind(k);
    if (list.length === 0) return;
    rows.push({ kind: "header", key, label });
    for (const item of list) {
      rows.push({ kind: "option", item, optionIndex: optionIndex++ });
    }
  };

  pushKind("command", "Commands", "commands");
  pushKind("skill", "Skills", "skills");
  pushKind("app", "App", "app");

  return rows;
}
