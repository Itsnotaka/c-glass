export type PaperMcpSnapshot = { ok: boolean; detail?: string } | null;

let snap: PaperMcpSnapshot = null;
let onChange: (() => void) | null = null;

export function registerPaperMcpBootRefresh(fn: () => void) {
  onChange = fn;
}

export function setPaperMcpStatus(ok: boolean, detail?: string) {
  snap = { ok, ...(detail !== undefined && detail !== "" ? { detail } : {}) };
  onChange?.();
}

export function getPaperMcpStatus(): PaperMcpSnapshot {
  return snap;
}
