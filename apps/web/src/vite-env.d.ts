/// <reference types="vite/client" />

import type { EvlogApi } from "./lib/evlog";
import type { NativeApi, DesktopBridge } from "@glass/contracts";

interface ImportMetaEnv {
  readonly APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    evlog?: EvlogApi;
    nativeApi?: NativeApi;
    desktopBridge?: DesktopBridge;
  }
}
