import type { ProviderUserInputAnswers } from "@glass/contracts";

function list(value: unknown): string[] | null {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = (value as { answers?: unknown }).answers;
  if (!Array.isArray(raw)) {
    return null;
  }

  return raw.filter((entry): entry is string => typeof entry === "string");
}

function norm(list: string[], opts?: { trim?: boolean; dropEmpty?: boolean }): string[] {
  if (!opts?.trim && !opts?.dropEmpty) {
    return list;
  }

  const next = opts?.trim ? list.map((entry) => entry.trim()) : list;
  if (!opts?.dropEmpty) {
    return next;
  }

  return next.filter((entry) => entry.length > 0);
}

export function pickAnswers(
  value: unknown,
  opts?: { trim?: boolean; dropEmpty?: boolean },
): string[] | null {
  const raw = list(value);
  if (!raw) {
    return null;
  }

  return norm(raw, opts);
}

export function normalizeAnswers(
  answers: ProviderUserInputAnswers | undefined,
  opts?: {
    trim?: boolean;
    dropEmpty?: boolean;
    single?: boolean;
    multi?: ReadonlySet<string>;
  },
): ProviderUserInputAnswers {
  if (!answers) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(answers).flatMap(([id, value]) => {
      const list = pickAnswers(value, opts);
      if (!list) {
        return [];
      }

      if (opts?.multi) {
        if (list.length === 0) {
          return [];
        }
        return [[id, opts.multi.has(id) ? list : list[0]] as const];
      }

      if (opts?.single) {
        return [[id, list.length === 1 ? list[0] : list] as const];
      }

      if (opts?.dropEmpty && list.length === 0) {
        return [];
      }

      return [[id, list] as const];
    }),
  );
}
