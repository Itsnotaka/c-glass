import { describe, expect, it } from "vitest";

import { hueSatFromXY, xyFromHueSat } from "./tint-pad-geometry";

const rect = { left: 100, top: 200, width: 200, height: 200 };
const pad = 16;

describe("tint-pad-geometry", () => {
  it("maps center to zero saturation", () => {
    const c = hueSatFromXY(200, 300, rect, pad);
    expect(c.saturation).toBe(0);
    expect(c.hue).toBe(0);
  });

  it("round-trips hue and saturation at mid radius", () => {
    const h = 120;
    const s = 55;
    const { x, y } = xyFromHueSat(h, s, rect, pad);
    const back = hueSatFromXY(x + rect.left, y + rect.top, rect, pad);
    expect(back.saturation).toBeCloseTo(s, 5);
    expect(back.hue).toBeCloseTo(h, 5);
  });

  it("places hue 0° at top of wheel", () => {
    const r = Math.min(rect.width, rect.height) / 2 - pad;
    const top = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 - r };
    const o = hueSatFromXY(top.x, top.y, rect, pad);
    expect(o.saturation).toBeCloseTo(100, 0);
    expect(o.hue).toBeCloseTo(0, 1);
  });

  it("places hue 90° on the right", () => {
    const r = Math.min(rect.width, rect.height) / 2 - pad;
    const p = { x: rect.left + rect.width / 2 + r, y: rect.top + rect.height / 2 };
    const o = hueSatFromXY(p.x, p.y, rect, pad);
    expect(o.saturation).toBeCloseTo(100, 0);
    expect(o.hue).toBeCloseTo(90, 1);
  });
});
