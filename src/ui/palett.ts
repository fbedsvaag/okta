import { hentInnstilling, settInnstilling } from "../data/skolear";

/**
 * Fargepaletten (DESIGN.md §4).
 *
 * En palett bytter bare aksenten, valgt-fargen og grunnen (og dermed
 * fargeteppet, som bygger på dem). Blekk, linjer, trafikklys og fagfarger
 * er like i alle. Som temaet og glasset: valget lagres i `innstilling`, en
 * kopi ligger i localStorage til første tegning, og fargene står i
 * index.css under `:root[data-palett="…"]`.
 */

export const PALETTER = [
  {
    id: "fiolett",
    navn: "Fiolett",
    aksent: "#4a3d7d",
    valgt: "#e3ddf0",
    bord: "#eceaf1",
  },
  {
    id: "skifer",
    navn: "Skifer",
    aksent: "#3d5a80",
    valgt: "#dde5f0",
    bord: "#e8ecf2",
  },
  {
    id: "mose",
    navn: "Mose",
    aksent: "#4d6b3c",
    valgt: "#e1ead8",
    bord: "#eaede5",
  },
  {
    id: "rust",
    navn: "Rust",
    aksent: "#8a4a2a",
    valgt: "#f0e0d6",
    bord: "#f1ebe6",
  },
  {
    id: "fjord",
    navn: "Fjord",
    aksent: "#2f6b6b",
    valgt: "#d8ebe9",
    bord: "#e6eeed",
  },
  {
    id: "grafitt",
    navn: "Grafitt",
    aksent: "#3a3a40",
    valgt: "#e2e2e6",
    bord: "#ececee",
  },
] as const;

export type Palett = (typeof PALETTER)[number]["id"];

export const PALETT = "palett";
const KOPI = "okta-palett";

function gyldig(v: string | null): Palett {
  return PALETTER.some((p) => p.id === v) ? (v as Palett) : "fiolett";
}

export function settPalett(palett: Palett): void {
  document.documentElement.dataset.palett = palett;
  try {
    localStorage.setItem(KOPI, palett);
  } catch {
    // Uten localStorage blinker det bare litt ved oppstart.
  }
}

/** Før første tegning: kopien i localStorage, uten å vente på basen. */
export function palettFraKopi(): void {
  let v: string | null = null;
  try {
    v = localStorage.getItem(KOPI);
  } catch {
    // Standard: fiolett.
  }
  settPalett(gyldig(v));
}

/** Ved oppstart, når basen er lastet: valget som faktisk er lagret. */
export async function brukPalett(): Promise<Palett> {
  const palett = gyldig(await hentInnstilling(PALETT));
  settPalett(palett);
  return palett;
}

export async function lagrePalett(palett: Palett): Promise<void> {
  settPalett(palett);
  await settInnstilling(PALETT, palett);
}
