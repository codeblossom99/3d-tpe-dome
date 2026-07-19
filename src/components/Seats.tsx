"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { arcSeatPositions } from "@/lib/venue/geometry";
import type { ArcLayout, VenueConfig } from "@/lib/venue/types";

// StadiView-style pastel palette for seat blocks
const PASTELS = [
  "#93c5fd", "#a5b4fc", "#c4b5fd", "#f9a8d4", "#fca5a5",
  "#fdba74", "#fde68a", "#bef264", "#86efac", "#99f6e4",
];

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

/** Every seat in every arc section as pastel boxes (one InstancedMesh). */
export default function Seats({ venue }: { venue: VenueConfig }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const { seatPos, seatColor } = useMemo(() => {
    const rand = mulberry32(42);
    const seatPos: number[] = [];
    const seatColor: THREE.Color[] = [];
    venue.sections.forEach((section, si) => {
      if (section.layout.type !== "arc") return;
      const tier = venue.tiers.find((t) => t.id === section.tierId);
      if (!tier) return;
      const pos = arcSeatPositions(tier, section.layout as ArcLayout, tier.seatSpacing ?? 0.5);
      const base = new THREE.Color(PASTELS[si % PASTELS.length]);
      for (let i = 0; i < pos.length; i += 3) {
        seatPos.push(pos[i], pos[i + 1] + 0.25, pos[i + 2]);
        const c = base.clone();
        c.offsetHSL(0, 0, (rand() - 0.5) * 0.12);
        seatColor.push(c);
      }
    });
    return { seatPos, seatColor };
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
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[0.42, 0.5, 0.42]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}
