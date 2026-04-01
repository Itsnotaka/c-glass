import type { GlassBridge } from "@glass/contracts";

export function readGlass(): GlassBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return window.glass;
}

export function getGlass(): GlassBridge {
  const glass = readGlass();
  if (!glass) {
    throw new Error("Glass bridge not found");
  }
  return glass;
}
