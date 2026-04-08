type EvlogKind = "command" | "command-ack" | "domain" | "replay" | "snapshot";

export interface EvlogEntry {
  id: number;
  at: string;
  kind: EvlogKind;
  label: string;
  data: unknown;
}

export interface EvlogApi {
  on: () => boolean;
  off: () => boolean;
  clear: () => void;
  list: () => EvlogEntry[];
  tail: (count?: number) => EvlogEntry[];
  print: (count?: number) => EvlogEntry[];
  counts: () => Record<EvlogKind, number>;
  help: () => string;
}

const key = "glass.evlog.enabled";
const limit = 400;

function clone<T>(data: T): T {
  try {
    return structuredClone(data);
  } catch {
    return data;
  }
}

function line(entry: EvlogEntry) {
  return `#${entry.id} ${entry.kind} ${entry.label}`;
}

function dump(entry: EvlogEntry) {
  console.groupCollapsed(`[evlog] ${line(entry)}`);
  console.log(entry.data);
  console.groupEnd();
}

export function createEvlogStore(size = limit) {
  let on = false;
  let seq = 0;
  const list: EvlogEntry[] = [];

  const push = (kind: EvlogKind, label: string, data: unknown) => {
    const entry: EvlogEntry = {
      id: ++seq,
      at: new Date().toISOString(),
      kind,
      label,
      data: clone(data),
    };
    list.push(entry);
    if (list.length > size) {
      list.splice(0, list.length - size);
    }
    if (on) {
      dump(entry);
    }
    return entry;
  };

  return {
    enable() {
      on = true;
      return on;
    },
    disable() {
      on = false;
      return on;
    },
    enabled() {
      return on;
    },
    clear() {
      list.length = 0;
    },
    list() {
      return [...list];
    },
    tail(count = 20) {
      return list.slice(-Math.max(0, count));
    },
    counts() {
      return list.reduce<Record<EvlogKind, number>>(
        (acc, entry) => {
          acc[entry.kind] += 1;
          return acc;
        },
        { command: 0, "command-ack": 0, domain: 0, replay: 0, snapshot: 0 },
      );
    },
    push,
  };
}

const store = createEvlogStore();

function enabled() {
  return import.meta.env.DEV && typeof window !== "undefined";
}

function persist(next: boolean) {
  if (!enabled()) {
    return next;
  }
  try {
    window.localStorage.setItem(key, next ? "1" : "0");
  } catch {}
  return next;
}

function restore() {
  if (!enabled()) {
    return false;
  }
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function api(): EvlogApi {
  return {
    on: () => persist(store.enable()),
    off: () => persist(store.disable()),
    clear: () => store.clear(),
    list: () => store.list(),
    tail: (count = 20) => store.tail(count),
    print: (count = 20) => {
      const rows = store.tail(count);
      console.table(
        rows.map((entry) => ({
          id: entry.id,
          at: entry.at,
          kind: entry.kind,
          label: entry.label,
        })),
      );
      return rows;
    },
    counts: () => store.counts(),
    help: () => {
      const text =
        "window.evlog: on(), off(), clear(), list(), tail(count), print(count), counts()";
      console.info(`[evlog] ${text}`);
      return text;
    },
  };
}

function labelFor(kind: EvlogKind, data: unknown, fallback: string) {
  if (!data || typeof data !== "object") {
    return fallback;
  }
  const row = data as Record<string, unknown>;
  const type = typeof row.type === "string" ? row.type : null;
  if (kind === "domain" && type === "thread.activity.append") {
    const activity = row.payload;
    if (activity && typeof activity === "object") {
      const item = activity as Record<string, unknown>;
      const next = typeof item.kind === "string" ? item.kind : null;
      if (next) {
        return `${type}:${next}`;
      }
    }
  }
  return type ?? fallback;
}

export function installEvlog() {
  if (!enabled() || window.evlog) {
    return;
  }
  if (restore()) {
    store.enable();
  }
  window.evlog = api();
  console.info("[evlog] ready. Call window.evlog.help().");
}

function note(kind: EvlogKind, data: unknown, fallback: string) {
  if (!enabled()) {
    return;
  }
  store.push(kind, labelFor(kind, data, fallback), data);
}

export function noteEvlogCommand(data: unknown) {
  note("command", data, "command");
}

export function noteEvlogCommandAck(data: unknown) {
  note("command-ack", data, "command-ack");
}

export function noteEvlogDomain(data: unknown) {
  note("domain", data, "domain");
}

export function noteEvlogReplay(data: unknown) {
  note("replay", data, "replay");
}

export function noteEvlogSnapshot(data: unknown) {
  note("snapshot", data, "snapshot");
}
