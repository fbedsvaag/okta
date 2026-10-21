import { DELER, storrelse, type Del, type Plass } from "./klassekart";

/**
 * Klassekartet slik det går ut av appen: utskrift, PDF, PNG og liste
 * (SPEC §4.11, personvern). Bare fornavn og første bokstav i etternavnet.
 * Kjønn, innsats og bilder er ikke med — funksjonene får dem ikke engang.
 */

export type Utelev = { id: string; fornavn: string; etternavn: string };

/** «Tony S.» */
export function kortnavn(e: Pick<Utelev, "fornavn" | "etternavn">): string {
  const forbokstav = e.etternavn.trim().charAt(0);
  return forbokstav ? `${e.fornavn} ${forbokstav.toUpperCase()}.` : e.fornavn;
}

/** Rammen rundt alt som er tegnet i rommet. */
export function romramme(deler: Del[]): {
  x: number;
  y: number;
  b: number;
  h: number;
} {
  if (deler.length === 0) return { x: 0, y: 0, b: 400, h: 300 };
  const x = Math.min(...deler.map((d) => d.x));
  const y = Math.min(...deler.map((d) => d.y));
  const x2 = Math.max(...deler.map((d) => d.x + storrelse(d).b));
  const y2 = Math.max(...deler.map((d) => d.y + storrelse(d).h));
  return { x, y, b: x2 - x, h: y2 - y };
}

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

/**
 * Kartet som SVG: rommet, og navnet på hver plass. Rommet er tegnet med
 * tavla øverst — slik elevene ser det (`fraElevene`). Fra kateteret snus
 * tegningen, så tavla står nederst, bak læreren (21.10).
 */
export function kartSvg({
  tittel,
  deler,
  plasser,
  plass,
  elever,
  fraElevene,
  plassfarger,
}: {
  tittel: string;
  deler: Del[];
  plasser: Plass[];
  /** elev → plassnummer */
  plass: Map<string, number>;
  elever: Utelev[];
  fraElevene: boolean;
  /** gruppefargene på plassene (25.11); aldri innsats */
  plassfarger?: Map<number, string>;
}): string {
  const r = romramme(deler);
  const marg = 30;
  const topp = 50;
  const B = r.b + marg * 2;
  const H = r.h + marg * 2 + topp;
  const snu = (x: number, y: number, b = 0, h = 0) =>
    !fraElevene
      ? { x: r.x + r.b - (x - r.x) - b, y: r.y + r.h - (y - r.y) - h }
      : { x, y };
  const tx = (x: number) => x - r.x + marg;
  const ty = (y: number) => y - r.y + marg + topp;

  const elevPa = new Map<number, Utelev>();
  const navn = new Map(elever.map((e) => [e.id, e]));
  for (const [id, nr] of plass) {
    const e = navn.get(id);
    if (e) elevPa.set(nr, e);
  }

  const ut: string[] = [];
  ut.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" font-family="-apple-system, Helvetica, Arial, sans-serif">`,
    `<rect width="${B}" height="${H}" fill="#fff"/>`,
    `<text x="${marg}" y="34" font-size="18" font-weight="600" fill="#241f33">${esc(tittel)}</text>`,
  );
  for (const d of deler) {
    const { b, h } = storrelse(d);
    const p = snu(d.x, d.y, b, h);
    const x = tx(p.x);
    const y = ty(p.y);
    if (DELER[d.type].plasser.length > 0)
      ut.push(
        `<rect x="${x}" y="${y}" width="${b}" height="${h}" rx="7" fill="#f4f2f9" stroke="#d9d4e8" stroke-width="1.5"/>`,
      );
    else if (d.type === "tavle")
      ut.push(
        `<rect x="${x}" y="${y}" width="${b}" height="${h}" rx="4" fill="#9a90b8"/>`,
        `<text x="${x + b / 2}" y="${y + h / 2 + 4}" font-size="11" text-anchor="middle" fill="#fff" letter-spacing="1">TAVLE</text>`,
      );
    else if (d.type === "kateter")
      ut.push(
        `<rect x="${x}" y="${y}" width="${b}" height="${h}" rx="7" fill="#fff" stroke="#d9d4e8" stroke-width="1.5"/>`,
        `<text x="${x + b / 2}" y="${y + h / 2 + 4}" font-size="12" text-anchor="middle" fill="#9a90b8">Kateter</text>`,
      );
    else if (d.type === "vindu")
      ut.push(
        b > h
          ? `<line x1="${x}" y1="${y + h / 2}" x2="${x + b}" y2="${y + h / 2}" stroke="#c9c2dd" stroke-width="4" stroke-dasharray="12 6"/>`
          : `<line x1="${x + b / 2}" y1="${y}" x2="${x + b / 2}" y2="${y + h}" stroke="#c9c2dd" stroke-width="4" stroke-dasharray="12 6"/>`,
      );
    else
      ut.push(
        `<text x="${x + b / 2}" y="${y + h / 2 + 4}" font-size="11" text-anchor="middle" fill="#9a90b8">Dør</text>`,
      );
  }
  for (const p of plasser) {
    const q = snu(p.x, p.y);
    const e = elevPa.get(p.nr);
    const f = plassfarger?.get(p.nr);
    if (f && /^#[0-9a-f]{6}$/i.test(f))
      ut.push(
        `<rect x="${tx(q.x) - 46}" y="${ty(q.y) - 25}" width="92" height="50" rx="7" fill="${f}" fill-opacity="0.16"/>`,
        `<rect x="${tx(q.x) - 46}" y="${ty(q.y) - 25}" width="4" height="50" rx="2" fill="${f}"/>`,
      );
    ut.push(
      e
        ? `<text x="${tx(q.x)}" y="${ty(q.y) + 5}" font-size="14" font-weight="500" text-anchor="middle" fill="#241f33">${esc(kortnavn(e))}</text>`
        : `<text x="${tx(q.x)}" y="${ty(q.y) + 4}" font-size="11" text-anchor="middle" fill="#c9c2dd">Ledig</text>`,
    );
  }
  ut.push("</svg>");
  return ut.join("");
}

/**
 * «Kopier som liste»: pult for pult, forfra og fra venstre.
 *
 *   Pult 1: Tony S., Meadow S.
 *   Pult 2: Paulie G.
 */
export function kartListe({
  tittel,
  plasser,
  plass,
  elever,
}: {
  tittel: string;
  plasser: Plass[];
  plass: Map<string, number>;
  elever: Utelev[];
}): string {
  const navn = new Map(elever.map((e) => [e.id, e]));
  const paPlass = new Map<number, string>();
  for (const [id, nr] of plass) {
    const e = navn.get(id);
    if (e) paPlass.set(nr, kortnavn(e));
  }
  const pulter: string[][] = [];
  const pultNr = new Map<string, number>();
  for (const p of [...plasser].sort((a, b) => a.nr - b.nr)) {
    if (!pultNr.has(p.pult)) {
      pultNr.set(p.pult, pulter.length);
      pulter.push([]);
    }
    const n = paPlass.get(p.nr);
    if (n) pulter[pultNr.get(p.pult)!].push(n);
  }
  const linjer = pulter
    .map((p, i) => (p.length > 0 ? `Pult ${i + 1}: ${p.join(", ")}` : null))
    .filter(Boolean);
  return [tittel, "", ...linjer].join("\n");
}

/** SVG-en som PNG, i dobbel oppløsning. Kjører bare i nettleseren. */
export async function svgSomPng(svg: string): Promise<Blob> {
  const bilde = new Image();
  bilde.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await bilde.decode();
  const lerret = document.createElement("canvas");
  lerret.width = bilde.width * 2;
  lerret.height = bilde.height * 2;
  const g = lerret.getContext("2d")!;
  g.scale(2, 2);
  g.drawImage(bilde, 0, 0);
  return new Promise((ok, feil) =>
    lerret.toBlob((b) => (b ? ok(b) : feil(new Error("PNG"))), "image/png"),
  );
}
