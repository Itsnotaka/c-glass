/// <reference types="vite/client" />

import type { GlassBridge } from "@glass/contracts";

interface ImportMetaEnv {
  readonly APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    glass?: GlassBridge;
  }
}
