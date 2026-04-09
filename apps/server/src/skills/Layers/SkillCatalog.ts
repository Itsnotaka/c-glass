import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Effect, Layer } from "effect";

import type { GlassSkill } from "@glass/contracts";

import {
  SkillCatalog,
  SkillCatalogError,
  type SkillCatalogShape,
} from "../Services/SkillCatalog.ts";

const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/;

function unquote(input: string) {
  if (input.length < 2) return input;
  const head = input[0];
  const tail = input[input.length - 1];
  if ((head === '"' || head === "'") && tail === head) {
    return input.slice(1, -1);
  }
  return input;
}

function meta(input: string, key: string) {
  for (const row of input.split(/\r?\n/)) {
    const text = row.trim();
    if (!text.startsWith(`${key}:`)) continue;
    const raw = text.slice(key.length + 1).trim();
    if (!raw || raw === ">" || raw === "|") return undefined;
    const value = unquote(raw).trim();
    return value || undefined;
  }
  return undefined;
}

export function parseSkillDoc(input: string) {
  const hit = input.match(front);
  const body = (hit ? input.slice(hit[0].length) : input)
    .replace(/^(?:[ \t]*\r?\n)+/, "")
    .replace(/(?:\r?\n[ \t]*)+$/, "");
  return {
    body,
    description: hit?.[1] ? meta(hit[1], "description") : undefined,
  };
}

async function readSkill(dir: string, name: string): Promise<GlassSkill | null> {
  const stat = await fs.stat(dir).catch(() => null);
  if (!stat?.isDirectory()) return null;

  const file = path.join(dir, "SKILL.md");
  const text = await fs.readFile(file, "utf8").catch(() => null);
  if (text === null) return null;

  const id = await fs.realpath(dir).catch(() => null);
  if (!id) return null;

  const doc = parseSkillDoc(text);
  return {
    id,
    name,
    body: doc.body,
    ...(doc.description ? { description: doc.description } : {}),
  };
}

export async function scanSkills(root: string): Promise<GlassSkill[]> {
  const list = await fs.readdir(root, { withFileTypes: true }).catch((err: unknown) => {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  });
  if (!list) return [];

  const out = await Promise.all(
    list.map(async (ent) => {
      if (!(ent.isDirectory() || ent.isSymbolicLink())) return null;
      return readSkill(path.join(root, ent.name), ent.name);
    }),
  );

  return out
    .filter((skill): skill is GlassSkill => Boolean(skill))
    .toSorted((left, right) => left.name.localeCompare(right.name));
}

const detail = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const root = path.join(os.homedir(), ".agents", "skills");

const list: SkillCatalogShape["list"] = Effect.fn("SkillCatalog.list")(function* () {
  return yield* Effect.tryPromise({
    try: () => scanSkills(root),
    catch: (cause) =>
      new SkillCatalogError({
        operation: "skillCatalog.list",
        detail: detail(cause),
        cause,
      }),
  });
});

export const SkillCatalogLive = Layer.succeed(SkillCatalog, { list } satisfies SkillCatalogShape);
