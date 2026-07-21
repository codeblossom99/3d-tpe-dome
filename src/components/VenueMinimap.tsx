"use client";

import { useMemo } from "react";
import type { ArcLayout, PolygonLayout, Stage, VenueConfig } from "@/lib/venue/types";

const DEG = Math.PI / 180;

const TIER_COLORS: Record<string, string> = {
  floor: "#4ade80",
  b1: "#60a5fa",
  l2: "#fbbf24",
  l3: "#f87171",
  l4: "#f9a8d4",
  l5: "#a78bfa",
};

function arcPath(inner: number, outer: number, a0d: number, a1d: number, cx = 0, cz = 0): string {
  const a0 = a0d * DEG;
  const a1 = a1d * DEG;
  const large = Math.abs(a1d - a0d) > 180 ? 1 : 0;
  const p = (r: number, a: number) =>
    `${(cx + r * Math.cos(a)).toFixed(1)} ${(cz + r * Math.sin(a)).toFixed(1)}`;
  return [
    `M ${p(inner, a0)}`,
    `A ${inner} ${inner} 0 ${large} 1 ${p(inner, a1)}`,
    `L ${p(outer, a1)}`,
    `A ${outer} ${outer} 0 ${large} 0 ${p(outer, a0)}`,
    "Z",
  ].join(" ");
}

export default function VenueMinimap({
  venue,
  stage,
  selectedId,
  hoveredId,
  onSelect,
}: {
  venue: VenueConfig;
  stage: Stage;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
}) {
  const shapes = useMemo(
    () =>
      venue.sections.map((s) => {
        const tier = venue.tiers.find((t) => t.id === s.tierId);
        if (!tier) return null;
        if (s.layout.type === "arc") {
          const l = s.layout as ArcLayout;
          const inner = (tier.innerRadius ?? 0) + (l.rowStart ?? 0) * tier.rowDepth;
          const outer = (tier.innerRadius ?? 0) + (l.rowEnd ?? tier.rowCount) * tier.rowDepth;
          return {
            id: s.id,
            tierId: s.tierId,
            d: arcPath(inner, outer, l.startAngle, l.endAngle, l.center?.x, l.center?.z),
          };
        }
        const l = s.layout as PolygonLayout;
        const d = `M ${l.points.map((p) => `${p.x} ${p.z}`).join(" L ")} Z`;
        return { id: s.id, tierId: s.tierId, d };
      }),
    [venue]
  );

  const stagePath = useMemo(() => {
    if (!stage.footprint) return null;
    return `M ${stage.footprint.map((p) => `${p.x} ${p.z}`).join(" L ")} Z`;
  }, [stage]);

  return (
    <svg viewBox="-100 -100 200 200" style={{ width: "100%", display: "block" }}>
      <rect x={-100} y={-100} width={200} height={200} rx={8} fill="#020617" />
      <ellipse cx={0} cy={0} rx={venue.field.radiusX ?? 60} ry={venue.field.radiusZ ?? 55} fill="#14532d" />
      {stagePath && <path d={stagePath} fill="#475569" />}
      {shapes.map(
        (sh) =>
          sh && (
            <path
              key={sh.id}
              d={sh.d}
              fill={
                sh.id === selectedId
                  ? "#f97316"
                  : sh.id === hoveredId
                    ? "#f8fafc"
                    : TIER_COLORS[sh.tierId] ?? "#64748b"
              }
              stroke="#020617"
              strokeWidth={0.8}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(sh.id)}
            />
          )
      )}
    </svg>
  );
}
