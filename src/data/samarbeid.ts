import {
  endreKart,
  hentKart,
  hentKildeElever,
  hentOppsett,
  hentRom,
  plasserIRom,
  type Kart,
  type Oppsett,
} from "./klassekart";
import { makkere } from "./fordeling";

/**
 * Samarbeid på elevkortet (ARBEIDSLISTE §26, lerretet ElevSamarbeid): hvem
 * eleven har vært i gruppe med, og hvem hen har sittet ved (samme pult),
 * per fag. Alt regnes ut fra historikken (`oppsett`); ingenting nytt lagres.
 *
 * Bare for læreren: dette går aldri ut i eksport, utskrift, Teams eller
 * samtaler. Ingen av de modulene importerer denne filen (testet).
 */

export type Hendelse = {
  type: "gruppe" | "sidemann";
  /** navnet på settet, eller null */
  navn: string | null;
  /** når settet ble brukt, lokal ISO */
  tid: string;
};

export type Kilde = "begge" | "grupper" | "sidemann";

/**
 * Hendelsene per klassekamerat: samme gruppe i et gruppesett, eller
 * makkere i en plassering (ved siden av hverandre, vannrett — se
 * `makkere`). `makkerpar`: «a|b» for plassnumrene som er makkere.
 */
export function samarbeidFra(
  oppsett: { type: "gruppe" | "plass"; o: Oppsett }[],
  elevId: string,
  makkerpar: Set<string>,
): Map<string, Hendelse[]> {
  const ut = new Map<string, Hendelse[]>();
  const legg = (id: string, h: Hendelse) =>
    ut.set(id, [...(ut.get(id) ?? []), h]);
  for (const { type, o } of oppsett) {
    const min = o.rader.find((r) => r.elevId === elevId);
    if (!min) continue;
    for (const r of o.rader) {
      if (r.elevId === elevId) continue;
      if (type === "gruppe" && min.gruppe !== null && r.gruppe === min.gruppe)
        legg(r.elevId, { type: "gruppe", navn: o.navn, tid: o.tid });
      if (
        type === "plass" &&
        min.plass &&
        r.plass &&
        (makkerpar.has(`${min.plass}|${r.plass}`) ||
          makkerpar.has(`${r.plass}|${min.plass}`))
      )
        legg(r.elevId, { type: "sidemann", navn: o.navn, tid: o.tid });
    }
  }
  for (const l of ut.values()) l.sort((a, b) => b.tid.localeCompare(a.tid));
  return ut;
}

/** Bare hendelsene av den valgte typen. */
export function filtrer(h: Hendelse[], kilde: Kilde): Hendelse[] {
  if (kilde === "begge") return h;
  return h.filter((x) =>
    kilde === "grupper" ? x.type === "gruppe" : x.type === "sidemann",
  );
}

export type Samarbeid = {
  kart: Kart;
  kamerater: { id: string; fornavn: string; etternavn: string }[];
  hendelser: Map<string, Hendelse[]>;
};

/**
 * Samarbeidet i hvert kart eleven er med i — fag, klasse og mentorgruppe,
 * også de skjulte gruppekartene.
 */
export async function hentSamarbeid(
  elevId: string,
  skolearId: string,
): Promise<Samarbeid[]> {
  const [kartene, rommene] = await Promise.all([
    hentKart(skolearId, true),
    hentRom(),
  ]);
  const ut: Samarbeid[] = [];
  for (const k of kartene) {
    const elever = await hentKildeElever(k.kildeType, k.kildeId, skolearId);
    if (!elever.some((e) => e.id === elevId)) continue;
    const rom = rommene.find((r) => r.id === k.romId);
    const makkerpar = new Set(
      makkere(plasserIRom(rom?.deler ?? [])).map(([a, b]) => `${a}|${b}`),
    );
    const [g, p] = await Promise.all([
      hentOppsett(k.id, "gruppe"),
      hentOppsett(k.id, "plass"),
    ]);
    ut.push({
      kart: k,
      kamerater: elever
        .filter((e) => e.id !== elevId)
        .map((e) => ({ id: e.id, fornavn: e.fornavn, etternavn: e.etternavn })),
      hendelser: samarbeidFra(
        [
          ...g.map((o) => ({ type: "gruppe" as const, o })),
          ...p.map((o) => ({ type: "plass" as const, o })),
        ],
        elevId,
        makkerpar,
      ),
    });
  }
  return ut.sort((a, b) =>
    a.kart.kildeNavn.localeCompare(b.kart.kildeNavn, "nb-NO"),
  );
}

/**
 * «Sett sammen neste gang» (26.3): ønsket lagres i kartets innstillinger
 * og brukes som myk regel ved neste Stokk i faget.
 */
export async function settSammenNeste(
  kart: Kart,
  elevId: string,
  med: string[],
): Promise<void> {
  const settSammen = { ...(kart.innstillinger.settSammen ?? {}) };
  if (med.length === 0) delete settSammen[elevId];
  else settSammen[elevId] = med;
  await endreKart(kart.id, {
    innstillinger: { ...kart.innstillinger, settSammen },
  });
}
