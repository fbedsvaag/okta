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

export type Planpunkt = { gjort: boolean; tekst: string; min: number | null };

const PUNKT = /^\s*[-*]\s+\[( |x|X)\]\s*(.*?)(?:\s+·\s+(\d+)\s*min)?\s*$/;

/**
 * Planen er markdown i `okt.plan` (§3.3): «- [ ] Tekst · 10 min». Linjer
 * som ikke er avkrysningspunkter, blir liggende som de er i `rest`, så
 * ingenting som er skrevet forsvinner.
 */
export function lesPlan(plan: string | null): {
  punkter: Planpunkt[];
  rest: string[];
} {
  const punkter: Planpunkt[] = [];
  const rest: string[] = [];
  for (const linje of (plan ?? "").split("\n")) {
    const m = linje.match(PUNKT);
    if (m)
      punkter.push({
        gjort: m[1] !== " ",
        tekst: m[2],
        min: m[3] ? Number(m[3]) : null,
      });
    else if (linje.trim()) rest.push(linje);
  }
  return { punkter, rest };
}

export function skrivPlan(punkter: Planpunkt[], rest: string[]): string | null {
  const linjer = [
    ...punkter.map(
      (p) =>
        `- [${p.gjort ? "x" : " "}] ${p.tekst.trim()}${p.min ? ` · ${p.min} min` : ""}`,
    ),
    ...rest,
  ];
  return linjer.length ? linjer.join("\n") : null;
}

/** «2 t av 3», «40 min av 1,5 t» — planen mot øktas lengde. */
export function plansum(punkter: Planpunkt[], varighetMin: number): string {
  const sum = punkter.reduce((s, p) => s + (p.min ?? 0), 0);
  const t = (m: number) =>
    m < 60
      ? `${m} min`
      : `${String(Math.round((m / 60) * 10) / 10).replace(".", ",")} t`;
  const lengde = t(varighetMin).replace(" t", "").replace(" min", "");
  return `${t(sum)} av ${varighetMin < 60 ? `${lengde} min` : lengde}`;
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
