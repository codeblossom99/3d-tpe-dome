import type { ArcLayout, Tier } from "./types";

const DEG = Math.PI / 180;
const LEGACY_ROW_RE = /^Row\s+(\d+)\s*:\s*(.*)$/;
const MATRIX_ROW_RE = /^(\d+)\s*:\s*(.*)$/;
const NUMBERED_SEAT_RE = /\[(\d+)\]/g;
const ANY_SEAT_RE = /\[(?:■|\d+)\]/g;

export interface SeatmapRow { row: number; seats: number[]; }
export interface ParsedSeatmap { section: string; rows: SeatmapRow[]; }

const numbers = (value: string) => [...value.matchAll(/\d+/g)].map((match) => Number(match[0]));
const seatCount = (value: string) => [...value.matchAll(ANY_SEAT_RE)].length;

/** Parse both the original `Row 05: [09]...` notation and the Taipei Dome
 * screenshot matrix notation, where `Row:` lists rows and each `NN:` line is
 * one seat number across those rows. */
export function parseSeatmap(text: string, fallbackSection = ""): ParsedSeatmap {
  let section = fallbackSection;
  const lines = text.split(/\r?\n/);
  const legacyRows: SeatmapRow[] = [];

  for (const line of lines) {
    const header = line.match(/^section\s*:\s*(\S+)/i);
    if (header) section = header[1];
    const row = line.match(LEGACY_ROW_RE);
    if (!row) continue;
    const seats = [...row[2].matchAll(NUMBERED_SEAT_RE)].map((match) => Number(match[1]));
    if (seats.length) legacyRows.push({ row: Number(row[1]), seats });
  }
  if (legacyRows.length) return { section, rows: legacyRows };

  const rowHeader = lines.find((line) => /^Row(?::|\s+\d)/.test(line));
  const rowNumbers = rowHeader ? numbers(rowHeader) : [];
  const matrixLines = lines
    .map((line) => line.match(MATRIX_ROW_RE))
    .filter((match): match is RegExpMatchArray => Boolean(match && seatCount(match[2])));

  if (rowNumbers.length && matrixLines.length) {
    const byRow = new Map(rowNumbers.map((row) => [row, [] as number[]]));
    const direction = text.match(/^Field direction:\s*(.)/m)?.[1];
    for (const match of matrixLines) {
      const seat = Number(match[1]);
      const count = seatCount(match[2]);
      const activeRows = direction === "→" ? rowNumbers.slice(0, count) : rowNumbers.slice(-count);
      for (const row of activeRows) byRow.get(row)?.push(seat);
    }
    return {
      section,
      rows: rowNumbers.map((row) => ({ row, seats: byRow.get(row) ?? [] })).filter((row) => row.seats.length),
    };
  }

  if (matrixLines.length) {
    return {
      section,
      rows: matrixLines.map((match) => ({
        row: Number(match[1]),
        seats: Array.from({ length: seatCount(match[2]) }, (_, index) => index + 1),
      })),
    };
  }

  if (rowNumbers.length) {
    const grid = lines.filter((line) => seatCount(line) > 0);
    const direction = text.match(/^Field direction:\s*(.)/m)?.[1];
    const byRow = new Map(rowNumbers.map((row) => [row, [] as number[]]));
    grid.forEach((line, index) => {
      const count = seatCount(line);
      const seat = direction === "→" ? grid.length - index : index + 1;
      const activeRows = direction === "→" ? rowNumbers.slice(0, count) : rowNumbers.slice(-count);
      for (const row of activeRows) byRow.get(row)?.push(seat);
    });
    return {
      section,
      rows: rowNumbers.map((row) => ({ row, seats: byRow.get(row) ?? [] })).filter((row) => row.seats.length),
    };
  }
  return { section, rows: [] };
}

export interface LabeledSeat {
  section: string; row: number; seat: number;
  x: number; y: number; z: number;
  /** Rotation around Y; the chair's front faces the field/section center. */
  rotationY: number;
}

export function seatmapSeatPositions(tier: Tier, layout: ArcLayout, map: ParsedSeatmap): LabeledSeat[] {
  const innerRadius = tier.innerRadius ?? 0;
  const a0 = layout.startAngle * DEG;
  const a1 = layout.endAngle * DEG;
  const cx = layout.center?.x ?? 0;
  const cz = layout.center?.z ?? 0;
  const firstRow = Math.min(...map.rows.map(({ row }) => row));

  return map.rows.flatMap(({ row, seats }) => {
    const rowIndex = Math.max(0, row - firstRow + (layout.rowStart ?? 0));
    const radius = innerRadius + (rowIndex + 0.5) * tier.rowDepth;
    const y = tier.baseHeight + rowIndex * tier.rowRise;
    return seats.map((seat, index) => {
      const angle = a0 + ((a1 - a0) * (index + 0.5)) / seats.length;
      return {
        section: map.section, row, seat,
        x: cx + radius * Math.cos(angle), y, z: cz + radius * Math.sin(angle),
        rotationY: Math.PI / 2 - angle,
      };
    });
  });
}
