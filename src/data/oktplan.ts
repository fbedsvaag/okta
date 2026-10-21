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

// ----------------------------------------------------------- visningen

/**
 * Øktplan: Enkel | Full (Innstillinger › Generelt, 15.10). Enkel er en
 * liste med minutter; Full har tidslinjen man drar i, beskrivelser og
 * pauser. Beskrivelser skrevet i Full blir liggende i Enkel.
 */
export type Planvisning = "enkel" | "full";
export const PLANVISNING = "oktplan_visning";
export const lesPlanvisning = (v: string | null): Planvisning =>
  v === "full" ? "full" : "enkel";

// --------------------------------------------------------- pauser

/**
 * Planen en ny økt starter med når faget har standard pause (17.5): deler
 * på `etter` minutter med `pause` minutter imellom, og resten av økta i den
 * siste delen. Uten pause, eller når økta er for kort, ingen plan.
 */
export function planMedPauser(
  lengde: number,
  etter: number | null,
  pause: number | null,
): string | null {
  if (!etter || !pause || etter <= 0 || pause <= 0) return null;
  if (lengde <= etter + pause) return null;
  const punkter: Planpunkt[] = [];
  let t = 0;
  let nr = 1;
  while (lengde - t > etter + pause) {
    punkter.push(nyttPunkt({ tekst: `Del ${nr++}`, min: etter }));
    punkter.push(nyttPunkt({ type: "pause", tekst: "Pause", min: pause }));
    t += etter + pause;
  }
  punkter.push(nyttPunkt({ tekst: `Del ${nr}`, min: lengde - t }));
  return skrivPlan(punkter, []);
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

// --------------------------------------------------------------- live

/** Et punkt i planen mens økta pågår, i minutter fra øktas start. */
export type Livepunkt = {
  /** når det begynner og slutter, med forlengelser og det som ble ferdig før tida */
  s: number;
  e: number;
  /** krysset av: med et klikk, eller av seg selv når tida er ute */
  ferdig: boolean;
  /** krysset av av seg selv (lysere hake) */
  auto: boolean;
};

/**
 * Hvor økta står (15.6). `na` er minutter siden øktas start (negativ før
 * start), eller null når økta ikke har klokkeslett: da krysses bare det
 * som er klikket.
 *
 * En aktivitet krysses av når tida er ute. «+5 min» forlenger den, og
 * resten flytter seg. Krysses den av før tida, slutter den der, og den
 * neste begynner. En pause krysses av selv.
 */
export function livePlan(
  punkter: Planpunkt[],
  start: string | null,
  na: number | null,
): { liste: Livepunkt[]; aktiv: number } {
  let pos = 0;
  const liste = punkter.map((p) => {
    const s = pos;
    let e = s + (p.min ?? 0) + (p.type === "aktivitet" ? p.forlenget : 0);
    if (p.type === "aktivitet" && p.gjort && p.ferdig && start) {
      let f = tilMinutter(p.ferdig) - tilMinutter(start);
      if (f < -720) f += 1440;
      if (f >= s && f < e) e = f;
    }
    pos = e;
    const ute = na !== null && na >= e;
    const ferdig = p.type === "pause" ? ute : p.gjort || ute;
    return { s, e, ferdig, auto: ferdig && !p.gjort };
  });
  const aktiv =
    na === null
      ? -1
      : liste.findIndex((l) => !l.ferdig && na >= l.s && na < l.e);
  return { liste, aktiv };
}

/** Teksten til høyre i hver rad i skåringen (15.7). */
export function livetid(
  p: Planpunkt,
  l: Livepunkt,
  aktiv: boolean,
  na: number | null,
  start: string | null,
  lengde: number,
): string {
  const kl = (m: number) => (start ? klokke(tilMinutter(start) + m) : "");
  if (p.type === "pause") return aktiv ? "pågår" : `${p.min ?? 0} min`;
  if (!start || na === null) return p.min ? `${p.min} min` : "";
  if (l.ferdig) return kl(l.e);
  if (aktiv) return `${Math.max(0, l.e - na)} min igjen`;
  if (l.e <= lengde) return `${kl(l.s)}–${kl(l.e)}`;
  if (l.s < lengde) return `${l.e - lengde} min over slutt`;
  return "rekker ikke";
}

/** Det som står til venstre og høyre i stripa, og i statusmerket (15.6). */
export function livetekst(
  punkter: Planpunkt[],
  start: string,
  lengde: number,
  na: number,
): {
  etikett: string;
  tittel: string;
  hoyre: string;
  under: string;
  status: string | null;
} {
  const { liste, aktiv } = livePlan(punkter, start, na);
  const slutt = klokke(tilMinutter(start) + lengde);
  const igjen = lengde - na;
  const aktiviteter = punkter.filter((p) => p.type === "aktivitet").length;
  if (na < 0)
    return {
      etikett: `Starter om ${-na} min`,
      tittel: punkter.length
        ? `Først: ${punkter[0].tekst}`
        : "Ingen plan for økta",
      hoyre: `${lengde} min`,
      under: punkter.length
        ? `${aktiviteter} ${aktiviteter === 1 ? "aktivitet" : "aktiviteter"}, ${sumTekst(punkter, lengde).split(" · ")[1]}`
        : "",
      status: null,
    };
  if (na >= lengde) {
    const krysset = punkter.filter(
      (p, i) => p.type === "aktivitet" && (p.gjort || liste[i].e <= lengde),
    ).length;
    return {
      etikett: `Ferdig ${slutt}`,
      tittel: punkter.length
        ? `${krysset} av ${aktiviteter} aktiviteter krysset av`
        : "Økta er slutt",
      hoyre: "Økta er slutt",
      under: "Skriv i øktloggen før du lukker",
      status: null,
    };
  }
  const status = `Pågår · ${igjen} min igjen`;
  if (!punkter.length)
    return {
      etikett: "Ingen plan",
      tittel: "Økta pågår",
      hoyre: `${igjen} min igjen`,
      under: "av økta",
      status,
    };
  if (aktiv < 0)
    return {
      etikett: "Nå",
      tittel: liste.every((l) => l.ferdig)
        ? "Planen er gjennomført"
        : "Mellom aktiviteter",
      hoyre: `${igjen} min igjen`,
      under: "av økta",
      status,
    };
  const l = liste[aktiv];
  // Hvor mye senere den aktive slutter enn planen sa.
  const planlagt = punkter
    .slice(0, aktiv + 1)
    .reduce((s, p) => s + (p.min ?? 0), 0);
  const etter = l.e - planlagt;
  const over = liste[liste.length - 1].e - lengde;
  return {
    etikett: "Nå",
    tittel: punkter[aktiv].tekst,
    hoyre: `${na - l.s} av ${l.e - l.s} min`,
    under:
      etter > 0
        ? over > 0
          ? `${etter} min forlenget · siste går ${over} min over`
          : `${etter} min etter planen · ${igjen} min igjen`
        : `${igjen} min igjen av økta`,
    status,
  };
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

/**
 * Elevene i den siste avholdte økta i faget før denne som passer `hvem`.
 * null når faget ikke har noen avholdt økt før denne.
 */
function forrigeOkt(
  rader: Oktrad[],
  okt: Pick<Okt, "id" | "dato" | "klokkeslett" | "skolearFagId">,
  hvem: (r: Oktrad) => boolean,
): { dato: string; elevIder: string[] } | null {
  const for_ = rader.filter(
    (r) =>
      r.skolearFagId === okt.skolearFagId &&
      r.oktId !== okt.id &&
      (r.dato < okt.dato ||
        (r.dato === okt.dato &&
          (r.klokkeslett ?? "") < (okt.klokkeslett ?? ""))),
  );
  if (for_.length === 0) return null;
  const siste = for_.reduce((a, b) =>
    b.dato > a.dato ||
    (b.dato === a.dato && (b.klokkeslett ?? "") > (a.klokkeslett ?? ""))
      ? b
      : a,
  );
  return {
    dato: siste.dato,
    elevIder: for_
      .filter((r) => r.oktId === siste.oktId && hvem(r))
      .map((r) => r.elevId),
  };
}

/**
 * Hvem som var borte forrige gang (alle, uten tak): «ikke i økta» i den
 * siste avholdte økta i faget før denne. Til boksen «Borte sist» i
 * skåringen. Ikke skåret er ikke borte (19.4).
 */
export function borteSist(
  rader: Oktrad[],
  okt: Pick<Okt, "id" | "dato" | "klokkeslett" | "skolearFagId">,
): { dato: string; elevIder: string[] } | null {
  return forrigeOkt(rader, okt, (r) => r.borte === 1);
}

/**
 * Hvem som ikke ble sett forrige gang: til stede, men ikke skåret i den
 * siste avholdte økta i faget før denne (19.4). Til «Følg opp i økta».
 */
export function ikkeSettSist(
  rader: Oktrad[],
  okt: Pick<Okt, "id" | "dato" | "klokkeslett" | "skolearFagId">,
): string[] {
  return forrigeOkt(rader, okt, (r) => r.ikkeSett === 1)?.elevIder ?? [];
}

export type FolgOppFag = {
  skolearFagId: string;
  /** rød i siste avholdte økt; `toPaRad` når den før også var rød */
  rod: { elevId: string; toPaRad: boolean }[];
  ikkeSett: string[];
  borte: string[];
};

/**
 * «Følg opp i dag» på I dag (20.5): for hvert fag du har i dag, hvem som
 * var rød, ikke sett og borte i den siste avholdte økta før dagens første.
 * Fag uten noen å følge opp er ikke med.
 */
export function folgOppIDag(
  rader: Oktrad[],
  dagens: Pick<Okt, "id" | "dato" | "klokkeslett" | "skolearFagId">[],
): FolgOppFag[] {
  const forste = new Map<string, (typeof dagens)[number]>();
  for (const o of [...dagens].sort((a, b) =>
    (a.klokkeslett ?? "").localeCompare(b.klokkeslett ?? ""),
  ))
    if (!forste.has(o.skolearFagId)) forste.set(o.skolearFagId, o);

  const ut: FolgOppFag[] = [];
  for (const okt of forste.values()) {
    const sist = forrigeOkt(rader, okt, () => true);
    if (!sist) continue;
    const forFag = rader.filter(
      (r) => r.skolearFagId === okt.skolearFagId && r.dato < okt.dato,
    );
    const sisteOkt = forFag.find(
      (r) => r.dato === sist.dato && sist.elevIder.includes(r.elevId),
    )?.oktId;
    const iSiste = forFag.filter((r) => r.oktId === sisteOkt);
    const rod = iSiste
      .filter((r) => !r.borte && r.farge === "rod")
      .map((r) => {
        const egne = forFag.filter((x) => x.elevId === r.elevId);
        const forrige = egne[egne.indexOf(r) - 1];
        return {
          elevId: r.elevId,
          toPaRad: !!forrige && !forrige.borte && forrige.farge === "rod",
        };
      });
    const fag = {
      skolearFagId: okt.skolearFagId,
      rod,
      ikkeSett: iSiste.filter((r) => r.ikkeSett === 1).map((r) => r.elevId),
      borte: iSiste.filter((r) => r.borte === 1).map((r) => r.elevId),
    };
    if (fag.rod.length || fag.ikkeSett.length || fag.borte.length) ut.push(fag);
  }
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
