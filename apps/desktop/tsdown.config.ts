import { defineConfig } from "tsdown";

const shared = {
  format: "cjs" as const,
  outDir: "dist-electron",
  sourcemap: true,
  outExtensions: () => ({ js: ".js" }),
};

export default defineConfig([
  {
    ...shared,
    entry: ["src/main.ts"],
    clean: true,
    deps: {
      alwaysBundle: (id) =>
        id.startsWith("@glass/") ||
        id.startsWith("@mariozechner/pi-coding-agent") ||
        id.startsWith("@mariozechner/pi-agent-core") ||
        id.startsWith("@mariozechner/pi-ai") ||
        id.startsWith("electron-updater"),
    },
  },
  {
    ...shared,
    entry: ["src/preload.ts"],
  },
]);
