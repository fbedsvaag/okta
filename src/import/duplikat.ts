/**
 * Duplikatgjenkjenning ved import, SPEC §7.1.
 *
 * Grunnprinsippet: å slå sammen to forskjellige elever er verre enn å splitte
 * én. Slås to sammen, blandes skåringer for to personer, og det oppdages
 * kanskje ikke før i mars. Splittes én, ser man det med en gang. Derfor heller
 * automatikken mot "ny elev" når den er usikker.
 *
 * Ingenting her skriver til databasen. Alt returneres som forslag brukeren
 * kan overstyre i forhåndsvisningen.
 */
import { normalisertNavn, type ParsetLinje } from "./parser";

export type EksisterendeElev = {
  id: string;
  fornavn: string;
  etternavn: string;
  /** Klassenavn i det aktive skoleåret. null = ingen klasse registrert. */
  klasse: string | null;
  /** Fagkoder eleven allerede står i dette skoleåret, til visning. */
  fag: string[];
  /** skolear_fag-id-ene eleven er koblet til, til "allerede importert"-sjekken. */
  skolearFagIder: string[];
};

export type Status =
  /** Ingen match. Opprettes som ny elev. */
  | "ny"
  /** Sikker match i et annet fag. Kobles til faget som importeres. */
  | "samme"
  /** Står allerede i dette faget. Linja hoppes over. */
  | "allerede"
  /** Usikker. Brukeren må avgjøre, og forhåndsvalget er ny elev. */
  | "spor";

export type Grunn =
  | "ulik-klasse"
  | "naer-match"
  | "flere-treff"
  | "annet-fag"
  | "allerede-i-faget"
  /** Eleven finnes med et kortere navn: «Per Person» mot det fulle navnet. */
  | "fullere-navn"
  | "ingen-match";

export type Vurdering = {
  linje: ParsetLinje;
  status: Status;
  grunn: Grunn;
  /** Alltid tilgjengelig i nedtrekkslista, sammen med «Ny elev». */
  kandidater: EksisterendeElev[];
  /** Forhåndsvalget. "ny" eller id-en til en eksisterende elev. */
  valgt: string | "ny";
  /**
   * Satt når importen sier en annen klasse enn den eleven allerede står i.
   * Klassen endres aldri automatisk — brukeren må velge.
   */
  klassekonflikt: { finnesI: string; importenSier: string } | null;
};

export type Importoppsett = {
  /**
   * Faget det importeres til, i det aktive skoleåret. null når lista limes
   * inn uten fag — det vanlige når det er mentorgruppa som legges inn (§7).
   */
  skolearFagId: string | null;
  /** Klassen som er valgt i forhåndsvisningen. Linjas egen klasse vinner. */
  valgtKlasse: string | null;
};

export function vurderImport(
  linjer: ParsetLinje[],
  eksisterende: EksisterendeElev[],
  oppsett: Importoppsett,
): Vurdering[] {
  const indeks = new Map<string, EksisterendeElev[]>();
  for (const e of eksisterende) {
    const n = normalisertNavn(e.fornavn, e.etternavn);
    indeks.set(n, [...(indeks.get(n) ?? []), e]);
  }

  return linjer.map((linje) =>
    vurderLinje(linje, eksisterende, indeks, oppsett),
  );
}

function vurderLinje(
  linje: ParsetLinje,
  alle: EksisterendeElev[],
  indeks: Map<string, EksisterendeElev[]>,
  oppsett: Importoppsett,
): Vurdering {
  const navn = normalisertNavn(linje.fornavn, linje.etternavn);
  const eksakte = indeks.get(navn) ?? [];
  const importKlasse = linje.klasse ?? oppsett.valgtKlasse;

  // Ingen eksakt match, men et kortere navn som er inneholdt i dette —
  // «Per Person» skrevet inn for hånd, «Per Johannes Persaune Person» fra
  // skolens liste. Én slik elev uten klassekonflikt er samme elev; flere,
  // eller ulik klasse, og brukeren må velge.
  if (eksakte.length === 0) {
    const kortere = alle.filter((e) => erFullereNavn(linje, e));
    if (kortere.length === 1) {
      const treff = kortere[0];
      const konflikt =
        treff.klasse && importKlasse && treff.klasse !== importKlasse;
      if (!konflikt) {
        const iFaget =
          oppsett.skolearFagId === null ||
          treff.skolearFagIder.includes(oppsett.skolearFagId);
        return {
          linje,
          status: iFaget ? "allerede" : "samme",
          grunn: "fullere-navn",
          kandidater: [treff],
          valgt: treff.id,
          klassekonflikt: null,
        };
      }
    }
  }

  // Ingen eksakt match: se etter skrivefeil, men foreslå aldri sammenslåing.
  if (eksakte.length === 0) {
    const nære = alle.filter((e) => erNærMatch(linje, e));
    if (nære.length > 0) {
      return {
        linje,
        status: "spor",
        grunn: "naer-match",
        kandidater: nære,
        valgt: "ny",
        klassekonflikt: null,
      };
    }
    return {
      linje,
      status: "ny",
      grunn: "ingen-match",
      kandidater: [],
      valgt: "ny",
      klassekonflikt: null,
    };
  }

  // Flere med samme navn: appen kan ikke vite hvem, så brukeren velger.
  if (eksakte.length > 1) {
    return {
      linje,
      status: "spor",
      grunn: "flere-treff",
      kandidater: eksakte,
      valgt: "ny",
      klassekonflikt: null,
    };
  }

  const treff = eksakte[0];

  // Ulik klasse er det sterkeste signalet om to personer, og slår signalet
  // om at samme navn i et annet fag pleier å være samme elev.
  if (treff.klasse && importKlasse && treff.klasse !== importKlasse) {
    return {
      linje,
      status: "spor",
      grunn: "ulik-klasse",
      kandidater: [treff],
      valgt: "ny",
      klassekonflikt: {
        finnesI: treff.klasse,
        importenSier: importKlasse,
      },
    };
  }

  // Samme liste limt inn i samme fag to ganger: ingenting skal dupliseres
  // og ingenting overskrives. Uten fag finnes ikke den situasjonen — da er
  // det ingen kobling å lage, og linja er allerede dekket.
  if (
    oppsett.skolearFagId === null ||
    treff.skolearFagIder.includes(oppsett.skolearFagId)
  ) {
    return {
      linje,
      status: "allerede",
      grunn: "allerede-i-faget",
      kandidater: [treff],
      valgt: treff.id,
      klassekonflikt: null,
    };
  }

  // Den normale situasjonen: samme elev, nytt fag.
  return {
    linje,
    status: "samme",
    grunn: "annet-fag",
    kandidater: [treff],
    valgt: treff.id,
    klassekonflikt: null,
  };
}

/**
 * Om importnavnet er en fullere utgave av et navn som finnes: alle ordene i
 * det eksisterende navnet står i importnavnet, i samme rekkefølge, og
 * fornavnet er det samme. «Per Person» ⊂ «Per Johannes Persaune Person».
 * Et navn på ett ord er for lite å gå på.
 */
export function erFullereNavn(
  linje: { fornavn: string; etternavn: string },
  e: { fornavn: string; etternavn: string },
): boolean {
  const ord = (s: string) => normaliserteOrd(s).filter((o) => o !== "");
  const ny = ord(`${linje.fornavn} ${linje.etternavn}`);
  const gammel = ord(`${e.fornavn} ${e.etternavn}`);
  if (gammel.length < 2 || ny.length <= gammel.length) return false;
  if (ny[0] !== gammel[0]) return false;
  let i = 0;
  for (const o of ny) if (o === gammel[i]) i++;
  return i === gammel.length;
}

function normaliserteOrd(s: string): string[] {
  return s.toLocaleLowerCase("nb-NO").split(/[\s]+/);
}

/**
 * Nær match er tenkt på skrivefeil og varianter: Cristopher mot Christopher,
 * Silvio Dante mot Silvio Dantè. Den fører aldri til automatisk sammenslåing,
 * bare til at appen spør.
 */
function erNærMatch(linje: ParsetLinje, e: EksisterendeElev): boolean {
  const a = normalisertNavn(linje.fornavn, linje.etternavn);
  const b = normalisertNavn(e.fornavn, e.etternavn);
  if (a === b) return false;

  if (avstand(a, b, 2) <= 2) return true;

  const sammeEtternavn =
    linje.etternavn !== "" &&
    linje.etternavn.toLocaleLowerCase("nb-NO") ===
      e.etternavn.toLocaleLowerCase("nb-NO");
  const sammeForbokstav =
    linje.fornavn !== "" &&
    e.fornavn !== "" &&
    linje.fornavn[0].toLocaleLowerCase("nb-NO") ===
      e.fornavn[0].toLocaleLowerCase("nb-NO");

  return sammeEtternavn && sammeForbokstav;
}

/**
 * Levenshtein-avstand, med tak. Vi trenger bare å vite om den er ≤ 2, så
 * beregningen avbrytes så snart den har passert taket.
 */
export function avstand(a: string, b: string, tak = Infinity): number {
  if (Math.abs(a.length - b.length) > tak) return tak + 1;

  let forrige = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const denne = [i];
    let minst = i;
    for (let j = 1; j <= b.length; j++) {
      const kost = a[i - 1] === b[j - 1] ? 0 : 1;
      denne[j] = Math.min(
        forrige[j] + 1, // sletting
        denne[j - 1] + 1, // innsetting
        forrige[j - 1] + kost, // bytte
      );
      minst = Math.min(minst, denne[j]);
    }
    if (minst > tak) return tak + 1;
    forrige = denne;
  }

  return forrige[b.length];
}
