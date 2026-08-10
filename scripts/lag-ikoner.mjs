/**
 * Tegner appikonet til PNG, uten avhengigheter.
 *
 * Logoen er bare avrundede rektangler, så den kan tegnes direkte i stedet for
 * å gå veien om en SVG-renderer. Det holder verktøykjeden tom — appen har
 * ingen byggeavhengighet utover Node, og det skal den fortsette å ha.
 *
 * Kantutjevningen kommer av en fortegnsdistanse per piksel: hvor langt inn
 * eller ut av formen pikselsenteret ligger. Det gir én piksel myk kant uten
 * å tegne i firedobbel oppløsning først.
 *
 *   node scripts/lag-ikoner.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

// ------------------------------------------------------------------ tegning

/** Avstand fra punkt til kanten av et avrundet rektangel. Negativ = innenfor. */
function avstand(px, py, x, y, w, h, r) {
  const dx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const dy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  const ut = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return ut + Math.min(Math.max(dx, dy), 0) - r;
}

function hex(s) {
  return [
    parseInt(s.slice(1, 3), 16),
    parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16),
  ];
}

/**
 * Tegner ett rektangel oppå det som ligger der fra før.
 *
 * `skala` lar de samme koordinatene brukes for alle størrelser — formene er
 * definert på et 1024-lerret og regnes om her.
 */
function tegn(buf, side, form, farge, skala) {
  const [r, g, b] = hex(farge);
  const { x, y, w, h, rx } = form;
  for (let py = 0; py < side; py++) {
    for (let px = 0; px < side; px++) {
      const d = avstand(
        (px + 0.5) / skala,
        (py + 0.5) / skala,
        x, y, w, h, rx,
      );
      const dekning = Math.min(Math.max(0.5 - d * skala, 0), 1);
      if (dekning <= 0) continue;

      const i = (py * side + px) * 4;
      const a = buf[i + 3] / 255;
      const ny = dekning + a * (1 - dekning);
      // Over-operatoren med forhåndsmultiplisering, så myke kanter mot
      // gjennomsiktig bakgrunn ikke får mørk rand.
      buf[i] = (r * dekning + buf[i] * a * (1 - dekning)) / ny;
      buf[i + 1] = (g * dekning + buf[i + 1] * a * (1 - dekning)) / ny;
      buf[i + 2] = (b * dekning + buf[i + 2] * a * (1 - dekning)) / ny;
      buf[i + 3] = Math.round(ny * 255);
    }
  }
}

// -------------------------------------------------------------------- PNG

function png(buf, side) {
  const rader = Buffer.alloc((side * 4 + 1) * side);
  for (let y = 0; y < side; y++) {
    rader[y * (side * 4 + 1)] = 0; // filtertype: ingen
    buf.copy(rader, y * (side * 4 + 1) + 1, y * side * 4, (y + 1) * side * 4);
  }

  const bit = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const kropp = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(kropp) >>> 0);
    return Buffer.concat([len, kropp, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(side, 0);
  ihdr.writeUInt32BE(side, 4);
  ihdr[8] = 8; // bitdybde
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bit("IHDR", ihdr),
    bit("IDAT", deflateSync(rader, { level: 9 })),
    bit("IEND", Buffer.alloc(0)),
  ]);
}

const TABELL = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(b) {
  let c = 0xffffffff;
  for (const v of b) c = TABELL[(c ^ v) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

// ----------------------------------------------------------------- former

const PLATE = { x: 100, y: 100, w: 824, h: 824, rx: 185 };

/** Merket slik det er: tre felt som avtar i bredde og styrke. */
export const FULL = [
  { x: 308, y: 342, w: 180, h: 340, rx: 24 },
  { x: 512, y: 342, w: 90, h: 340, rx: 24 },
  { x: 626, y: 342, w: 90, h: 340, rx: 24 },
];

/**
 * Forenklet merke til 16 og 32 piksler.
 *
 * På 16 px blir de to smale feltene under to piksler brede og går i grøten.
 * To felt i forholdet 2:1 beholder avtakingen som er hele poenget med merket,
 * og overlever nedskaleringen. Fargene er felt 1 og felt 3 — ytterpunktene,
 * så kontrasten holder.
 */
export const ENKEL = [
  { x: 308, y: 342, w: 240, h: 340, rx: 28 },
  { x: 596, y: 342, w: 120, h: 340, rx: 28 },
];

export const MORK = { plate: "#241F33", felt: ["#EEEDFE", "#C9C2DD", "#9A90B8"] };

export function lag(side, former, farger) {
  const buf = Buffer.alloc(side * side * 4);
  const skala = side / 1024;
  tegn(buf, side, PLATE, farger.plate, skala);
  former.forEach((f, i) => tegn(buf, side, f, farger.felt[i], skala));
  return png(buf, side);
}

// ------------------------------------------------------------------- kjør

if (import.meta.url === `file://${process.argv[1]}`) {
const ut = process.argv[2] ?? "src-tauri/icons/kilde";
mkdirSync(ut, { recursive: true });

writeFileSync(`${ut}/okta-1024.png`, lag(1024, FULL, MORK));
console.log(`${ut}/okta-1024.png`);

// Små størrelser med det forenklede merket. 16@2x er 32 px, men skal ha
// samme forenkling — den vises der 16 px vises, bare skarpere.
for (const side of [16, 32, 64]) {
  const farger = { plate: MORK.plate, felt: [MORK.felt[0], MORK.felt[2]] };
  writeFileSync(`${ut}/enkel-${side}.png`, lag(side, ENKEL, farger));
  console.log(`${ut}/enkel-${side}.png`);
}
}
