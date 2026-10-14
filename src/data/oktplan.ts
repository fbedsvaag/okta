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

// ------------------------------------------------------- tid i planen

/** Lengdene man kan velge med ett klikk (15.3). */
export const LENGDER = [5, 10, 15, 20, 30, 45, 60];
/** Minste lengde på en bolk, og steget når man drar eller trykker − / +. */
export const STEG = 5;

export function minutter(punkter: Planpunkt[]): number {
  return punkter.reduce((s, p) => s + (p.min ?? 0), 0);
}

/**
 * Summen mot øktas lengde, som i overskriften: «90 av 90 min · går opp»,
 * «80 av 90 min · 10 min luft», «100 av 90 min · 10 min for mye».
 */
export function sumTekst(punkter: Planpunkt[], lengde: number): string {
  const sum = minutter(punkter);
  const diff = sum - lengde;
  const hale =
    diff === 0
      ? "går opp"
      : diff > 0
        ? `${diff} min for mye`
        : `${-diff} min luft`;
  return `${sum} av ${lengde} min · ${hale}`;
}

export function klokke(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(m / 60))}:${p(m % 60)}`;
}

export function tilMinutter(kl: string): number {
  const [t, m] = kl.split(":").map(Number);
  return t * 60 + (m || 0);
}

/** Når hvert punkt begynner, regnet fra øktas start. Uten klokkeslett: null. */
export function startTider(
  punkter: Planpunkt[],
  start: string | null,
): (string | null)[] {
  let t = start ? tilMinutter(start) : 0;
  return punkter.map((p) => {
    const her = start ? klokke(t) : null;
    t += p.min ?? 0;
    return her;
  });
}

/**
 * Skillene i tidslinjen: etter punkt `etter`, flytter tid mellom `fra` og
 * `til`. Pauser står fast (15.3): et skille inntil en pause flytter tid
 * mellom aktivitetene på hver side av den. Er pausen valgt, er det pausen
 * som endres.
 */
export function skiller(
  punkter: Planpunkt[],
  valgt: number | null,
): { etter: number; fra: number; til: number }[] {
  const fri = (k: number) => punkter[k].type !== "pause" || k === valgt;
  const ut: { etter: number; fra: number; til: number }[] = [];
  for (let i = 0; i < punkter.length - 1; i++) {
    let fra = i;
    while (fra >= 0 && !fri(fra)) fra--;
    let til = i + 1;
    while (til < punkter.length && !fri(til)) til++;
    if (fra >= 0 && til < punkter.length) ut.push({ etter: i, fra, til });
  }
  return ut;
}

/**
 * Flytter `d` minutter fra `til` til `fra` (negativ d: motsatt vei), i
 * steg på fem og så hver beholder minst fem. Summen står fast.
 */
export function flyttTid(
  punkter: Planpunkt[],
  fra: number,
  til: number,
  d: number,
): Planpunkt[] {
  const a = punkter[fra].min ?? STEG;
  const b = punkter[til].min ?? STEG;
  const steg = Math.round(d / STEG) * STEG;
  const x = Math.max(STEG - a, Math.min(b - STEG, steg));
  return punkter.map((p, i) =>
    i === fra ? { ...p, min: a + x } : i === til ? { ...p, min: b - x } : p,
  );
}

/**
 * Enden av siste bolk (15.3): til venstre gir luft, til høyre fyller luft,
 * men aldri forbi øktas slutt. Ligger planen allerede over, kan den bare
 * kortes ned.
 */
export function dragEnde(
  punkter: Planpunkt[],
  lengde: number,
  start: number,
  d: number,
): Planpunkt[] {
  const i = punkter.length - 1;
  if (i < 0) return punkter;
  const andre = minutter(punkter) - (punkter[i].min ?? 0);
  const tak = Math.max(start, lengde - andre);
  const n = start + Math.round(d / STEG) * STEG;
  const min = Math.max(STEG, Math.min(tak, n));
  return punkter.map((p, k) => (k === i ? { ...p, min } : p));
}

/** Den lengste aktiviteten, som «Trekk 10 min fra …» korter ned. */
export function lengste(punkter: Planpunkt[]): number {
  let best = -1;
  punkter.forEach((p, i) => {
    if (
      p.type === "aktivitet" &&
      (best < 0 || (p.min ?? 0) > (punkter[best].min ?? 0))
    )
      best = i;
  });
  return best;
}

/**
 * «Film · 15 min» eller «Film 15 min» skrevet i tittelen: minuttene tas ut
 * av teksten (15.10). Uten minutter står tittelen som den er.
 */
export function lesTittel(tekst: string): {
  tekst: string;
  min: number | null;
} {
  const m = tekst.match(/^(.*?)\s*(?:·\s*)?(\d+)\s*min\s*$/);
  if (!m || !m[1].trim()) return { tekst: tekst.trim(), min: null };
  return { tekst: m[1].trim(), min: Number(m[2]) };
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
