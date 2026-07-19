import { describe, expect, it } from "vitest";
import { buildArcSectionGeometry } from "../src/lib/venue/geometry";
import type { ArcLayout, Tier } from "../src/lib/venue/types";

const tier: Tier = {
  id: "tier1",
  baseHeight: 2,
  innerRadius: 62,
  rowCount: 34,
  rowDepth: 0.85,
  rowRise: 0.38,
};

const layout: ArcLayout = { type: "arc", startAngle: 40, endAngle: 55 };

describe("buildArcSectionGeometry", () => {
  it("produces the expected vertex count", () => {
    const segments = 8;
    const pos = buildArcSectionGeometry(tier, layout, segments);
    // rows * segments * 2 quads * 2 triangles * 3 vertices * 3 floats
    expect(pos.length).toBe(tier.rowCount * segments * 2 * 2 * 3 * 3);
  });

  it("first row tread sits at baseHeight", () => {
    const pos = buildArcSectionGeometry(tier, layout);
    // first vertex of the first tread quad
    expect(pos[1]).toBeCloseTo(tier.baseHeight);
  });

  it("last row outer radius = innerRadius + rowCount * rowDepth", () => {
    const pos = buildArcSectionGeometry(tier, layout, 1);
    let maxR = 0;
    for (let i = 0; i < pos.length; i += 3) {
      maxR = Math.max(maxR, Math.hypot(pos[i], pos[i + 2]));
    }
    expect(maxR).toBeCloseTo(tier.innerRadius! + tier.rowCount * tier.rowDepth);
  });

  it("respects rowStart/rowEnd overrides", () => {
    const pos = buildArcSectionGeometry(
      tier,
      { ...layout, rowStart: 2, rowEnd: 5 },
      4
    );
    expect(pos.length).toBe(3 * 4 * 2 * 2 * 3 * 3);
    // first tread of row 2
    expect(pos[1]).toBeCloseTo(tier.baseHeight + 2 * tier.rowRise);
  });
});
