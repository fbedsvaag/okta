import type { Okt } from "./okter";
import type { Oktrad } from "./oktrader";

/**
 * Reglene bak økta i to moduser (ARBEIDSLISTE 11.3–11.5). Rene funksjoner,
 * så de kan testes uten base.
 */

export type Oktmodus = "skaring" | "plan";

/** Starttidspunktet til økta som lokal tid; uten klokkeslett midnatt. */
function start(okt: Pick<Okt, "dato" | "klokkeslett">): Date {
  return new Date(`${okt.dato}T${okt.klokkeslett ?? "00:00"}:00`);
}

/**
 * Hvilken modus økta åpner i, når den ikke åpnes fra I dag (der er det
 * alltid skåring): fram i tid → planlegging; pågår eller ferdig → skåring.
 */
export function standardModus(
  okt: Pick<Okt, "dato" | "klokkeslett">,
  na: Date,
): Oktmodus {
  return start(okt) > na ? "plan" : "skaring";
}

/**
 * Når økta er, sett fra nå, til merket øverst i arket: «om 3 dager»,
 * «i morgen», «i dag kl. 12:30», «i går», «for 5 dager siden».
 * «Pågår» lages for seg, med minuttene igjen.
 */
export function narTekst(
  okt: Pick<Okt, "dato" | "klokkeslett">,
  na: Date,
): string {
  const dag = (d: Date) =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  const diff = Math.round(dag(start(okt)) - dag(na));
  if (diff === 0)
    return start(okt) > na
      ? `i dag${okt.klokkeslett ? ` kl. ${okt.klokkeslett}` : ""}`
      : "i dag";
  if (diff === 1) return "i morgen";
  if (diff === -1) return "i går";
  if (diff > 1)
    return diff < 14 ? `om ${diff} dager` : `om ${Math.round(diff / 7)} uker`;
  return -diff < 14
    ? `for ${-diff} dager siden`
    : `for ${Math.round(-diff / 7)} uker siden`;
}

// ------------------------------------------------------------------- planen

/**
 * Ett punkt i planen (ARBEIDSLISTE 15.8): en aktivitet med avkrysning, eller
 * en pause uten.
 */
export type Planpunkt = {
  type: "aktivitet" | "pause";
  tekst: string;
  min: number | null;
  /** krysset av, i planen eller i skåringen */
  gjort: boolean;
  /** klokkeslettet den ble krysset av, «09:16» */
  ferdig: string | null;
  /** minutter lagt til underveis med «+5 min» */
  forlenget: number;
  /** linjene under punktet; tom når det ikke er skrevet noe */
  beskrivelse: string;
};

export function nyttPunkt(d: Partial<Planpunkt> = {}): Planpunkt {
  return {
    type: "aktivitet",
    tekst: "",
    min: null,
    gjort: false,
    ferdig: null,
    forlenget: 0,
    beskrivelse: "",
    ...d,
  };
}

const AKTIVITET = /^\s*[-*]\s+\[( |x|X)\]\s*(.*?)\s*$/;
const PAUSE = /^\s*[-*]\s+(Pause\b.*?)\s*$/i;
/** Det som kan stå bak tittelen, skilt med «·», i hvilken som helst rekkefølge. */
const MIN = /\s+·\s+(\d+)\s*min$/;
const FERDIG = /\s+·\s+ferdig\s+(\d{1,2}:\d{2})$/;
const FORLENGET = /\s+·\s+\+(\d+)\s*min$/;
/** Beskrivelsen: innrykk på fire mellomrom (eller tab) under punktet. */
const INNRYKK = /^(?: {4}|\t)/;

function lesHale(
  tekst: string,
): Pick<Planpunkt, "tekst" | "min" | "ferdig" | "forlenget"> {
  let t = tekst;
  let min: number | null = null;
  let ferdig: string | null = null;
  let forlenget = 0;
  for (;;) {
    let m: RegExpMatchArray | null;
    if (forlenget === 0 && (m = t.match(FORLENGET))) forlenget = Number(m[1]);
    else if (ferdig === null && (m = t.match(FERDIG))) ferdig = m[1];
    else if (min === null && (m = t.match(MIN))) min = Number(m[1]);
    else break;
    t = t.slice(0, m.index);
  }
  return { tekst: t, min, ferdig, forlenget };
}

/**
 * Planen er markdown i `okt.plan` (§3.3), så den kan leses i arkivet uten
 * appen:
 *
 *     - [ ] Gruppearbeid: kildekritikk · 30 min
 *         Elevene får tre kilder hver.
 *     - Pause · 10 min
 *     - [x] Gjennomgang · 30 min · +5 min · ferdig 09:16
 *
 * Eldre planer («- [ ] Tekst · 10 min») leses som før. Linjer som ikke hører
 * til et punkt, blir liggende som de er i `rest`, så ingenting som er
 * skrevet forsvinner.
 */
export function lesPlan(plan: string | null): {
  punkter: Planpunkt[];
  rest: string[];
} {
  const punkter: Planpunkt[] = [];
  const rest: string[] = [];
  const linjer = (plan ?? "").split("\n");
  let forrige: Planpunkt | null = null;
  let tomme = 0;
  for (const linje of linjer) {
    // Innrykk under et punkt er beskrivelsen. Tomme linjer imellom hører
    // med når beskrivelsen fortsetter etter dem.
    if (forrige && INNRYKK.test(linje) && linje.trim()) {
      const del = linje.replace(INNRYKK, "");
      forrige.beskrivelse = forrige.beskrivelse
        ? `${forrige.beskrivelse}${"\n".repeat(tomme + 1)}${del}`
        : del;
      tomme = 0;
      continue;
    }
    if (!linje.trim()) {
      if (forrige?.beskrivelse) tomme++;
      continue;
    }
    tomme = 0;
    const a = linje.match(AKTIVITET);
    const p = !a && linje.match(PAUSE);
    if (a) {
      forrige = nyttPunkt({ gjort: a[1] !== " ", ...lesHale(a[2]) });
      punkter.push(forrige);
    } else if (p) {
      const hale = lesHale(p[1]);
      forrige = nyttPunkt({ type: "pause", tekst: hale.tekst, min: hale.min });
      punkter.push(forrige);
    } else {
      forrige = null;
      rest.push(linje);
    }
  }
  return { punkter, rest };
}

function skrivPunkt(p: Planpunkt): string {
  const hale = [
    p.min ? `${p.min} min` : null,
    p.type === "aktivitet" && p.forlenget ? `+${p.forlenget} min` : null,
    p.type === "aktivitet" && p.gjort && p.ferdig ? `ferdig ${p.ferdig}` : null,
  ]
    .filter(Boolean)
    .map((x) => ` · ${x}`)
    .join("");
  const forst =
    p.type === "pause"
      ? `- ${p.tekst.trim() || "Pause"}${hale}`
      : `- [${p.gjort ? "x" : " "}] ${p.tekst.trim()}${hale}`;
  const beskrivelse = p.beskrivelse.replace(/\s+$/, "");
  const under = beskrivelse
    ? beskrivelse.split("\n").map((l) => (l.trim() ? `    ${l}` : ""))
    : [];
  return [forst, ...under].join("\n");
}

export function skrivPlan(punkter: Planpunkt[], rest: string[]): string | null {
  const linjer = [...punkter.map(skrivPunkt), ...rest];
  return linjer.length ? linjer.join("\n") : null;
}

/** «2 t av 3 t», «40 min av 1,5 t» — planen mot øktas lengde. */
export function plansum(punkter: Planpunkt[], varighetMin: number): string {
  const sum = punkter.reduce((s, p) => s + (p.min ?? 0), 0);
  const t = (m: number) =>
    m < 60
      ? `${m} min`
      : `${String(Math.round((m / 60) * 10) / 10).replace(".", ",")} t`;
  return `${t(sum)} av ${t(varighetMin)}`;
}

// ------------------------------------------------------------ følg opp

export type Oppfolging = { elevId: string; grunn: "rod" | "borte" | "punkt" };

/**
 * Hvem som bør følges opp i økta: rød i de to siste øktene før denne,
 * borte i den siste, eller med et åpent oppfølgingspunkt. Én linje per
 * elev, i den rekkefølgen.
 */
export function folgOpp(
  rader: Oktrad[],
  okt: Pick<Okt, "id" | "dato" | "skolearFagId">,
  apne: ReadonlySet<string>,
): Oppfolging[] {
  const for_ = rader.filter(
    (r) => r.skolearFagId === okt.skolearFagId && r.dato < okt.dato,
  );
  const perElev = new Map<string, Oktrad[]>();
  for (const r of for_) {
    const l = perElev.get(r.elevId) ?? [];
    l.push(r);
    perElev.set(r.elevId, l);
  }
  const ut: Oppfolging[] = [];
  const med = new Set<string>();
  for (const [elevId, l] of perElev) {
    const to = l.slice(-2);
    if (to.length === 2 && to.every((r) => !r.borte && r.farge === "rod")) {
      ut.push({ elevId, grunn: "rod" });
      med.add(elevId);
    }
  }
  for (const [elevId, l] of perElev)
    if (!med.has(elevId) && l[l.length - 1]?.borte) {
      ut.push({ elevId, grunn: "borte" });
      med.add(elevId);
    }
  for (const elevId of apne)
    if (!med.has(elevId) && perElev.has(elevId))
      ut.push({ elevId, grunn: "punkt" });
  return ut;
}

/** Hvor i perioden økta ligger: nummeret, og alle øktene i rekkefølge. */
export function iPerioden(
  okt: Pick<Okt, "id" | "periodeId">,
  fagOkter: Okt[],
): { nr: number; av: number; okter: Okt[] } | null {
  if (!okt.periodeId) return null;
  const okter = fagOkter
    .filter((o) => o.periodeId === okt.periodeId)
    .sort(
      (a, b) =>
        a.dato.localeCompare(b.dato) ||
        (a.klokkeslett ?? "").localeCompare(b.klokkeslett ?? ""),
    );
  const i = okter.findIndex((o) => o.id === okt.id);
  return i < 0 ? null : { nr: i + 1, av: okter.length, okter };
}
