// Pure math — no three.js imports, so it's trivially testable with vitest.
import type { ArcLayout, PolygonLayout, Section, Tier, XZ } from "./types";

const DEG = Math.PI / 180;

/**
 * Builds a triangle soup (non-indexed positions, xyz per vertex) for an arc
 * section of a tier: per row a horizontal tread + a vertical riser up to the
 * next row, sampled along startAngle→endAngle.
 *
 * Row i: inner radius r0 = innerRadius + i*rowDepth, tread height
 * y = baseHeight + i*rowRise. The riser sits at r0 + rowDepth and rises
 * rowRise, so the last row's outer radius = innerRadius + rowCount*rowDepth.
 */
export function buildArcSectionGeometry(
  tier: Tier,
  layout: ArcLayout,
  angularSegments = 8
): Float32Array {
  const innerRadius = tier.innerRadius ?? 0;
  const rowStart = layout.rowStart ?? 0;
  const rowEnd = layout.rowEnd ?? tier.rowCount;
  const rows = rowEnd - rowStart;
  const a0 = layout.startAngle * DEG;
  const a1 = layout.endAngle * DEG;

  // rows * segments * (tread quad + riser quad) * 2 triangles * 3 vertices * 3 floats
  const out = new Float32Array(rows * angularSegments * 2 * 2 * 3 * 3);
  let o = 0;

  const push = (x: number, y: number, z: number) => {
    out[o++] = x;
    out[o++] = y;
    out[o++] = z;
  };

  // quad from 4 corners (a,b,c,d in CCW order) → 2 triangles
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    push(a[0], a[1], a[2]);
    push(b[0], b[1], b[2]);
    push(c[0], c[1], c[2]);
    push(a[0], a[1], a[2]);
    push(c[0], c[1], c[2]);
    push(d[0], d[1], d[2]);
  };

  const at = (r: number, y: number, angle: number) => [
    r * Math.cos(angle),
    y,
    r * Math.sin(angle),
  ];

  for (let i = rowStart; i < rowEnd; i++) {
    const r0 = innerRadius + i * tier.rowDepth;
    const r1 = r0 + tier.rowDepth;
    const y = tier.baseHeight + i * tier.rowRise;
    const yTop = y + tier.rowRise;

    for (let s = 0; s < angularSegments; s++) {
      const t0 = a0 + ((a1 - a0) * s) / angularSegments;
      const t1 = a0 + ((a1 - a0) * (s + 1)) / angularSegments;

      // tread (horizontal, facing up)
      quad(at(r0, y, t0), at(r0, y, t1), at(r1, y, t1), at(r1, y, t0));
      // riser (vertical, at outer edge, facing the field)
      quad(at(r1, y, t0), at(r1, y, t1), at(r1, yTop, t1), at(r1, yTop, t0));
    }
  }

  return out;
}

export function polygonCentroid(points: XZ[]): XZ {
  let x = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    z += p.z;
  }
  return { x: x / points.length, z: z / points.length };
}

/**
 * Eye position for a seat POV camera at the middle of a section.
 * Arc sections: mid angle, mid row of the section's row range.
 * Polygon sections: centroid at eyeHeight above the tier base.
 */
export function sectionViewpoint(
  tier: Tier,
  section: Section,
  eyeHeight = 1.2
): { x: number; y: number; z: number } {
  if (section.layout.type === "polygon") {
    const layout = section.layout as PolygonLayout;
    const c = polygonCentroid(layout.points);
    return { x: c.x, y: tier.baseHeight + eyeHeight, z: c.z };
  }
  const layout = section.layout as ArcLayout;
  const rowStart = layout.rowStart ?? 0;
  const rowEnd = layout.rowEnd ?? tier.rowCount;
  const midRow = (rowStart + rowEnd) / 2;
  const r = (tier.innerRadius ?? 0) + midRow * tier.rowDepth;
  const y = tier.baseHeight + midRow * tier.rowRise + eyeHeight;
  const a = ((layout.startAngle + layout.endAngle) / 2) * (Math.PI / 180);
  return { x: r * Math.cos(a), y, z: r * Math.sin(a) };
}
