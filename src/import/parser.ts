/**
 * Navneparser for lim-inn av klasselister, SPEC §7.
 *
 * Samme parser brukes av den manuelle innleggingen i §4.3, slik at
 * "La Cerva, Adriana" og "Adriana La Cerva" gir nøyaktig samme resultat.
 *
 * Parseren gjetter aldri på store og små bokstaver. DeTrolio, DiMeo og
 * McDuck skrives inn slik de står.
 */

export type ParsetLinje = {
  /** 1-indeksert linjenummer i teksten som ble limt inn */
  linjenr: number;
  /** Linja slik den så ut, til bruk i forhåndsvisningen */
  original: string;
  fornavn: string;
  etternavn: string;
  /** Klasse oppgitt på linja, f.eks. "Anna Reistad;1STC". Ellers null. */
  klasse: string | null;
};

export type HoppetOver = {
  linjenr: number;
  original: string;
  grunn: "tom" | "overskrift";
};

export type Parseresultat = {
  elever: ParsetLinje[];
  hoppetOver: HoppetOver[];
};

/**
 * Partikler som hører sammen med ordet etter seg. Uten denne lista blir
 * "Adriana La Cerva" til etternavn "Cerva", som er feil person.
 *
 * Sammenlikningen er ufølsom for store og små bokstaver, men skrivemåten
 * i lista beholdes som brukeren skrev den.
 */
const PARTIKLER = new Set([
  "la",
  "le",
  "de",
  "di",
  "da",
  "del",
  "della",
  "van",
  "von",
  "mc",
  "mac",
  "o'",
]);

/** Markdown-listemarkør (-, *, +) eller nummerering (1. / 1)) */
const LISTEMARKOR = /^\s*(?:[-*+]|\d+[.)])\s+/;

/** Overskriftslinje: en eller flere # etterfulgt av mellomrom */
const OVERSKRIFT = /^\s*#{1,6}\s/;

/**
 * Semikolon skiller navn fra klasse: "Anna Reistad;1STC".
 *
 * Tab er tvetydig, fordi §7 både lister "Anna⇥Reistad" som navneformat og
 * sier at tab skiller felter. Vi løser det slik: et tab-felt som inneholder
 * et siffer er en klasse, alt annet hører til navnet. Klassenavn i norsk
 * videregående har et trinnsiffer, elevnavn har ikke siffer i seg.
 */
const SEMIKOLON = /;/;
const TAB = /\t/;
const HAR_SIFFER = /\d/;

export function parseListe(tekst: string): Parseresultat {
  const elever: ParsetLinje[] = [];
  const hoppetOver: HoppetOver[] = [];

  tekst.split(/\r?\n/).forEach((rå, i) => {
    const linjenr = i + 1;
    const linje = rå.trim();

    if (linje === "") {
      // Tomme linjer nevnes ikke i forhåndsvisningen — de er bare luft.
      return;
    }
    if (OVERSKRIFT.test(linje)) {
      hoppetOver.push({ linjenr, original: rå, grunn: "overskrift" });
      return;
    }

    const utenMarkor = linje.replace(LISTEMARKOR, "");
    if (utenMarkor.trim() === "") {
      hoppetOver.push({ linjenr, original: rå, grunn: "tom" });
      return;
    }

    const { navnefelt, klasse } = delFelter(utenMarkor);

    if (navnefelt === "") {
      hoppetOver.push({ linjenr, original: rå, grunn: "tom" });
      return;
    }

    const { fornavn, etternavn } = delNavn(navnefelt);
    elever.push({ linjenr, original: rå, fornavn, etternavn, klasse });
  });

  return { elever, hoppetOver };
}

/**
 * Skiller navnedelen fra en eventuell klasse.
 *
 *   "Anna Reistad;1STC"  -> navn "Anna Reistad", klasse "1STC"
 *   "Anna\tReistad"      -> navn "Anna Reistad", ingen klasse
 *   "Anna\tReistad\t1STC" -> navn "Anna Reistad", klasse "1STC"
 */
function delFelter(linje: string): {
  navnefelt: string;
  klasse: string | null;
} {
  let klasse: string | null = null;
  let rest = linje;

  const semi = rest.split(SEMIKOLON).map((f) => f.trim());
  if (semi.length > 1) {
    rest = semi[0];
    klasse = semi.slice(1).find((f) => f !== "") ?? null;
  }

  const navnedeler: string[] = [];
  for (const felt of rest.split(TAB).map((f) => f.trim())) {
    if (felt === "") continue;
    if (HAR_SIFFER.test(felt)) {
      klasse ??= felt;
    } else {
      navnedeler.push(felt);
    }
  }

  return { navnefelt: navnedeler.join(" "), klasse };
}

/**
 * Deler et navnefelt i fornavn og etternavn.
 *
 *   "Reistad, Anna"      -> Anna / Reistad          (komma = Etternavn, Fornavn)
 *   "Adriana La Cerva"   -> Adriana / La Cerva      (partikkel slås sammen)
 *   "Anna Reistad"       -> Anna / Reistad          (siste ord er etternavn)
 *   "Madonna"            -> Madonna / ""            (ingenting å dele på)
 */
export function delNavn(navnefelt: string): {
  fornavn: string;
  etternavn: string;
} {
  const felt = normaliserMellomrom(navnefelt);

  const komma = felt.indexOf(",");
  if (komma !== -1) {
    const etternavn = felt.slice(0, komma).trim();
    const fornavn = felt.slice(komma + 1).trim();
    // "Soprano," uten fornavn er ikke et etternavn — da er det bare et navn.
    if (fornavn === "") return { fornavn: etternavn, etternavn: "" };
    return { fornavn, etternavn };
  }

  const ord = felt.split(" ").filter((o) => o !== "");
  if (ord.length <= 1) return { fornavn: felt, etternavn: "" };

  // Start på siste ord og trekk partikler inn i etternavnet så lenge det
  // blir minst ett ord igjen til fornavn.
  let start = ord.length - 1;
  while (start - 1 >= 1 && erPartikkel(ord[start - 1])) start--;

  return {
    fornavn: ord.slice(0, start).join(" "),
    etternavn: ord.slice(start).join(" "),
  };
}

function erPartikkel(ord: string): boolean {
  return PARTIKLER.has(ord.toLocaleLowerCase("nb-NO"));
}

function normaliserMellomrom(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Navn på formen appen sammenlikner på ved duplikatsjekk (§7.1):
 * trimmet, sammenslåtte mellomrom, ufølsom for store og små bokstaver.
 * Brukes aldri til lagring — der beholdes original skrivemåte.
 */
export function normalisertNavn(fornavn: string, etternavn: string): string {
  return normaliserMellomrom(`${fornavn} ${etternavn}`).toLocaleLowerCase(
    "nb-NO",
  );
}
