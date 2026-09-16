// Bundle every Taipei Dome ASCII map into JSON imported by the client.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../data/venues/taipei-dome/seatmaps");
const countSeats = (value) => [...value.matchAll(/\[(?:■|\d+)\]/g)].length;
const numbers = (value) => [...value.matchAll(/\d+/g)].map((match) => Number(match[0]));

function sectionId(path) {
  const name = basename(path, extname(path));
  const id = name.match(/(\d{3})區/)?.[1] ?? name;
  return /前排/.test(name) ? `${id}f` : /後排/.test(name) ? `${id}b` : id;
}

function parse(text, section) {
  const lines = text.split(/\r?\n/);
  const legacy = lines.flatMap((line) => {
    const match = line.match(/^Row\s+(\d+)\s*:\s*(.*)$/);
    if (!match) return [];
    const seats = [...match[2].matchAll(/\[(\d+)\]/g)].map((seat) => Number(seat[1]));
    return seats.length ? [{ row: Number(match[1]), seats }] : [];
  });
  if (legacy.length) return { section, rows: legacy };

  const header = lines.find((line) => /^Row(?::|\s+\d)/.test(line));
  const rowNumbers = header ? numbers(header) : [];
  const matrix = lines.flatMap((line) => {
    const match = line.match(/^(\d+)\s*:\s*(.*)$/);
    return match && countSeats(match[2]) ? [match] : [];
  });

  if (rowNumbers.length && matrix.length) {
    const byRow = new Map(rowNumbers.map((row) => [row, []]));
    const direction = text.match(/^Field direction:\s*(.)/m)?.[1];
    for (const line of matrix) {
      const count = countSeats(line[2]);
      const active = direction === "→" ? rowNumbers.slice(0, count) : rowNumbers.slice(-count);
      for (const row of active) byRow.get(row).push(Number(line[1]));
    }
    return { section, rows: rowNumbers.map((row) => ({ row, seats: byRow.get(row) })).filter((row) => row.seats.length) };
  }

  if (matrix.length) {
    return { section, rows: matrix.map((line) => ({
      row: Number(line[1]),
      seats: Array.from({ length: countSeats(line[2]) }, (_, index) => index + 1),
    })) };
  }

  const grid = lines.filter((line) => countSeats(line));
  const direction = text.match(/^Field direction:\s*(.)/m)?.[1];
  const byRow = new Map(rowNumbers.map((row) => [row, []]));
  grid.forEach((line, index) => {
    const count = countSeats(line);
    const seat = direction === "→" ? grid.length - index : index + 1;
    const active = direction === "→" ? rowNumbers.slice(0, count) : rowNumbers.slice(-count);
    for (const row of active) byRow.get(row).push(seat);
  });
  return { section, rows: rowNumbers.map((row) => ({ row, seats: byRow.get(row) })).filter((row) => row.seats.length) };
}

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : entry.name.endsWith(".txt") ? [path] : [];
  });
}

const out = Object.fromEntries(files(root).map((path) => {
  const id = sectionId(path);
  return [id, parse(readFileSync(path, "utf8"), id)];
}));
const destination = join(root, "seatmaps.generated.json");
writeFileSync(destination, `${JSON.stringify(out, null, 2)}\n`);
const total = Object.values(out).reduce((sum, map) => sum + map.rows.reduce((n, row) => n + row.seats.length, 0), 0);
console.log(`Wrote ${Object.keys(out).length} sections and ${total} seats to ${destination}`);
