import type { GlassSessionSummary } from "@glass/contracts";

export class PiSessionDirectory {
  private sums = new Map<string, GlassSessionSummary>();

  all() {
    const items = [...this.sums.values()];
    if (items.length < 2) return items;
    return items.toSorted((left, right) =>
      left.modifiedAt < right.modifiedAt ? 1 : left.modifiedAt > right.modifiedAt ? -1 : 0,
    );
  }

  get(sessionId: string) {
    if (!sessionId) return null;
    const item = this.sums.get(sessionId);
    if (!item) return null;
    return item;
  }

  ids() {
    const out = new Set<string>();
    for (const id of this.sums.keys()) out.add(id);
    return out;
  }

  upsert(summary: GlassSessionSummary) {
    this.sums.set(summary.id, summary);
    return summary;
  }

  remove(sessionId: string) {
    this.sums.delete(sessionId);
  }

  replace(items: GlassSessionSummary[]) {
    this.sums = new Map(items.map((item) => [item.id, item]));
    return this.all();
  }

  clear() {
    this.sums.clear();
  }
}
