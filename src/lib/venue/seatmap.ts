// Parses ASCII seat maps (data/venues/taipei-dome/seatmaps/*.seatmap.txt) into
// structured rows, and lays each labeled seat out along an arc section.
//
// File format:
//   Field direction: ↑           (optional, decorative)
//   Row 05:   [09][08]...[01]     (leading indent is only visual centering)
// Each [NN] token is a seat number. Tokens are listed left→right as printed.

import type { ArcLayout, Tier } from "./types";

const DEG = Math.PI / 180;

export interface SeatmapRow {
  /** Row number as printed ("Row 05" → 5). */
  row: number;
  /** Seat numbers in printed left→right order. */
  seats: number[];
}

export interface ParsedSeatmap {
  section: string;
  rows: SeatmapRow[];
}

const ROW_RE = /^Row\s+(\d+)\s*:\s*(.*)$/;
const SEAT_RE = /\[(\d+)\]/g;

/** Parse raw seatmap text. `section` is taken from a `section:` header if
 *  present, else from the fallback (e.g. the filename). */
export function parseSeatmap(text: string, fallbackSection = ""): ParsedSeatmap {
  let section = fallbackSection;
  const rows: SeatmapRow[] = [];

  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^section\s*:\s*(\S+)/i);
    if (header) {
      section = header[1];
      continue;
    }
    const m = line.match(ROW_RE);
    if (!m) continue;
    const row = parseInt(m[1], 10);
    const seats: number[] = [];
    let s: RegExpExecArray | null;
    SEAT_RE.lastIndex = 0;
    while ((s = SEAT_RE.exec(m[2]))) seats.push(parseInt(s[1], 10));
    if (seats.length) rows.push({ row, seats });
  }

  return { section, rows };
}

export interface LabeledSeat {
  section: string;
  row: number;
  seat: number;
  x: number;
  y: number;
  z: number;
}

/**
 * Place every seat of a parsed seatmap in 3D along an arc section.
 * Each row spans the full section arc (startAngle→endAngle); a row with more
 * seats just packs them tighter, matching constant real-world seat spacing.
 * Printed left→right order maps to startAngle→endAngle.
 */
export function seatmapSeatPositions(
  tier: Tier,
  layout: ArcLayout,
  map: ParsedSeatmap
): LabeledSeat[] {
  const innerRadius = tier.innerRadius ?? 0;
  const a0 = layout.startAngle * DEG;
  const a1 = layout.endAngle * DEG;
  const cx = layout.center?.x ?? 0;
  const cz = layout.center?.z ?? 0;

  const out: LabeledSeat[] = [];
  for (const { row, seats } of map.rows) {
    const r = innerRadius + (row + 0.5) * tier.rowDepth;
    const y = tier.baseHeight + row * tier.rowRise;
    const count = seats.length;
    for (let s = 0; s < count; s++) {
      const a = a0 + ((a1 - a0) * (s + 0.5)) / count;
      out.push({
        section: map.section,
        row,
        seat: seats[s],
        x: cx + r * Math.cos(a),
        y,
        z: cz + r * Math.sin(a),
      });
    }
  }
  return out;
}
