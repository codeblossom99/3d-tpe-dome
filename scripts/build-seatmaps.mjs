// Converts data/venues/taipei-dome/seatmaps/*.seatmap.txt into a single
// bundled JSON the client imports. Run: node scripts/build-seatmaps.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "../data/venues/taipei-dome/seatmaps");

const ROW_RE = /^Row\s+(\d+)\s*:\s*(.*)$/;
const SEAT_RE = /\[(\d+)\]/g;

function parse(text, fallbackSection) {
  let section = fallbackSection;
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^section\s*:\s*(\S+)/i);
    if (h) { section = h[1]; continue; }
    const m = line.match(ROW_RE);
    if (!m) continue;
    const seats = [];
    let s;
    SEAT_RE.lastIndex = 0;
    while ((s = SEAT_RE.exec(m[2]))) seats.push(parseInt(s[1], 10));
    if (seats.length) rows.push({ row: parseInt(m[1], 10), seats });
  }
  return { section, rows };
}

const out = {};
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".seatmap.txt")) continue;
  const fallback = f.replace(/\.seatmap\.txt$/, "");
  const map = parse(readFileSync(join(dir, f), "utf8"), fallback);
  out[map.section] = map;
}

const dest = join(dir, "seatmaps.generated.json");
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
const total = Object.values(out).reduce(
  (n, m) => n + m.rows.reduce((k, r) => k + r.seats.length, 0), 0);
console.log(`Wrote ${dest}: ${Object.keys(out).length} section(s), ${total} seats`);
for (const [id, m] of Object.entries(out)) {
  console.log(`  ${id}: rows ${m.rows.map((r) => r.row).join(",")} — ` +
    m.rows.map((r) => r.seats.length).join("/") + " seats/row");
}
