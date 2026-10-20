import {
  endreElev,
  finnEllerOpprettKlasse,
  koblePaFag,
  opprettElev,
  settKlasse,
  settMentor,
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
  /**
   * Gi en eksisterende elev navnet fra lista. På som standard når lista
   * har det fulle navnet og basen et kortere (§7.1, «fullere-navn»).
   */
  byttNavn: boolean;
};

export type Resultat = {
  /** eleven hver linje ble til, etter linjenummer — til elevbildene */
  elevIder: Map<number, string>;
  opprettet: number;
  koblet: number;
  hoppet: number;
  klasseByttet: number;
  /** eksisterende elever som fikk navnet fra lista */
  navnByttet: number;
};

/**
 * Skriver importen til databasen.
 *
 * `skolearFagId` kan være null: da opprettes elevene og plasseres i klassen,
 * men ingen fagkobling lages. Det er slik mentorgruppa legges inn — du er
 * mentor for elever du ikke underviser (§7).
 */
export async function utforImport(
  rader: Importrad[],
  skolearId: string,
  skolearFagId: string | null,
  /** Merk de importerte som mentorelever i dette året. */
  somMentor = false,
): Promise<Resultat> {
  const resultat: Resultat = {
    elevIder: new Map(),
    opprettet: 0,
    koblet: 0,
    hoppet: 0,
    klasseByttet: 0,
    navnByttet: 0,
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
      // Står eleven i faget allerede, er hen likevel eleven på linja.
      if (!rad.hopp && rad.valgt !== "ny") {
        resultat.elevIder.set(rad.linje.linjenr, rad.valgt);
        if (rad.byttNavn && (await giNavn(rad))) resultat.navnByttet++;
      }
      resultat.hoppet++;
      continue;
    }

    if (rad.valgt === "ny") {
      const elevId = await opprettElev(rad.linje.fornavn, rad.linje.etternavn);
      if (rad.klasse.trim() !== "") {
        await settKlasse(elevId, skolearId, await klasseId(rad.klasse.trim()));
        if (somMentor) await settMentor(elevId, skolearId, true);
      }
      if (skolearFagId) await koblePaFag(elevId, skolearFagId);
      resultat.elevIder.set(rad.linje.linjenr, elevId);
      resultat.opprettet++;
      continue;
    }

    // "Samme elev" legger til fag, ikke klasse. Klassen byttes bare hvis
    // brukeren uttrykkelig har sagt det (§7.1).
    if (skolearFagId) await koblePaFag(rad.valgt, skolearFagId);
    resultat.elevIder.set(rad.linje.linjenr, rad.valgt);
    if (rad.byttNavn && (await giNavn(rad))) resultat.navnByttet++;
    resultat.koblet++;

    if (rad.byttKlasse && rad.klasse.trim() !== "") {
      await settKlasse(rad.valgt, skolearId, await klasseId(rad.klasse.trim()));
      resultat.klasseByttet++;
    }
    if (somMentor) await settMentor(rad.valgt, skolearId, true);
  }

  return resultat;
}

/**
 * Elevene i faget som ikke står på lista — de som tas ut når lista er hele
 * faget. En linje som hoppes over, teller ikke som «står på lista».
 */
export function ikkePaLista(rader: Importrad[], medlemmer: string[]): string[] {
  const pa = new Set(
    rader.filter((r) => !r.hopp && r.valgt !== "ny").map((r) => r.valgt),
  );
  return medlemmer.filter((id) => !pa.has(id));
}

/** Navnet fra lista på den eksisterende eleven linja er koblet til. */
async function giNavn(rad: Importrad): Promise<boolean> {
  if (rad.valgt === "ny") return false;
  await endreElev(rad.valgt, {
    fornavn: rad.linje.fornavn,
    etternavn: rad.linje.etternavn,
  });
  return true;
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
    byttNavn: v.grunn === "fullere-navn",
  }));
}
