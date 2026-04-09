import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/main.ts"],
    format: "cjs",
    outDir: "dist-electron",
    sourcemap: true,
    outExtensions: () => ({ js: ".js" }),
    clean: true,
  },
  {
    entry: ["src/preload.ts"],
    format: "cjs",
    outDir: "dist-electron",
    sourcemap: true,
    outExtensions: () => ({ js: ".js" }),
  },
]);
