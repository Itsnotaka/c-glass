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
  format: "cjs" as const,
  outDir: "dist-electron",
  sourcemap: true,
  outExtensions: () => ({ js: ".js" }),
  deps: {
    alwaysBundle: bundled,
  },
};

export default defineConfig([
  {
    ...shared,
    entry: ["src/main.ts"],
    clean: true,
  },
  {
    ...shared,
    entry: ["src/preload.ts", "src/pi-runtime/pi-runtime-worker.ts"],
  },
]);
