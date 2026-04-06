import { defineConfig } from "tsdown";

function bundled(id: string) {
  return (
    id.startsWith("@glass/") ||
    id.startsWith("@mariozechner/pi-coding-agent") ||
    id.startsWith("@mariozechner/pi-agent-core") ||
    id.startsWith("@mariozechner/pi-ai") ||
    id.startsWith("@mariozechner/pi-tui") ||
    id.startsWith("get-east-asian-width") ||
    id.startsWith("mime-types") ||
    id.startsWith("marked") ||
    id.startsWith("chalk") ||
    id.startsWith("electron-updater")
  );
}

const shared = {
  outDir: "dist-electron",
  sourcemap: true,
  deps: {
    alwaysBundle: bundled,
  },
};

const cjs = {
  ...shared,
  format: "cjs" as const,
  outExtensions: () => ({ js: ".js" }),
};

const esm = {
  ...shared,
  format: "esm" as const,
  outExtensions: () => ({ js: ".mjs" }),
};

export default defineConfig([
  {
    ...cjs,
    entry: ["src/main.ts"],
    clean: true,
  },
  {
    ...cjs,
    entry: ["src/preload.ts"],
  },
  {
    ...esm,
    entry: ["src/pi-runtime/pi-runtime-worker.ts"],
  },
]);
