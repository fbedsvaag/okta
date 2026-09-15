/**
 * Kalenderregning: røde dager og serieopprettelse av økter.
 *
 * Alt her er ren utregning uten nettverk. De bevegelige helligdagene følger
 * påsken, så de treffer riktig hvert år uten en liste noen må vedlikeholde.
 */

export type Fridag = {
  id: string;
  skolearId: string;
  navn: string;
  type: "ferie" | "planlegging" | "annet" | "hendelse";
  fra: string;
  til: string;
};

export type Roddag = { dato: string; navn: string };

/** Grunnen til at en dato ikke ble en økt. */
export type Hoppgrunn =
  | "helg"
  | "helligdag"
  | "ferie"
  | "planlegging"
  | "annet"
  /** noe som opptar undervisningstida uten å være fri — «eksamen i annet fag» */
  | "hendelse";

export type Seriedag = {
  dato: string;
  /** null = blir en økt */
  hoppet: Hoppgrunn | null;
  /** «1. mai», «Høstferie» — det som gjorde at dagen falt bort */
  forklaring: string | null;
  /** brukeren kan overstyre begge veier i forhåndsvisningen */
  valgt: boolean;
};

// ------------------------------------------------------------------ påske

/**
 * 1. påskedag etter den gregorianske algoritmen. Alle de bevegelige
 * helligdagene ligger et fast antall dager fra denne datoen.
 */
export function paaskedag(ar: number): Date {
  const a = ar % 19;
  const b = Math.floor(ar / 100);
  const c = ar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maned = Math.floor((h + l - 7 * m + 114) / 31);
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ar, maned - 1, dag);
}

/** Norske røde dager i ett kalenderår. */
export function roddager(ar: number): Roddag[] {
  const paske = paaskedag(ar);
  const fra = (dager: number, navn: string): Roddag => {
    const d = new Date(paske);
    d.setDate(paske.getDate() + dager);
    return { dato: iso(d), navn };
  };

  return [
    { dato: `${ar}-01-01`, navn: "Nyttårsdag" },
    fra(-3, "Skjærtorsdag"),
    fra(-2, "Langfredag"),
    fra(0, "1. påskedag"),
    fra(1, "2. påskedag"),
    { dato: `${ar}-05-01`, navn: "1. mai" },
    { dato: `${ar}-05-17`, navn: "17. mai" },
    fra(39, "Kristi himmelfartsdag"),
    fra(49, "1. pinsedag"),
    fra(50, "2. pinsedag"),
    { dato: `${ar}-12-25`, navn: "1. juledag" },
    { dato: `${ar}-12-26`, navn: "2. juledag" },
  ].sort((a, b) => a.dato.localeCompare(b.dato));
}

/** Røde dager i et datospenn, som kan gå over et årsskifte. */
export function roddagerISpenn(fra: string, til: string): Roddag[] {
  const forsteAr = Number(fra.slice(0, 4));
  const sisteAr = Number(til.slice(0, 4));
  const alle: Roddag[] = [];
  for (let ar = forsteAr; ar <= sisteAr; ar++) alle.push(...roddager(ar));
  return alle.filter((r) => r.dato >= fra && r.dato <= til);
}

// ------------------------------------------------------------------ serie

const UKEDAGER = [
  "søndag",
  "mandag",
  "tirsdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lørdag",
] as const;

export type Ukedag = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function ukedagsnavn(u: Ukedag): string {
  return UKEDAGER[u];
}

/**
 * Alle datoer med gitt ukedag i spennet, med begrunnelse for dem som faller
 * bort. Ingenting fjernes i stillhet — brukeren ser hva som ble hoppet over
 * og hvorfor, og kan hake det inn igjen.
 */
export function lagSerie(
  ukedag: Ukedag,
  fra: string,
  til: string,
  fridager: Fridag[],
): Seriedag[] {
  const rode = new Map(roddagerISpenn(fra, til).map((r) => [r.dato, r.navn]));
  const dager: Seriedag[] = [];

  for (const dato of datoerMellom(fra, til)) {
    const d = new Date(`${dato}T00:00:00`);
    if (d.getDay() !== ukedag) continue;

    const helg = d.getDay() === 0 || d.getDay() === 6;
    const rod = rode.get(dato);
    const ferie = fridager.find((f) => dato >= f.fra && dato <= f.til);

    const hoppet: Hoppgrunn | null = helg
      ? "helg"
      : rod
        ? "helligdag"
        : ferie
          ? ferie.type
          : null;

    dager.push({
      dato,
      hoppet,
      forklaring: helg ? "Helg" : (rod ?? ferie?.navn ?? null),
      valgt: hoppet === null,
    });
  }

  return dager;
}

function* datoerMellom(fra: string, til: string): Generator<string> {
  const d = new Date(`${fra}T00:00:00`);
  const slutt = new Date(`${til}T00:00:00`);
  while (d <= slutt) {
    yield iso(d);
    d.setDate(d.getDate() + 1);
  }
}

export function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ------------------------------------------------------- blokkerte datoer

export type Blokkering = { navn: string; type: Hoppgrunn };

/**
 * Hva som eventuelt blokkerer en dato for undervisning.
 *
 * Brukes både av kalenderen, som toner dagen, og av øktlista, som varsler
 * når en økt allerede ligger der. Én kilde til sannhet, så de to aldri kan
 * bli uenige.
 */
export function blokkering(
  dato: string,
  fridager: Fridag[],
  rode: Map<string, string>,
): Blokkering | null {
  const ukedag = new Date(`${dato}T00:00:00`).getDay();
  if (ukedag === 0 || ukedag === 6) return { navn: "Helg", type: "helg" };

  const rod = rode.get(dato);
  if (rod) return { navn: rod, type: "helligdag" };

  const fri = fridager.find((f) => dato >= f.fra && dato <= f.til);
  if (fri) return { navn: fri.navn, type: fri.type };

  return null;
}

/** Oppslagskart over røde dager i et spenn, til bruk med blokkering(). */
export function rodekart(fra: string, til: string): Map<string, string> {
  return new Map(roddagerISpenn(fra, til).map((r) => [r.dato, r.navn]));
}

// ------------------------------------------------------------------ uker

/**
 * ISO-ukenummer. Uka begynner på mandag, og uke 1 er den som inneholder
 * årets første torsdag. Det er den norske tellemåten.
 */
export function ukenummer(dato: string): number {
  const d = new Date(`${dato}T00:00:00`);
  // Flytt til torsdagen i samme uke; da bestemmer året til torsdagen alt.
  const torsdag = new Date(d);
  torsdag.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const forsteTorsdag = new Date(torsdag.getFullYear(), 0, 4);
  forsteTorsdag.setDate(
    forsteTorsdag.getDate() - ((forsteTorsdag.getDay() + 6) % 7) + 3,
  );
  const dager = Math.round(
    (torsdag.getTime() - forsteTorsdag.getTime()) / 86_400_000,
  );
  return 1 + dager / 7;
}
