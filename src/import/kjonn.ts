import fornavn from "../data/fornavn.json";

/**
 * Gjetter kjønn fra fornavnet ved import (ARBEIDSLISTE 9.8, SPEC §4.11).
 *
 * Navnelista er SSBs navnestatistikk (CC BY 4.0), hentet med
 * `scripts/hent_navn.py` og lagt i appen som en fil: fornavn → andel
 * jenter. Ingenting sendes ut. Er minst 95 % av dem som heter noe av samme
 * kjønn, er det en gjetning; ellers står det tomt, og læreren velger.
 *
 * «Anne-Marie» og «Anne Marie» slås opp hele først, så på første ledd.
 */
const ANDEL: Record<string, number> = fornavn;

export const GRENSE = 0.95;

export function gjettKjonn(navn: string): "j" | "g" | null {
  const rent = navn.trim().toLowerCase();
  if (!rent) return null;
  const forsok = [
    rent,
    rent.replace(/-/g, " "),
    rent.replace(/ /g, "-"),
    rent.split(/[\s-]+/)[0],
  ];
  for (const n of forsok) {
    const a = ANDEL[n];
    if (a === undefined) continue;
    if (a >= GRENSE) return "j";
    if (a <= 1 - GRENSE) return "g";
    return null;
  }
  return null;
}

/** Kjønnet i forhåndsvisningen: verdien, og om læreren har bekreftet den. */
export type Kjonnsvalg = { k: "j" | "g" | null; bekreftet: boolean };

/** Klikk bytter Jente → Gutt → Ikke satt (og fra «Velg» til Jente). */
export function nesteKjonn(v: Kjonnsvalg): Kjonnsvalg {
  const neste = v.k === null ? "j" : v.k === "j" ? "g" : null;
  return { k: neste, bekreftet: neste !== null };
}
