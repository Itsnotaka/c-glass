import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export function readWorkspaceCatalog(repoRoot: string): Record<string, unknown> {
  const fp = join(repoRoot, "pnpm-workspace.yaml");
  const doc = parse(readFileSync(fp, "utf8")) as { catalog?: Record<string, unknown> };
  const catalog = doc.catalog;
  if (!catalog || typeof catalog !== "object") {
    throw new Error(`Missing catalog in ${fp}`);
  }
  return catalog;
}
