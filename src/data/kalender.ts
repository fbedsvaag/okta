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
  /**
   * `helligdag` er en rød dag lagt inn for hånd — de vanlige regnes ut
   * (roddager), men en lokal fridag som skal se ut som en rød dag, må
   * kunne legges inn. Kolonnen har ingen CHECK, så det trengs ingen
   * migrasjon for en ny verdi.
   */
  type: "ferie" | "planlegging" | "annet" | "hendelse" | "helligdag";
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
 * Hvor ofte serien går (19.5): hver uke, annenhver, hver tredje … `fra` er
 * en dato i en uke som skal med; uten den teller serien fra sin første uke.
 * A-/B-uke er annenhver uke regnet fra en kjent A-uke.
 *
 * Ukene telles i kalenderen, ikke i skoleuker: en ferie flytter ikke
 * rytmen, den faller bare bort som før. Tellingen går jevnt over nyttår,
 * også når året har en uke 53.
 */
export type Rytme = { hver: number; fra?: string };

/** Mandagen i uka datoen ligger i. */
export function mandag(dato: string): string {
  const [a, m, d] = dato.slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

/** Hele uker fra mandag a til mandag b; negativt når b ligger før a. */
function ukerMellom(a: string, b: string): number {
  const ms = (x: string) => Date.parse(`${x}T00:00:00Z`);
  return Math.round((ms(b) - ms(a)) / (7 * 86_400_000));
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
  rytme: Rytme = { hver: 1 },
): Seriedag[] {
  const rode = new Map(roddagerISpenn(fra, til).map((r) => [r.dato, r.navn]));
  const dager: Seriedag[] = [];
  const hver = Math.max(1, Math.floor(rytme.hver));
  let anker = rytme.fra ? mandag(rytme.fra) : null;

  for (const dato of datoerMellom(fra, til)) {
    const d = new Date(`${dato}T00:00:00`);
    if (d.getDay() !== ukedag) continue;
    anker ??= mandag(dato);
    const uker = ukerMellom(anker, mandag(dato));
    if (((uker % hver) + hver) % hver !== 0) continue;

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
  // Ren UTC-regning: sommertid kan ikke flytte en dag over midnatt. Den
  // eneste utregningen av ukenummer i appen (#15).
  const [a, m, d] = dato.slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  // Flytt til torsdagen i samme uke; da bestemmer året til torsdagen alt.
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const nyttar = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - nyttar) / 86_400_000 + 1) / 7);
}
