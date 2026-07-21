"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import * as THREE from "three";
import { loadStage, loadVenue } from "@/lib/venue/loadVenue";
import {
  buildArcSectionGeometry,
  polygonCentroid,
  sectionViewpoint,
} from "@/lib/venue/geometry";
import Seats from "./Seats";
import VenueMinimap from "./VenueMinimap";
import styles from "./VenueScene.module.css";
import type {
  ArcLayout,
  PolygonLayout,
  Section as SectionType,
  Stage,
  Tier,
  VenueConfig,
} from "@/lib/venue/types";

const camBtnStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  fontSize: 18,
  fontWeight: 700,
  background: "rgba(15, 23, 42, 0.88)",
  color: "#f8fafc",
};

const TIER_COLORS: Record<string, string> = {
  floor: "#4ade80",
  b1: "#60a5fa",
  l2: "#fbbf24",
  l3: "#f87171",
  l4: "#f9a8d4",
  l5: "#a78bfa",
};

function useSectionMaterialColor(tierId: string, hovered: boolean, selected: boolean) {
  return selected ? "#f97316" : hovered ? "#f9fafb" : TIER_COLORS[tierId] ?? "#9ca3af";
}

interface SectionProps {
  tier: Tier;
  section: SectionType;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function ArcSection({ tier, section, selected, hovered, onSelect, onHover }: SectionProps) {
  const geometry = useMemo(() => {
    const positions = buildArcSectionGeometry(tier, section.layout as ArcLayout, 8);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, [tier, section]);
  const color = useSectionMaterialColor(section.tierId, hovered, selected);

  return (
    <mesh
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(section.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(section.id);
      }}
      onPointerOut={() => onHover(null)}
    >
      <meshStandardMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
}

function FloorSection({ tier, section, selected, hovered, onSelect, onHover }: SectionProps) {
  const layout = section.layout as PolygonLayout;
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(layout.points.map((p) => new THREE.Vector2(p.x, p.z)));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2); // XY shape → XZ plane
    return geo;
  }, [layout]);
  const color = useSectionMaterialColor(section.tierId, hovered, selected);

  return (
    <mesh
      geometry={geometry}
      position={[0, tier.baseHeight + 0.15, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(section.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(section.id);
      }}
      onPointerOut={() => onHover(null)}
    >
      <meshStandardMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
}


function StageMesh({ stage }: { stage: Stage }) {
  const geometries = useMemo(() => {
    const parts: { geo: THREE.ExtrudeGeometry }[] = [];
    const make = (points: { x: number; z: number }[], height: number) => {
      // Shape in XY with y = -z, then rotateX(-90°): extrude direction +Z → +Y (up),
      // and shape-y maps back to world +Z. Base ends up at y=0, top at y=height.
      const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.z)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      return geo;
    };
    if (stage.footprint) parts.push({ geo: make(stage.footprint, stage.height ?? 1.5) });
    for (const ext of stage.extensions ?? []) {
      if (ext.footprint) parts.push({ geo: make(ext.footprint, ext.height ?? 1.5) });
    }
    return parts;
  }, [stage]);

  return (
    <group>
      {geometries.map((p, i) => (
        <mesh key={i} geometry={p.geo}>
          <meshStandardMaterial color="#334155" />
        </mesh>
      ))}
      {(stage.screens ?? []).map((s, i) => {
        const w = s.width ?? 16;
        const h = s.height ?? 9;
        return (
          <group
            key={`screen-${i}`}
            position={[s.position?.x ?? 0, s.position?.y ?? 10, s.position?.z ?? 0]}
            rotation={[0, ((s.facing ?? 0) * Math.PI) / 180, 0]}
          >
            {/* frame / LED wall body */}
            <mesh position={[0, 0, -0.35]}>
              <boxGeometry args={[w + 1, h + 1, 0.6]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
            {/* glowing panel */}
            <mesh>
              <planeGeometry args={[w, h]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#38bdf8"
                emissiveIntensity={0.7}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Obstructions({ venue }: { venue: VenueConfig }) {
  return (
    <group>
      {(venue.obstructions ?? []).map((o) => {
        if (o.kind === "column" && o.position) {
          const h = o.height ?? 10;
          return (
            <mesh key={o.id} position={[o.position.x, (o.baseHeight ?? 0) + h / 2, o.position.z]}>
              <cylinderGeometry args={[o.radius ?? 0.5, o.radius ?? 0.5, h, 16]} />
              <meshStandardMaterial color="#64748b" />
            </mesh>
          );
        }
        return null;
      })}
    </group>
  );
}

export default function VenueScene({
  venueId,
  stageId = "end-stage",
}: {
  venueId: string;
  stageId?: string;
}) {
  const fullVenue = useMemo(() => loadVenue(venueId), [venueId]);
  const stage = useMemo(() => loadStage(venueId, stageId), [venueId, stageId]);
  // this configuration's sections: venue stands minus closed ones, plus the
  // stage config's own floor blocks (laid out around its stage position)
  const venue = useMemo(() => {
    const closed = new Set(stage.closedSections ?? []);
    return {
      ...fullVenue,
      sections: [
        ...fullVenue.sections.filter((s) => !closed.has(s.id)),
        ...(stage.sections ?? []),
      ],
    };
  }, [fullVenue, stage]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"overview" | "pov">("overview");
  const controls = useRef<CameraControls | null>(null);

  const selected = venue.sections.find((s) => s.id === selectedId) ?? null;
  const selectedTier = selected ? venue.tiers.find((t) => t.id === selected.tierId) : null;

  const stageTarget = useMemo(() => {
    const c = stage.footprint ? polygonCentroid(stage.footprint) : { x: 0, z: 0 };
    return { x: c.x, y: (stage.height ?? 1.5) + 1.5, z: c.z };
  }, [stage]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return venue.sections
      .filter((s) => {
        const tierLabel =
          venue.tiers.find((t) => t.id === s.tierId)?.label ?? "";
        return (
          s.id.toLowerCase().includes(q) ||
          (s.label ?? "").toLowerCase().includes(q) ||
          tierLabel.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [query, venue]);

  const focusSection = useCallback(
    (id: string) => {
      setSelectedId(id);
      setQuery("");
      setIsPanelOpen(false);
      const section = venue.sections.find((s) => s.id === id);
      const tier = section && venue.tiers.find((t) => t.id === section.tierId);
      if (!section || !tier) return;
      setMode("overview");
      const p = sectionViewpoint(tier, section, 0);
      // camera outside/above the section, looking at it
      const len = Math.hypot(p.x, p.z) || 1;
      const out = 1.45;
      controls.current?.setLookAt(
        (p.x / len) * len * out,
        p.y + 40,
        (p.z / len) * len * out,
        p.x,
        p.y,
        p.z,
        true
      );
    },
    [venue]
  );

  const goOverview = useCallback(() => {
    setMode("overview");
    controls.current?.setLookAt(0, 80, 120, 0, 0, 0, true);
  }, []);

  const goPovForSection = useCallback((id: string) => {
    const section = venue.sections.find((item) => item.id === id);
    const tier = section && venue.tiers.find((item) => item.id === section.tierId);
    if (!section || !tier) return;

    const eye = venue.eyeHeight?.seated ?? 1.2;
    const p = sectionViewpoint(tier, section, eye);
    // First-person: park the orbit target 0.5m ahead of the eye, toward the
    // stage. With min/maxDistance clamped small, dragging looks around in
    // place instead of orbiting the stage.
    const d = new THREE.Vector3(
      stageTarget.x - p.x,
      stageTarget.y - p.y,
      stageTarget.z - p.z
    ).normalize();
    setSelectedId(id);
    setQuery("");
    setIsPanelOpen(false);
    setMode("pov");
    controls.current?.setLookAt(
      p.x, p.y, p.z,
      p.x + d.x * 0.5, p.y + d.y * 0.5, p.z + d.z * 0.5,
      true
    );
  }, [venue, stageTarget]);

  const goPov = useCallback(() => {
    if (selected) goPovForSection(selected.id);
  }, [selected, goPovForSection]);

  const handleSectionSelect = useCallback(
    (id: string) => {
      if (window.matchMedia("(max-width: 720px)").matches) {
        goPovForSection(id);
        return;
      }
      focusSection(id);
    },
    [focusSection, goPovForSection]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") goOverview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goOverview]);

  const takeScreenshot = useCallback(() => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${venueId}-${selectedId ?? "overview"}.png`;
    a.click();
  }, [venueId, selectedId]);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%", background: "#0f172a" }}
    >
      <Canvas
        camera={{ position: [0, 80, 120], fov: 50 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[50, 100, 50]} intensity={1} />

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[60, 64]} />
          <meshStandardMaterial color="#14532d" />
        </mesh>

        {venue.sections.map((section) => {
          const tier = venue.tiers.find((t) => t.id === section.tierId);
          if (!tier) return null;
          const props = {
            tier,
            section,
            selected: section.id === selectedId,
            hovered: section.id === hoveredId,
            onSelect: handleSectionSelect,
            onHover: setHoveredId,
          };
          return section.layout.type === "arc" ? (
            <ArcSection key={section.id} {...props} />
          ) : (
            <FloorSection key={section.id} {...props} />
          );
        })}

        <Seats venue={venue} />
        <StageMesh stage={stage} />
        <Obstructions venue={venue} />

        <CameraControls
          ref={controls}
          maxPolarAngle={mode === "pov" ? Math.PI : Math.PI / 2.05}
          minDistance={mode === "pov" ? 0.5 : 20}
          maxDistance={mode === "pov" ? 0.5 : 300}
          azimuthRotateSpeed={mode === "pov" ? -0.4 : 1}
          polarRotateSpeed={mode === "pov" ? -0.4 : 1}
          truckSpeed={mode === "pov" ? 0 : 2}
        />
      </Canvas>

      {/* search bar */}
      {mode !== "pov" && (
      <div
        className={styles.search}
        style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          width: 260,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) handleSectionSelect(matches[0].id);
            if (e.key === "Escape") {
              e.stopPropagation();
              setQuery("");
            }
          }}
          placeholder="搜尋區域，例如 309、A…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 16px",
            borderRadius: 999,
            border: "none",
            outline: "none",
            fontSize: 14,
            background: "rgba(15, 23, 42, 0.88)",
            color: "#f8fafc",
          }}
        />
        {matches.length > 0 && (
          <div
            style={{
              marginTop: 6,
              background: "rgba(15, 23, 42, 0.95)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {matches.map((m) => (
              <div
                key={m.id}
                onClick={() => handleSectionSelect(m.id)}
                style={{
                  padding: "9px 16px",
                  color: "#f8fafc",
                  fontSize: 14,
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
                }}
              >
                <strong>{m.id} 區</strong>
                <span style={{ opacity: 0.6, marginLeft: 8, fontSize: 12 }}>
                  {venue.tiers.find((t) => t.id === m.tierId)?.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* hover label — 未點擊就能知道是哪一區 */}
      {hoveredId && hoveredId !== selectedId && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: "rgba(15, 23, 42, 0.88)",
            color: "#f8fafc",
            borderRadius: 999,
            padding: "8px 20px",
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "system-ui, sans-serif",
            pointerEvents: "none",
          }}
        >
          {(() => {
            const s = venue.sections.find((x) => x.id === hoveredId);
            const t = venue.tiers.find((x) => x.id === s?.tierId);
            return s?.label ?? `${hoveredId} 區 · ${t?.label ?? ""}`;
          })()}
        </div>
      )}

      {isPanelOpen && (
        <button
          className={styles.panelBackdrop}
          aria-label="關閉場館區域面板"
          onClick={() => setIsPanelOpen(false)}
        />
      )}

      {/* desktop side panel / mobile bottom sheet */}
      <div
        className={`${styles.venuePanel} ${isPanelOpen ? styles.venuePanelOpen : ""}`}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          width: 260,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ background: "rgba(15, 23, 42, 0.88)", borderRadius: 12, padding: 12 }}>
          <div style={{ color: "#f8fafc", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8, opacity: 0.7 }}>
            場館總覽
          </div>
          <VenueMinimap
            venue={venue}
            stage={stage}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={handleSectionSelect}
          />
        </div>

        <div
          style={{
            background: "rgba(15, 23, 42, 0.88)",
            color: "#f8fafc",
            borderRadius: 12,
            padding: "16px 18px",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {venue.name}（
            {stageId === "center-stage"
              ? "中央舞台"
              : stageId === "baseball"
                ? "棒球"
                : "標準舞台"}
            ）
          </div>
          {selected ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 700, margin: "4px 0" }}>
                {selected.label ?? `${selected.id} 區`}
              </div>
              <div style={{ opacity: 0.8 }}>{selectedTier?.label}</div>
              {selected.layout.type === "arc" && (
                <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>
                  第 {((selected.layout as ArcLayout).rowStart ?? 0) + 1}–
                  {(selected.layout as ArcLayout).rowEnd ?? selectedTier?.rowCount} 排
                </div>
              )}
              {selected.notes && (
                <div style={{ marginTop: 8, color: "#fca5a5" }}>⚠ {selected.notes}</div>
              )}
              {mode === "overview" && (
              <button
                onClick={() => {
                  goPov();
                  setIsPanelOpen(false);
                }}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  background: "#f59e0b",
                  color: "#1e293b",
                }}
              >
                進入座位視角
              </button>
              )}
            </>
          ) : (
            <div style={{ marginTop: 6, opacity: 0.8 }}>
              點選 3D 區塊或上方小地圖查看資訊，再進入座位視角。
            </div>
          )}
        </div>
      </div>

      {mode === "overview" && (
        <button
          className={styles.panelTrigger}
          aria-expanded={isPanelOpen}
          onClick={() => setIsPanelOpen((open) => !open)}
        >
          <span>
            {selected
              ? `${selected.id} 區`
              : "區域"}
          </span>
          <span aria-hidden="true">{isPanelOpen ? "↓" : "↑"}</span>
        </button>
      )}

      {/* camera controls */}
      <div
        className={styles.cameraControls}
        style={{
          position: "absolute",
          bottom: 20,
          left: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <button style={camBtnStyle} onClick={() => controls.current?.rotate(Math.PI / 4, 0, true)}>
          ⟲
        </button>
        <button style={camBtnStyle} onClick={() => controls.current?.dolly(15, true)}>
          ＋
        </button>
        <button style={camBtnStyle} onClick={() => controls.current?.dolly(-15, true)}>
          －
        </button>
        <button style={camBtnStyle} onClick={takeScreenshot} title="下載截圖">
          📷
        </button>
      </div>

      {/* POV bottom bar */}
      {mode === "pov" && (
        <button
          onClick={goOverview}
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 28px",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "system-ui, sans-serif",
            background: "#f8fafc",
            color: "#1e293b",
          }}
        >
          ← 回到全景
        </button>
      )}
    </div>
  );
}
