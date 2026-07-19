import { describe, expect, it } from "vitest";
import {
  arcSeatPositions,
  buildArcSectionGeometry,
  polygonCentroid,
  sectionViewpoint,
} from "../src/lib/venue/geometry";
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

describe("sectionViewpoint", () => {
  it("arc section: mid row, mid angle, eye height added", () => {
    const p = sectionViewpoint(
      tier,
      { id: "x", tierId: "tier1", layout: { type: "arc", startAngle: 0, endAngle: 90 } },
      1.2
    );
    const midRow = tier.rowCount / 2;
    const r = tier.innerRadius! + midRow * tier.rowDepth;
    expect(p.y).toBeCloseTo(tier.baseHeight + midRow * tier.rowRise + 1.2);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(r);
    // mid angle 45°
    expect(p.x).toBeCloseTo(p.z);
  });

  it("polygon section: centroid + eye height above base", () => {
    const p = sectionViewpoint(
      { ...tier, baseHeight: 0 },
      {
        id: "A",
        tierId: "tier1",
        layout: {
          type: "polygon",
          points: [
            { x: 0, z: 0 },
            { x: 10, z: 0 },
            { x: 10, z: 10 },
            { x: 0, z: 10 },
          ],
        },
      },
      1.6
    );
    expect(p).toEqual({ x: 5, y: 1.6, z: 5 });
  });

  it("arcSeatPositions: seats sit on tread centers within the arc", () => {
    const pos = arcSeatPositions(tier, { ...layout, rowStart: 0, rowEnd: 1 }, 0.5);
    expect(pos.length % 3).toBe(0);
    const r = Math.hypot(pos[0], pos[2]);
    expect(r).toBeCloseTo(tier.innerRadius! + 0.5 * tier.rowDepth);
    expect(pos[1]).toBeCloseTo(tier.baseHeight);
    // ~arc length / spacing seats in the row
    const arc = ((55 - 40) * Math.PI / 180) * r;
    expect(pos.length / 3).toBe(Math.floor(arc / 0.5));
  });

  it("polygonCentroid averages points", () => {
    expect(polygonCentroid([{ x: 0, z: 0 }, { x: 4, z: 8 }])).toEqual({ x: 2, z: 4 });
  });
});
