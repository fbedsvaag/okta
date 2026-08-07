import {
  finnEllerOpprettKlasse,
  koblePaFag,
  opprettElev,
  settKlasse,
} from "../data/elever";
import type { Vurdering } from "./duplikat";

/**
 * Én linje i forhåndsvisningen, med brukerens valg lagt oppå appens forslag.
 * Ingenting skrives til databasen før importen bekreftes (SPEC §7).
 */
export type Importrad = Vurdering & {
  /** "ny" eller id-en til en eksisterende elev. Kan overstyres av brukeren. */
  valgt: string | "ny";
  /** Klassen linja havner i. Tom streng betyr ingen klasse. */
  klasse: string;
  /** Bytt klassen til en eksisterende elev. Av som standard — klassen røres ikke. */
  byttKlasse: boolean;
  /** Hopp over linja helt. */
  hopp: boolean;
};

export type Resultat = {
  opprettet: number;
  koblet: number;
  hoppet: number;
  klasseByttet: number;
};

export async function utforImport(
  rader: Importrad[],
  skolearId: string,
  skolearFagId: string,
): Promise<Resultat> {
  const resultat: Resultat = {
    opprettet: 0,
    koblet: 0,
    hoppet: 0,
    klasseByttet: 0,
  };

  // Klasser opprettes én gang hver, ikke én gang per elev.
  const klasseIder = new Map<string, string>();
  const klasseId = async (navn: string) => {
    const funnet = klasseIder.get(navn);
    if (funnet) return funnet;
    const id = await finnEllerOpprettKlasse(skolearId, navn);
    klasseIder.set(navn, id);
    return id;
  };

  for (const rad of rader) {
    if (rad.hopp || rad.status === "allerede") {
      resultat.hoppet++;
      continue;
    }

    if (rad.valgt === "ny") {
      const elevId = await opprettElev(rad.linje.fornavn, rad.linje.etternavn);
      if (rad.klasse.trim() !== "") {
        await settKlasse(elevId, skolearId, await klasseId(rad.klasse.trim()));
      }
      await koblePaFag(elevId, skolearFagId);
      resultat.opprettet++;
      continue;
    }

    // "Samme elev" legger til fag, ikke klasse. Klassen byttes bare hvis
    // brukeren uttrykkelig har sagt det (§7.1).
    await koblePaFag(rad.valgt, skolearFagId);
    resultat.koblet++;

    if (rad.byttKlasse && rad.klasse.trim() !== "") {
      await settKlasse(rad.valgt, skolearId, await klasseId(rad.klasse.trim()));
      resultat.klasseByttet++;
    }
  }

  return resultat;
}

/** Startverdiene for forhåndsvisningen, før brukeren har rørt noe. */
export function tilImportrader(
  vurderinger: Vurdering[],
  valgtKlasse: string,
): Importrad[] {
  return vurderinger.map((v) => ({
    ...v,
    klasse: v.linje.klasse ?? valgtKlasse,
    byttKlasse: false,
    hopp: false,
  }));
}
