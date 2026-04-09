import type { GlassSlashCommand } from "@glass/contracts";
import { rank } from "./composer-search";
import { recentBoost, type SlashRecentsSnapshot } from "./slash-recents";
import type { GlassSlashItemKind } from "./slash-types";

export type { GlassSlashItemKind } from "./slash-types";

export type GlassSlashItem = {
  id: string;
  kind: GlassSlashItemKind;
  name: string;
  description?: string;
  source: "runtime" | "app" | "local";
  /** Trailing pill (`commands` for runtime prompts, `skill`, or `app`). */
  pill: string;
  section: "recent" | "commands" | "skills" | "subagents" | "app";
  keyword?: string[];
  run: {
    type:
      | "insert"
      | "navigate"
      | "open-settings"
      | "new-chat"
      | "open-model-picker"
      | "plan-mode"
      | "fast-mode";
    value?: string;
  };
};

type Cmd = Omit<GlassSlashCommand, "source"> & {
  id?: string;
  source: GlassSlashCommand["source"] | "app";
};

function kindFrom(cmd: Cmd): GlassSlashItemKind {
  if (cmd.source === "app") return "app";
  if (cmd.source === "skill") return "skill";
  return "command";
}

function idFor(cmd: Cmd) {
  if (cmd.id) return cmd.id;
  if (cmd.source === "app") return `app:${cmd.name}`;
  return `runtime:${cmd.source}:${cmd.name}`;
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
  if (cmd.source === "app" && cmd.name === "model") return { type: "open-model-picker" };
  if (cmd.source === "app" && cmd.name === "plan") return { type: "plan-mode" };
  if (cmd.source === "app" && cmd.name === "fast") return { type: "fast-mode" };
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
  const base = raw ? rank<GlassSlashItem>(items, query, (item) => item.name) : items;
  const score = (item: GlassSlashItem) => {
    const b = recentBoost(item.id, item.kind, snap);
    const len = item.name.length;
    return b * 4 + (100 - Math.min(len, 64));
  };
  return base.toSorted((left: GlassSlashItem, right: GlassSlashItem) => score(right) - score(left));
}

export function mergeSlashItems(locals: Cmd[], remote: Cmd[]): GlassSlashItem[] {
  const all = [...locals, ...remote];
  return all.map((cmd) => {
    const kind = kindFrom(cmd);
    const base: GlassSlashItem = {
      id: idFor(cmd),
      kind,
      name: cmd.name,
      source: cmd.source === "app" ? "app" : "runtime",
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
  const byKind = (k: GlassSlashItemKind) => ranked.filter((x) => x.kind === k);

  const rows: SlashMenuRow[] = [];
  let optionIndex = 0;

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
