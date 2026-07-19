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
const SKIN = ["#f5d0b5", "#e8b48a", "#c98d5f", "#f8e2cf"];

// deterministic PRNG so the crowd doesn't reshuffle on re-render
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Every seat in every arc section as pastel boxes, with sphere "heads"
 * on ~65% of them — the StadiView crowd look.
 */
export default function Crowd({ venue }: { venue: VenueConfig }) {
  const seatsRef = useRef<THREE.InstancedMesh>(null);
  const headsRef = useRef<THREE.InstancedMesh>(null);

  const { seatPos, seatColor, headPos, headColor } = useMemo(() => {
    const rand = mulberry32(42);
    const seatPos: number[] = [];
    const seatColor: THREE.Color[] = [];
    const headPos: number[] = [];
    const headColor: THREE.Color[] = [];

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
        if (rand() < 0.65) {
          headPos.push(pos[i], pos[i + 1] + 0.75, pos[i + 2]);
          headColor.push(new THREE.Color(SKIN[Math.floor(rand() * SKIN.length)]));
        }
      }
    });
    return { seatPos, seatColor, headPos, headColor };
  }, [venue]);

  const seatCount = seatPos.length / 3;
  const headCount = headPos.length / 3;

  useEffect(() => {
    const m = new THREE.Matrix4();
    const seats = seatsRef.current;
    if (seats) {
      for (let i = 0; i < seatCount; i++) {
        m.setPosition(seatPos[i * 3], seatPos[i * 3 + 1], seatPos[i * 3 + 2]);
        seats.setMatrixAt(i, m);
        seats.setColorAt(i, seatColor[i]);
      }
      seats.instanceMatrix.needsUpdate = true;
      if (seats.instanceColor) seats.instanceColor.needsUpdate = true;
    }
    const heads = headsRef.current;
    if (heads) {
      for (let i = 0; i < headCount; i++) {
        m.setPosition(headPos[i * 3], headPos[i * 3 + 1], headPos[i * 3 + 2]);
        heads.setMatrixAt(i, m);
        heads.setColorAt(i, headColor[i]);
      }
      heads.instanceMatrix.needsUpdate = true;
      if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    }
  }, [seatPos, seatColor, headPos, headColor, seatCount, headCount]);

  return (
    <group>
      <instancedMesh ref={seatsRef} args={[undefined, undefined, seatCount]} frustumCulled={false}>
        <boxGeometry args={[0.42, 0.5, 0.42]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={headsRef} args={[undefined, undefined, headCount]} frustumCulled={false}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  );
}
