// Hand-written types mirroring schemas/venue-config.schema.json.
// Later these can be generated with json-schema-to-typescript.

export interface XZ {
  x: number;
  z: number;
}

export interface XYZ {
  x: number;
  y: number;
  z: number;
}

export interface Field {
  shape: "ellipse" | "rect" | "polygon";
  radiusX?: number;
  radiusZ?: number;
  width?: number;
  depth?: number;
  points?: XZ[];
}

export interface Tier {
  id: string;
  label?: string;
  /** Y of the tier's first row (front edge) */
  baseHeight: number;
  /** Distance from origin to the tier's front edge */
  innerRadius?: number;
  rowCount: number;
  /** Horizontal depth per row (tread) */
  rowDepth: number;
  /** Vertical rise per row (riser) */
  rowRise: number;
  seatSpacing?: number;
  overhangFrom?: string;
}

export interface ArcLayout {
  type: "arc";
  /** Degrees, 0 = +X axis, CCW */
  startAngle: number;
  endAngle: number;
  rowStart?: number;
  rowEnd?: number;
}

export interface PolygonLayout {
  type: "polygon";
  points: XZ[];
  rowDirection?: number;
}

export type SectionLayout = ArcLayout | PolygonLayout;

export interface Section {
  id: string;
  label?: string;
  tierId: string;
  layout: SectionLayout;
  priceTier?: string;
  notes?: string;
}

export interface StageExtension {
  footprint?: XZ[];
  height?: number;
}

export interface StageScreen {
  position?: XYZ;
  width?: number;
  height?: number;
  facing?: number;
}

export interface Stage {
  type?: "center" | "end" | "four-sided" | "custom";
  position?: XZ;
  rotation?: number;
  footprint?: XZ[];
  height?: number;
  extensions?: StageExtension[];
  screens?: StageScreen[];
}

export interface Obstruction {
  id: string;
  kind: "column" | "railing" | "speaker" | "rigging" | "wall";
  position?: XZ;
  radius?: number;
  baseHeight?: number;
  height?: number;
  path?: XZ[];
  affectsSections?: string[];
}

export interface EyeHeight {
  seated?: number;
  standing?: number;
}

export interface VenueConfig {
  id: string;
  name: string;
  units: "meters";
  field: Field;
  tiers: Tier[];
  sections: Section[];
  stage?: Stage;
  obstructions?: Obstruction[];
  eyeHeight?: EyeHeight;
}
