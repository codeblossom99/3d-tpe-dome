"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { arcSeatPositions } from "@/lib/venue/geometry";
import { seatmapSeatPositions, type LabeledSeat, type ParsedSeatmap } from "@/lib/venue/seatmap";
import seatmaps from "../../data/venues/taipei-dome/seatmaps/seatmaps.generated.json";
import type { ArcLayout, VenueConfig } from "@/lib/venue/types";

const SEATMAPS = seatmaps as Record<string, ParsedSeatmap>;
const TIER_SEAT_COLORS: Record<string, string> = {
  b1: "#1f4e8c", l2: "#315f9f", l3: "#4773ad", l4: "#5b82b7", l5: "#6f90be",
};
const PAN_OFFSET: [number, number, number] = [0, 0.38, 0];
const PAN_SIZE: [number, number, number] = [0.44, 0.12, 0.42];
const BACK_OFFSET: [number, number, number] = [0, 0.7, 0.17];
const BACK_SIZE: [number, number, number] = [0.44, 0.56, 0.1];
const LEG_OFFSET: [number, number, number] = [0, 0.17, 0.12];
const LEG_SIZE: [number, number, number] = [0.08, 0.34, 0.08];

interface RenderSeat {
  x: number; y: number; z: number; rotationY: number;
  color: THREE.Color; label?: LabeledSeat;
}

function ChairPart({
  seats, offset, size, roughness = 0.72,
}: {
  seats: RenderSeat[];
  offset: [number, number, number];
  size: [number, number, number];
  roughness?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const local = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    for (let index = 0; index < seats.length; index++) {
      const seat = seats[index];
      quaternion.setFromAxisAngle(up, seat.rotationY);
      local.set(...offset).applyQuaternion(quaternion);
      position.set(seat.x + local.x, seat.y + local.y, seat.z + local.z);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, seat.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [offset, seats]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, seats.length]} frustumCulled={false}>
      <boxGeometry args={size} />
      <meshStandardMaterial roughness={roughness} metalness={0.04} />
    </instancedMesh>
  );
}

/** A lightweight three-piece stadium chair for every real ASCII-map seat. */
export default function Seats({ venue }: { venue: VenueConfig }) {
  const seats = useMemo(() => {
    const output: RenderSeat[] = [];
    for (const section of venue.sections) {
      if (section.layout.type !== "arc") continue;
      const tier = venue.tiers.find((item) => item.id === section.tierId);
      if (!tier) continue;
      const layout = section.layout as ArcLayout;
      const map = SEATMAPS[section.id];
      const base = new THREE.Color(TIER_SEAT_COLORS[section.tierId] ?? "#315f9f");

      if (map) {
        for (const seat of seatmapSeatPositions(tier, layout, map)) {
          const color = base.clone().offsetHSL(0, 0, seat.row % 2 ? -0.035 : 0.035);
          output.push({ ...seat, color, label: seat });
        }
        continue;
      }

      const positions = arcSeatPositions(tier, layout, tier.seatSpacing ?? 0.5);
      const cx = layout.center?.x ?? 0;
      const cz = layout.center?.z ?? 0;
      for (let index = 0; index < positions.length; index += 3) {
        const x = positions[index];
        const z = positions[index + 2];
        const angle = Math.atan2(z - cz, x - cx);
        output.push({ x, y: positions[index + 1], z, rotationY: Math.PI / 2 - angle, color: base });
      }
    }
    return output;
  }, [venue]);

  const darkSeats = useMemo(
    () => seats.map((seat) => ({ ...seat, color: new THREE.Color("#263545") })),
    [seats]
  );

  return (
    <group>
      {/* Molded plastic seat pan, upright back, and dark metal pedestal. */}
      <ChairPart seats={seats} offset={PAN_OFFSET} size={PAN_SIZE} />
      <ChairPart seats={seats} offset={BACK_OFFSET} size={BACK_SIZE} />
      <ChairPart seats={darkSeats} offset={LEG_OFFSET} size={LEG_SIZE} roughness={0.45} />
    </group>
  );
}
