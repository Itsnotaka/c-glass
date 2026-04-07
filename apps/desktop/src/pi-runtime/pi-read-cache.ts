import type { GlassSessionSnapshot, GlassSessionSummary } from "@glass/contracts";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { level, msgId, toMessage } from "./pi-runtime-store";

function pending() {
  return { steering: [], followUp: [] };
}

function model(value: { provider: string; modelId: string } | null) {
  if (!value) return null;
  return {
    provider: value.provider,
    id: value.modelId,
  };
}

function empty(sum: GlassSessionSummary) {
  return {
    id: sum.id,
    file: sum.path || null,
    cwd: sum.cwd,
    name: sum.name,
    model: null,
    thinkingLevel: "off",
    messages: [],
    live: null,
    tree: [],
    isStreaming: sum.isStreaming,
    pending: pending(),
  } satisfies GlassSessionSnapshot;
}

function build(sum: GlassSessionSummary) {
  if (!sum.path) return empty(sum);

  try {
    const mgr = SessionManager.open(sum.path);
    const ctx = mgr.buildSessionContext();
    return {
      id: sum.id,
      file: sum.path,
      cwd: sum.cwd || mgr.getCwd(),
      name: mgr.getSessionName() ?? sum.name ?? null,
      model: model(ctx.model),
      thinkingLevel: level(ctx.thinkingLevel),
      messages: ctx.messages.map((item, i) => ({
        id: msgId(item, `${sum.id}:${i + 1}`),
        message: toMessage(item),
      })),
      live: null,
      tree: [],
      isStreaming: sum.isStreaming,
      pending: pending(),
    } satisfies GlassSessionSnapshot;
  } catch {
    return empty(sum);
  }
}

export class PiReadCache {
  private rows = new Map<
    string,
    {
      file: string | null;
      modifiedAt: string;
      snap: GlassSessionSnapshot;
    }
  >();

  read(sum: GlassSessionSummary) {
    const row = this.rows.get(sum.id);
    if (row && row.file === (sum.path || null) && row.modifiedAt >= sum.modifiedAt) {
      return row.snap;
    }

    const snap = build(sum);
    this.rows.set(sum.id, {
      file: snap.file,
      modifiedAt: sum.modifiedAt,
      snap,
    });
    return snap;
  }

  write(snap: GlassSessionSnapshot, modifiedAt = new Date().toISOString()) {
    this.rows.set(snap.id, {
      file: snap.file,
      modifiedAt,
      snap,
    });
    return snap;
  }

  boot() {
    const out: Record<string, GlassSessionSnapshot> = {};
    for (const [id, item] of this.rows.entries()) {
      out[id] = item.snap;
    }
    return out;
  }

  remove(sessionId: string) {
    this.rows.delete(sessionId);
  }

  clear() {
    this.rows.clear();
  }

  prune(ids: Set<string>) {
    for (const id of this.rows.keys()) {
      if (!ids.has(id)) this.rows.delete(id);
    }
  }
}
