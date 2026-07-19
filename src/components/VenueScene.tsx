"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { loadVenue } from "@/lib/venue/loadVenue";
import { buildArcSectionGeometry } from "@/lib/venue/geometry";
import type { ArcLayout, Section as SectionType, Tier } from "@/lib/venue/types";

function ArcSection({
  tier,
  section,
  selected,
  onSelect,
}: {
  tier: Tier;
  section: SectionType;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const geometry = useMemo(() => {
    const positions = buildArcSectionGeometry(
      tier,
      section.layout as ArcLayout,
      8
    );
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, [tier, section]);

  const color = selected ? "#f59e0b" : hovered ? "#93c5fd" : "#9ca3af";

  return (
    <mesh
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(section.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <meshStandardMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function VenueScene({ venueId }: { venueId: string }) {
  const venue = useMemo(() => loadVenue(venueId), [venueId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = venue.sections.find((s) => s.id === selectedId);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas camera={{ position: [0, 80, 120], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[50, 100, 50]} intensity={1} />

        {/* field */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[60, 64]} />
          <meshStandardMaterial color="#22c55e" />
        </mesh>

        {venue.sections
          .filter((s) => s.layout.type === "arc")
          .map((section) => {
            const tier = venue.tiers.find((t) => t.id === section.tierId);
            if (!tier) return null;
            return (
              <ArcSection
                key={section.id}
                tier={tier}
                section={section}
                selected={section.id === selectedId}
                onSelect={setSelectedId}
              />
            );
          })}

        <OrbitControls maxPolarAngle={Math.PI / 2.1} />
      </Canvas>

      {selected && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 14,
            maxWidth: 280,
          }}
        >
          <strong>
            {selected.label ?? `${selected.id} 區`}
          </strong>
          {selected.notes && <div style={{ marginTop: 4 }}>{selected.notes}</div>}
        </div>
      )}
    </div>
  );
}
