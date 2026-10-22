import { hent } from "../db";
import type { Samtaledag } from "./samtale";
import { grupperTrekninger } from "./samtale";
import type { Vurdering } from "./vurderinger";

/**
 * «Vurderinger og samtaler» som én oversikt (ARBEIDSLISTE 28.0, lerretet
 * VurderingerSamtaler): vurderingene og samtaletrekningene i skoleåret,
 * gruppert etter status — Nå · Kommende · Til føring · Ferdig.
 *
 * En muntlig vurdering med tidsplan er én rad, ikke to: trekningen hører
 * til vurderingen. Mentorsamtaler er ikke vurderinger og gir ingen
 * karakter; de står her bare for å samle tidsplanene, og bare for den som
 * har mentorelever.
 */

export type Oversiktstype = "skriftlig" | "muntlig" | "innlevering" | "mentor";
export type Statusgruppe = "na" | "kommende" | "foring" | "ferdig";

export const GRUPPENAVN: Record<Statusgruppe, string> = {
  na: "Nå",
  kommende: "Kommende",
  foring: "Til føring",
  ferdig: "Ferdig",
};

/** Ordene for mentorsamtalene samlet, så de kan byttes senere. */
export const MENTORORD = {
  samtaler: "Mentorsamtaler",
  hjelp: "Tidsplan for mentorgruppa. Ikke en vurdering, gir ingen karakter.",
};

export type Oversiktsrad = {
  /** vurderings-id, eller «fag-id»/«mentor» for en trekning uten vurdering */
  id: string;
  /** hva et klikk åpner */
  apner: { vurdering: string } | { trekning: string };
  type: Oversiktstype;
  tittel: string;
  skolearFagId: string | null;
  fagKode: string | null;
  farge: string | null;
  skalaNavn: string | null;
  gruppe: Statusgruppe;
  /** «tor 5.11», «I dag 08:30–12:58», «frist fre 13.11» */
  dato: string;
  /** første dato, for sortering; "" når den mangler */
  sortering: string;
  info: string;
  /** en samtale pågår akkurat nå */
  pagar: boolean;
  ant: number;
  av: number;
  utkast: boolean;
};

/** En samtale i en trekning, så nok til å telle og si hvem som er inne. */
export type Samtalelinje = {
  samtaledagId: string;
  dato: string;
  klokkeslett: string;
  varighetMin: number;
  motte: boolean;
  fornavn: string;
  etternavn: string;
};

export async function hentSamtalelinjer(
  skolearId: string,
): Promise<Samtalelinje[]> {
  const rader = await hent<Omit<Samtalelinje, "motte"> & { motte: number }>(
    `SELECT s.samtaledag_id AS samtaledagId, d.dato, s.klokkeslett,
            s.varighet_min AS varighetMin, s.motte, e.fornavn, e.etternavn
       FROM samtale s
       JOIN samtaledag d ON d.id = s.samtaledag_id AND d.slettet IS NULL
       JOIN elev e ON e.id = s.elev_id AND e.slettet IS NULL
      WHERE d.skolear_id = $1 AND s.slettet IS NULL
      ORDER BY d.dato, s.klokkeslett`,
    [skolearId],
  );
  return rader.map((r) => ({ ...r, motte: r.motte === 1 }));
}

/** Om læreren har mentorelever i skoleåret. */
export async function harMentorelever(skolearId: string): Promise<boolean> {
  const [r] = await hent<{ n: number }>(
    `SELECT COUNT(*) AS n FROM elev_klasse ek
       JOIN elev e ON e.id = ek.elev_id AND e.slettet IS NULL
      WHERE ek.skolear_id = $1 AND ek.mentor = 1 AND ek.slettet IS NULL`,
    [skolearId],
  );
  return (r?.n ?? 0) > 0;
}

// ------------------------------------------------------------------ rent

const pad = (n: number) => String(n).padStart(2, "0");
const isoDato = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const klokke = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const tilMin = (k: string) => {
  const [t, m] = k.split(":").map(Number);
  return t * 60 + (m || 0);
};
const fraMin = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

/** «tor 5.11» */
export function kortDag(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const dag = d
    .toLocaleDateString("nb-NO", { weekday: "short" })
    .replace(".", "");
  return `${dag} ${d.getDate()}.${d.getMonth() + 1}`;
}

/** Datoene til en trekning som tekst: én dag, to dager, eller et spenn. */
function dagspenn(datoer: string[], idag: string, linjer: Samtalelinje[]) {
  const u = [...new Set(datoer.filter(Boolean))].sort();
  if (u.length === 0) return "Ingen dato";
  if (u.length === 1) {
    if (u[0] === idag && linjer.length > 0) {
      const fra = Math.min(...linjer.map((l) => tilMin(l.klokkeslett)));
      const til = Math.max(
        ...linjer.map((l) => tilMin(l.klokkeslett) + l.varighetMin),
      );
      return `I dag ${fraMin(fra)}–${fraMin(til)}`;
    }
    return u[0] === idag ? "I dag" : kortDag(u[0]);
  }
  if (u.length === 2) return `${kortDag(u[0])} og ${kortDag(u[1])}`;
  return `${kortDag(u[0])} – ${kortDag(u[u.length - 1])}`;
}

/** Hvem som er inne nå, blant samtalene i dag. */
function inneNa(linjer: Samtalelinje[], idag: string, kl: string) {
  const n = tilMin(kl);
  return linjer.find(
    (l) =>
      l.dato === idag &&
      l.motte &&
      tilMin(l.klokkeslett) <= n &&
      n < tilMin(l.klokkeslett) + l.varighetMin,
  );
}

/** Samtaler som er over (dagen passert, eller tida passert i dag). */
function holdt(linjer: Samtalelinje[], idag: string, kl: string) {
  const n = tilMin(kl);
  return linjer.filter(
    (l) =>
      l.motte &&
      !!l.dato &&
      (l.dato < idag ||
        (l.dato === idag && tilMin(l.klokkeslett) + l.varighetMin <= n)),
  ).length;
}

function gruppeFor(
  fra: string,
  til: string,
  idag: string,
  ferdig: boolean,
  passertErFerdig: boolean,
): Statusgruppe {
  if (!fra) return ferdig ? "ferdig" : "kommende";
  if (idag < fra) return "kommende";
  if (idag <= til) return ferdig ? "ferdig" : "na";
  return ferdig || passertErFerdig ? "ferdig" : "foring";
}

const snittTekst = (s: number) => `Snitt ${s.toFixed(1).replace(".", ",")}`;

/**
 * Bygger radene. Ren funksjon: alt den trenger, får den inn, og `naa`
 * bestemmer hva som er «nå».
 */
export function byggOversikt({
  vurderinger,
  dager,
  linjer,
  harMentor,
  naa,
}: {
  vurderinger: Vurdering[];
  dager: Samtaledag[];
  linjer: Samtalelinje[];
  harMentor: boolean;
  naa: Date;
}): Oversiktsrad[] {
  const idag = isoDato(naa);
  const kl = klokke(naa);
  const linjerPerDag = new Map<string, Samtalelinje[]>();
  for (const l of linjer)
    linjerPerDag.set(l.samtaledagId, [
      ...(linjerPerDag.get(l.samtaledagId) ?? []),
      l,
    ]);
  const trekninger = grupperTrekninger(dager);
  // Trekningen som hører til en vurdering, slås sammen med den.
  const tilVurdering = new Map<string, (typeof trekninger)[number]>();
  for (const t of trekninger) {
    const v = t.dager.find((d) => d.vurderingId)?.vurderingId;
    if (v && t.skolearFagId) tilVurdering.set(v, t);
  }
  const rader: Oversiktsrad[] = [];

  for (const v of vurderinger) {
    const type: Oversiktstype =
      v.type === "muntlig"
        ? "muntlig"
        : v.type === "innlevering"
          ? "innlevering"
          : "skriftlig";
    const ferdig = v.elever > 0 && v.fort >= v.elever;
    const t = tilVurdering.get(v.id);
    const felles = {
      id: v.id,
      apner: { vurdering: v.id },
      type,
      tittel: v.tittel,
      skolearFagId: v.skolearFagId,
      fagKode: v.fagKode,
      farge: v.farge,
      skalaNavn: v.skalaNavn,
      utkast: v.utkast === 1,
      av: v.elever,
    };

    if (t) {
      const l = t.dager.flatMap((d) => linjerPerDag.get(d.id) ?? []);
      const datoer = t.dager.map((d) => d.dato);
      const fra = t.forste;
      const til = t.siste || t.forste;
      const gruppe = v.utkast
        ? "kommende"
        : gruppeFor(fra, til, idag, ferdig, false);
      const inne = gruppe === "na" ? inneNa(l, idag, kl) : undefined;
      const info =
        gruppe === "na"
          ? inne
            ? `Pågår · ${inne.fornavn} ${inne.etternavn} er inne`
            : `${holdt(l, idag, kl)} av ${l.length} holdt`
          : gruppe === "kommende"
            ? l.length > 0
              ? "Tidsplan trukket"
              : "Ikke trukket ennå"
            : gruppe === "foring"
              ? `${v.fort} av ${v.elever} ført`
              : v.snitt !== null
                ? snittTekst(v.snitt)
                : "Alle ført";
      rader.push({
        ...felles,
        gruppe,
        dato: dagspenn(datoer, idag, l),
        sortering: fra,
        info,
        pagar: !!inne,
        ant: v.fort,
      });
      continue;
    }

    const dato =
      type === "innlevering" ? v.frist : (v.oktDato ?? v.frist ?? null);
    const gruppe: Statusgruppe = v.utkast
      ? "kommende"
      : gruppeFor(dato ?? "", dato ?? "", idag, ferdig, false);
    // En innlevering før fristen teller levert, etterpå ført.
    const forFrist = type === "innlevering" && gruppe !== "foring" && !ferdig;
    const info =
      gruppe === "ferdig"
        ? v.snitt !== null
          ? snittTekst(v.snitt)
          : "Alle ført"
        : gruppe === "foring"
          ? `${v.fort} av ${v.elever} ført`
          : forFrist
            ? `${v.levert} av ${v.elever} levert`
            : v.oktDato
              ? `I økta ${kortDag(v.oktDato)}`
              : v.frist
                ? `Frist ${kortDag(v.frist)}`
                : "Ingen dato ennå";
    rader.push({
      ...felles,
      gruppe,
      dato: !dato
        ? ""
        : type === "innlevering"
          ? `frist ${kortDag(dato)}`
          : dato === idag
            ? "I dag"
            : kortDag(dato),
      sortering: dato ?? "",
      info,
      pagar: false,
      ant: forFrist ? v.levert : v.fort,
    });
  }

  // Trekninger uten vurdering: mentorsamtalene, og faglige samtaler som
  // ikke er knyttet til noen vurdering.
  for (const t of trekninger) {
    const v = t.dager.find((d) => d.vurderingId)?.vurderingId;
    if (t.skolearFagId && v && tilVurdering.get(v) === t) continue;
    const mentor = t.skolearFagId === null;
    if (mentor && !harMentor) continue;
    const l = t.dager.flatMap((d) => linjerPerDag.get(d.id) ?? []);
    const fra = t.forste;
    const til = t.siste || t.forste;
    const h = holdt(l, idag, kl);
    const ferdig = l.length > 0 && h >= l.filter((x) => x.motte).length;
    // En samtaletrekning føres ikke: når dagene er passert, er den ferdig.
    const gruppe = gruppeFor(fra, til, idag, ferdig && idag > til, true);
    const inne = gruppe === "na" ? inneNa(l, idag, kl) : undefined;
    const antDager = new Set(t.dager.map((d) => d.dato).filter(Boolean)).size;
    rader.push({
      id: t.skolearFagId ?? "mentor",
      apner: { trekning: t.skolearFagId ?? "mentor" },
      type: mentor ? "mentor" : "muntlig",
      tittel: mentor
        ? MENTORORD.samtaler
        : `Samtaler i ${t.fagKode ?? "faget"}`,
      skolearFagId: t.skolearFagId,
      fagKode: t.fagKode,
      farge: null,
      skalaNavn: null,
      gruppe,
      dato: dagspenn(
        t.dager.map((d) => d.dato),
        idag,
        l,
      ),
      sortering: fra,
      info: inne
        ? `Pågår · ${inne.fornavn} ${inne.etternavn} er inne`
        : gruppe === "kommende"
          ? l.length > 0
            ? `${antDager} ${antDager === 1 ? "dag" : "dager"} · tidsplan trukket`
            : "Ikke trukket ennå"
          : `${antDager} ${antDager === 1 ? "dag" : "dager"} · ${h} av ${l.length} holdt`,
      pagar: !!inne,
      ant: h,
      av: l.length,
      utkast: false,
    });
  }

  // Gruppene i fast rekkefølge; det ferdige nyeste først, resten etter
  // dato, de uten dato sist.
  const orden = Object.keys(GRUPPENAVN);
  return rader.sort(
    (a, b) =>
      orden.indexOf(a.gruppe) - orden.indexOf(b.gruppe) ||
      (a.gruppe === "ferdig"
        ? (b.sortering || "").localeCompare(a.sortering || "")
        : (a.sortering || "9999").localeCompare(b.sortering || "9999")) ||
      a.tittel.localeCompare(b.tittel, "nb"),
  );
}

/** Radene filtrert på type og fag (tom mengde = alle fag). */
export function filtrer(
  rader: Oversiktsrad[],
  type: Oversiktstype | "alle",
  fag: Set<string>,
): Oversiktsrad[] {
  return rader.filter(
    (r) =>
      (type === "alle" || r.type === type) &&
      (fag.size === 0 || (r.skolearFagId !== null && fag.has(r.skolearFagId))),
  );
}
