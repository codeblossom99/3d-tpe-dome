"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { arcSeatPositions } from "@/lib/venue/geometry";
import {
  seatmapSeatPositions,
  type LabeledSeat,
  type ParsedSeatmap,
} from "@/lib/venue/seatmap";
import seatmaps from "../../data/venues/taipei-dome/seatmaps/seatmaps.generated.json";
import type { ArcLayout, VenueConfig } from "@/lib/venue/types";

// Sections that have a real ASCII seat map override the procedural fill.
const SEATMAPS = seatmaps as Record<string, ParsedSeatmap>;

// StadiView-style pastel palette for seat blocks
const PASTELS = [
  "#93c5fd", "#a5b4fc", "#c4b5fd", "#f9a8d4", "#fca5a5",
  "#fdba74", "#fde68a", "#bef264", "#86efac", "#99f6e4",
];

// Two shades so adjacent rows read as distinct stripes.
const ROW_EVEN = new THREE.Color("#34d399");
const ROW_ODD = new THREE.Color("#0e9f6e");

// deterministic PRNG so seat shading doesn't reshuffle on re-render
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seat boxes for every arc section, plus row/seat labels for mapped sections. */
export default function Seats({ venue }: { venue: VenueConfig }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const { seatPos, seatColor, labeled } = useMemo(() => {
    const rand = mulberry32(42);
    const seatPos: number[] = [];
    const seatColor: THREE.Color[] = [];
    const labeled: LabeledSeat[] = [];
    venue.sections.forEach((section, si) => {
      if (section.layout.type !== "arc") return;
      const tier = venue.tiers.find((t) => t.id === section.tierId);
      if (!tier) return;
      const layout = section.layout as ArcLayout;

      // Real ASCII seat map takes precedence over the procedural fill.
      const map = SEATMAPS[section.id];
      if (map) {
        const seats = seatmapSeatPositions(tier, layout, map);
        for (const seat of seats) {
          seatPos.push(seat.x, seat.y + 0.25, seat.z);
          seatColor.push(seat.row % 2 === 0 ? ROW_EVEN : ROW_ODD);
          labeled.push(seat);
        }
        return;
      }

      const pos = arcSeatPositions(tier, layout, tier.seatSpacing ?? 0.5);
      const base = new THREE.Color(PASTELS[si % PASTELS.length]);
      for (let i = 0; i < pos.length; i += 3) {
        seatPos.push(pos[i], pos[i + 1] + 0.25, pos[i + 2]);
        const c = base.clone();
        c.offsetHSL(0, 0, (rand() - 0.5) * 0.12);
        seatColor.push(c);
      }
    });
    return { seatPos, seatColor, labeled };
  }, [venue]);

  const count = seatPos.length / 3;

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m.setPosition(seatPos[i * 3], seatPos[i * 3 + 1], seatPos[i * 3 + 2]);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, seatColor[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [seatPos, seatColor, count]);

  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[0.42, 0.5, 0.42]} />
        <meshStandardMaterial />
      </instancedMesh>
      {/* Text loads a font asynchronously (suspends); keep it isolated so a
          slow/failed font never blanks the whole canvas. */}
      <Suspense fallback={null}>
        <SeatLabels seats={labeled} />
      </Suspense>
    </group>
  );
}

/** Flat, top-readable seat numbers, plus a bigger row number per row start. */
function SeatLabels({ seats }: { seats: LabeledSeat[] }) {
  const rows = new Map<number, LabeledSeat[]>();
  for (const s of seats) {
    if (!rows.has(s.row)) rows.set(s.row, []);
    rows.get(s.row)!.push(s);
  }

  return (
    <group>
      {seats.map((s) => (
        <Text
          key={`${s.section}-${s.row}-${s.seat}`}
          position={[s.x, s.y + 0.55, s.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.28}
          color="#052e16"
          anchorX="center"
          anchorY="middle"
        >
          {String(s.seat).padStart(2, "0")}
        </Text>
      ))}
      {[...rows.entries()].map(([row, arr]) => {
        // Row label at the first-listed seat, nudged toward the section origin.
        const a = arr[0];
        const dir = Math.hypot(a.x, a.z) || 1;
        const rx = a.x - (a.x / dir) * 1.1;
        const rz = a.z - (a.z / dir) * 1.1;
        return (
          <Text
            key={`row-${a.section}-${row}`}
            position={[rx, a.y + 0.6, rz]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.5}
            color="#f59e0b"
            anchorX="center"
            anchorY="middle"
          >
            {`R${String(row).padStart(2, "0")}`}
          </Text>
        );
      })}
    </group>
  );
}
