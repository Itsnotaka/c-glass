export const MACOS_TRAFFIC_LIGHTS = {
  x: 14,
  y: 14,
  spacerWidth: 80,
  paddingTop: 30,
} as const;

export const TRAFFIC_LIGHT_CLUSTER_HEIGHT_PX = 16 as const;
export const TITLEBAR_CONTROL_HEIGHT_PX = 24 as const;
export const TITLEBAR_CONTROL_OFFSET_TOP_PX =
  MACOS_TRAFFIC_LIGHTS.y - (TITLEBAR_CONTROL_HEIGHT_PX - TRAFFIC_LIGHT_CLUSTER_HEIGHT_PX) / 2;
