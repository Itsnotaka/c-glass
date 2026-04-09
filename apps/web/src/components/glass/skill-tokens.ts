import type { GlassSkill } from "@glass/contracts";

import type { GlassDraftSkill } from "../../lib/glass-chat-draft-store";
import type { SlashMatch } from "./composer-search";

function sort(skills: GlassDraftSkill[]) {
  return skills.toSorted((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    return left.end - right.end;
  });
}

function token(skill: Pick<GlassDraftSkill, "name">) {
  return `/${skill.name}`;
}

function valid(text: string, skill: GlassDraftSkill) {
  if (skill.start < 0 || skill.end <= skill.start || skill.end > text.length) return false;
  return text.slice(skill.start, skill.end) === token(skill);
}

function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detect(text: string, defs: GlassSkill[]) {
  if (defs.length === 0) return [];

  const names = defs.toSorted((left, right) => right.name.length - left.name.length);
  const byName = new Map(names.map((item) => [item.name, item]));
  const rx = new RegExp(
    `(^|[\\s])\\/(${names.map((item) => escape(item.name)).join("|")})(?=$|[\\s])`,
    "gm",
  );
  const found: GlassDraftSkill[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = rx.exec(text))) {
    const lead = match[1] ?? "";
    const name = match[2];
    if (!name) continue;
    const item = byName.get(name);
    if (!item) continue;
    const start = match.index + lead.length;
    found.push({
      id: item.id,
      name: item.name,
      start,
      end: start + item.name.length + 1,
    });
  }

  return found;
}

function edit(prev: string, next: string) {
  let start = 0;
  const limit = Math.min(prev.length, next.length);
  while (start < limit && prev[start] === next[start]) {
    start += 1;
  }

  let left = prev.length;
  let right = next.length;
  while (left > start && right > start && prev[left - 1] === next[right - 1]) {
    left -= 1;
    right -= 1;
  }

  return {
    start,
    prevEnd: left,
    nextEnd: right,
    delta: right - left,
  };
}

export function sameSkills(left: GlassDraftSkill[], right: GlassDraftSkill[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i];
    const b = right[i];
    if (!a || !b) return false;
    if (a.id !== b.id || a.name !== b.name || a.start !== b.start || a.end !== b.end) {
      return false;
    }
  }
  return true;
}

export function shiftSkills(prev: string, next: string, skills: GlassDraftSkill[]) {
  const change = edit(prev, next);
  return sort(
    skills.flatMap((skill) => {
      if (!valid(prev, skill)) return [];
      if (skill.end <= change.start) return [skill];
      if (skill.start >= change.prevEnd) {
        return [
          {
            ...skill,
            start: skill.start + change.delta,
            end: skill.end + change.delta,
          },
        ];
      }
      return [];
    }),
  );
}

export function applySkill(
  value: string,
  hit: SlashMatch,
  item: Pick<GlassSkill, "id" | "name">,
  skills: GlassDraftSkill[],
) {
  const next = `${value.slice(0, hit.start)}/${item.name} ${value.slice(hit.end)}`;
  return {
    value: next,
    cursor: hit.start + item.name.length + 2,
    skills: sort([
      ...shiftSkills(value, next, skills),
      {
        id: item.id,
        name: item.name,
        start: hit.start,
        end: hit.start + item.name.length + 1,
      },
    ]),
  };
}

export function hydrateSkills(text: string, skills: GlassDraftSkill[], defs: GlassSkill[]) {
  const set = new Set(defs.map((item) => `${item.id}:${item.name}`));
  const kept = skills.filter((skill) => valid(text, skill) && set.has(`${skill.id}:${skill.name}`));
  const seen = new Set(
    kept.map((skill) => `${skill.id}:${skill.name}:${skill.start}:${skill.end}`),
  );
  return sort([
    ...kept,
    ...detect(text, defs).filter((skill) => {
      const key = `${skill.id}:${skill.name}:${skill.start}:${skill.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ]);
}

export function expandSkills(text: string, skills: GlassDraftSkill[], defs: GlassSkill[]) {
  const map = new Map(defs.map((item) => [item.id, item]));
  let out = "";
  let at = 0;

  for (const skill of sort(skills)) {
    if (!valid(text, skill)) continue;
    if (skill.start < at) continue;
    out += text.slice(at, skill.start);
    const item = map.get(skill.id);
    out += item && item.name === skill.name ? item.body : text.slice(skill.start, skill.end);
    at = skill.end;
  }

  return `${out}${text.slice(at)}`;
}
