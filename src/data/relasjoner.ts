import {
  hentKart,
  hentKildeElever,
  hentOppsett,
  hentRom,
  plasserIRom,
  type Oppsett,
} from "./klassekart";
import { makkere } from "./fordeling";
import { hentOnsker, type Onske } from "./onsker";

/**
 * Klassen som relasjonskart (ARBEIDSLISTE 26.9–26.10): hvem som har vært i
 * gruppe og sittet sammen i faget, og hvem som ønsker seg til hvem. Bare
 * for læreren: ingen modul som skriver ut av appen, leser denne filen.
 */

export type Klasseelev = { id: string; fornavn: string; etternavn: string };
export type Band = { a: string; b: string; grupper: number; sidemann: number };

export type Klassen = {
  elever: Klasseelev[];
  band: Band[];
  /** ønskene der begge er i faget */
  onsker: Onske[];
};

export const parNokkel = (a: string, b: string) =>
  a < b ? `${a}|${b}` : `${b}|${a}`;

/** Båndene fra historikken: samme gruppe, eller makkere i en plassering. */
export function bandFra(
  oppsett: { type: "gruppe" | "plass"; o: Oppsett; makkerpar: Set<string> }[],
): Band[] {
  const ut = new Map<string, Band>();
  const legg = (a: string, b: string, felt: "grupper" | "sidemann") => {
    const k = parNokkel(a, b);
    const band = ut.get(k) ?? {
      a: a < b ? a : b,
      b: a < b ? b : a,
      grupper: 0,
      sidemann: 0,
    };
    band[felt]++;
    ut.set(k, band);
  };
  for (const { type, o, makkerpar } of oppsett) {
    const r = o.rader;
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++) {
        const x = r[i];
        const y = r[j];
        if (type === "gruppe" && x.gruppe !== null && x.gruppe === y.gruppe)
          legg(x.elevId, y.elevId, "grupper");
        if (
          type === "plass" &&
          x.plass &&
          y.plass &&
          (makkerpar.has(`${x.plass}|${y.plass}`) ||
            makkerpar.has(`${y.plass}|${x.plass}`))
        )
          legg(x.elevId, y.elevId, "sidemann");
      }
  }
  return [...ut.values()];
}

export async function hentKlassen(
  skolearId: string,
  skolearFagId: string,
): Promise<Klassen> {
  const [elever, kartene, rommene, onsker] = await Promise.all([
    hentKildeElever("fag", skolearFagId, skolearId),
    hentKart(skolearId, true),
    hentRom(),
    hentOnsker(),
  ]);
  const oppsett: Parameters<typeof bandFra>[0] = [];
  for (const k of kartene) {
    if (k.kildeType !== "fag" || k.kildeId !== skolearFagId) continue;
    const rom = rommene.find((r) => r.id === k.romId);
    const makkerpar = new Set(
      makkere(plasserIRom(rom?.deler ?? [])).map(([a, b]) => `${a}|${b}`),
    );
    for (const o of await hentOppsett(k.id, "gruppe"))
      oppsett.push({ type: "gruppe", o, makkerpar });
    for (const o of await hentOppsett(k.id, "plass"))
      oppsett.push({ type: "plass", o, makkerpar });
  }
  const her = new Set(elever.map((e) => e.id));
  return {
    elever: elever.map((e) => ({
      id: e.id,
      fornavn: e.fornavn,
      etternavn: e.etternavn,
    })),
    band: bandFra(oppsett).filter((b) => her.has(b.a) && her.has(b.b)),
    onsker: onsker.filter((o) => her.has(o.elevId) && her.has(o.onskerElevId)),
  };
}

/** Panelet ved kartet (26.10). Regner alltid på all historikk. */
export function panel(k: Klassen) {
  const sammen = new Map(k.band.map((b) => [parNokkel(b.a, b.b), b]));
  const har = (a: string, b: string) => sammen.has(parNokkel(a, b));
  const gjensidige: [string, string][] = [];
  const sett = new Set<string>();
  for (const o of k.onsker) {
    const motsatt = k.onsker.some(
      (x) => x.elevId === o.onskerElevId && x.onskerElevId === o.elevId,
    );
    const nk = parNokkel(o.elevId, o.onskerElevId);
    if (motsatt && !sett.has(nk)) {
      sett.add(nk);
      gjensidige.push([o.elevId, o.onskerElevId]);
    }
  }
  // Et gjensidig ønske står én gang.
  const settUo = new Set<string>();
  const ikkeOppfylt = k.onsker
    .filter((o) => !har(o.elevId, o.onskerElevId))
    .filter((o) => {
      const nk = parNokkel(o.elevId, o.onskerElevId);
      if (settUo.has(nk)) return false;
      settUo.add(nk);
      return true;
    })
    .map((o) => [o.elevId, o.onskerElevId] as [string, string]);
  const antall = new Map(k.elever.map((e) => [e.id, 0]));
  for (const b of k.band) {
    antall.set(b.a, (antall.get(b.a) ?? 0) + 1);
    antall.set(b.b, (antall.get(b.b) ?? 0) + 1);
  }
  const ferrest = [...k.elever]
    .sort(
      (a, b) =>
        (antall.get(a.id) ?? 0) - (antall.get(b.id) ?? 0) ||
        a.fornavn.localeCompare(b.fornavn, "nb-NO"),
    )
    .slice(0, 5)
    .map((e) => ({ id: e.id, antall: antall.get(e.id) ?? 0 }));
  const nevnt = new Set(
    k.onsker.filter((o) => o.kilde === "samtale").map((o) => o.elevId),
  );
  const ikkeNevnt = k.elever.filter((e) => !nevnt.has(e.id)).map((e) => e.id);
  return { gjensidige, ikkeOppfylt, ferrest, ikkeNevnt };
}

// ---------------------------------------------------------- simulering

export type Krefter = {
  spredning: number;
  stivhet: number;
  lengde: number;
  midt: number;
};

export const STANDARDKREFTER: Krefter = {
  spredning: 9000,
  stivhet: 8,
  lengde: 200,
  midt: 1,
};

export type Punkt = { x: number; y: number; vx: number; vy: number };

/**
 * Ett steg i kraftsimuleringen: frastøtning mellom alle, fjær langs
 * båndene og svak tyngde mot midten. Høy demping, så den aldri spretter.
 * `alfa` er varmen; den synker til simuleringen er i ro. `fast`: noden
 * som dras, står stille. Gir den nye varmen.
 */
export function steg(
  p: Punkt[],
  fjaer: { a: number; b: number; vekt: number }[],
  k: Krefter,
  alfa: number,
  fast = -1,
): number {
  const n = p.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const dx = p[j].x - p[i].x;
      const dy = p[j].y - p[i].y;
      const d2 = dx * dx + dy * dy || 1;
      const d = Math.sqrt(d2);
      const f = (-k.spredning / d2) * alfa;
      p[i].vx += (dx / d) * f;
      p[i].vy += (dy / d) * f;
      p[j].vx -= (dx / d) * f;
      p[j].vy -= (dy / d) * f;
    }
  for (const e of fjaer) {
    const s = p[e.a];
    const t = p[e.b];
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    const L = k.lengde / (1 + 0.2 * e.vekt);
    const f = ((d - L) / d) * (k.stivhet / 1000) * Math.min(e.vekt, 4) * alfa;
    s.vx += dx * f;
    s.vy += dy * f;
    t.vx -= dx * f;
    t.vy -= dy * f;
  }
  for (let i = 0; i < n; i++) {
    p[i].vx -= p[i].x * 0.006 * k.midt * alfa;
    p[i].vy -= p[i].y * 0.008 * k.midt * alfa;
    if (i === fast) {
      p[i].vx = p[i].vy = 0;
      continue;
    }
    p[i].vx *= 0.6;
    p[i].vy *= 0.6;
    p[i].x += p[i].vx;
    p[i].y += p[i].vy;
  }
  return fast >= 0 ? Math.max(alfa, 0.3) : alfa * 0.985;
}

/** Startplassering: i ring, så simuleringen kjøres ferdig på forhånd. */
export function startplass(
  n: number,
  fjaer: { a: number; b: number; vekt: number }[],
  k: Krefter,
): Punkt[] {
  const p: Punkt[] = Array.from({ length: n }, (_, i) => {
    const v = (i / Math.max(1, n)) * Math.PI * 2;
    return { x: Math.cos(v) * 220, y: Math.sin(v) * 200, vx: 0, vy: 0 };
  });
  let alfa = 1;
  for (let i = 0; i < 400 && alfa > 0.004; i++) alfa = steg(p, fjaer, k, alfa);
  for (const q of p) q.vx = q.vy = 0;
  return p;
}
