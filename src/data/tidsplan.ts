import {
  endreSamtaledag,
  hentSamtaler,
  kapasitet,
  lagreTrekning,
  leggUtDagen,
  tiderITrekning,
  tilKlokke,
  tilMin,
  type Samtale,
  type Samtaledag,
} from "./samtale";

/**
 * Tidsplangeneratoren (ARBEIDSLISTE 28.2b): elevene i en rekkefølge lagt ut
 * på dagene, med minutter per elev, pause og lunsj. Brukes av muntlig
 * vurdering og mentorsamtalene (29.6). Selve utleggingen av en dag er
 * samtaletrekkerens `leggUtDagen` — samme kode, ikke en kopi.
 *
 * En egen dag har ingen sluttid: elevene fordeles jevnt, og dagen slutter
 * når den siste er ferdig («ferdig 12:58» i oppsummeringen). En dag i en
 * økt har øktas start og slutt som ramme: den tar ikke flere enn det er
 * plass til, og resten går til de andre dagene. Får ikke alle plass, står
 * de på den siste dagen, og `forMange` sier fra.
 */

export type Tidsplandag = {
  id: string;
  dato: string;
  fra: string;
  lunsjFra: string | null;
  lunsjMin: number | null;
  /** økta dagen ligger i; da er `til` øktas slutt og en grense */
  oktId?: string | null;
  til?: string;
};

export type Tidsplanrad = { elevId: string; fra: string; til: string };

export type Utlagtdag = {
  dag: Tidsplandag;
  rader: Tidsplanrad[];
  lunsj: { fra: string; til: string } | null;
  /** når den siste er ferdig; null når dagen er tom */
  slutt: string | null;
  /** hvor mange som går over øktas slutt (bare dager i en økt) */
  forMange: number;
};

/** Så jevnt som mulig: de første dagene får én ekstra når det ikke går opp. */
export function fordelJevnt(antall: number, dager: number): number[] {
  if (dager <= 0) return [];
  const grunn = Math.floor(antall / dager);
  const rest = antall % dager;
  return Array.from({ length: dager }, (_, i) => grunn + (i < rest ? 1 : 0));
}

/**
 * Hvor mange hver dag får. Dagene i en økt tar høyst det det er plass til;
 * de andre deler resten jevnt. Er alle dagene økter og det ikke er plass,
 * får den siste resten.
 */
export function fordelPaTidsplan(
  antall: number,
  dager: Tidsplandag[],
  perElev: number,
  pause: number,
): number[] {
  if (dager.length === 0) return [];
  const kap = dager.map((d) =>
    d.oktId && d.til
      ? kapasitet(
          { fra: d.fra, til: d.til, lunsjFra: null, lunsjMin: null },
          perElev,
          pause,
        )
      : Infinity,
  );
  const ut = fordelJevnt(antall, dager.length);
  // Det økta ikke har plass til, flyttes til de egne dagene.
  let rest = 0;
  for (let i = 0; i < ut.length; i++)
    if (ut[i] > kap[i]) {
      rest += ut[i] - kap[i];
      ut[i] = kap[i];
    }
  const egne = kap
    .map((k, i) => (k === Infinity ? i : -1))
    .filter((i) => i >= 0);
  if (egne.length > 0) {
    const pluss = fordelJevnt(rest, egne.length);
    egne.forEach((i, j) => (ut[i] += pluss[j]));
  } else {
    // Bare økter: fyll ledig plass i rekkefølge, resten på den siste.
    for (let i = 0; i < ut.length && rest > 0; i++) {
      const ledig = Math.max(0, kap[i] - ut[i]);
      const n = Math.min(ledig, rest);
      ut[i] += n;
      rest -= n;
    }
    ut[ut.length - 1] += rest;
  }
  return ut;
}

export function leggUtTidsplan(
  rekkefolge: string[],
  dager: Tidsplandag[],
  perElev: number,
  pause: number,
): Utlagtdag[] {
  const antall = fordelPaTidsplan(rekkefolge.length, dager, perElev, pause);
  let i = 0;
  return dager.map((dag, d) => {
    const elever = rekkefolge.slice(i, i + antall[d]);
    i += antall[d];
    const slots = leggUtDagen(
      {
        fra: dag.fra,
        til: "23:59",
        // En dag som begynner etter lunsj, eller ligger i en økt, har ingen
        // lunsj i seg.
        lunsjFra:
          !dag.oktId && dag.lunsjFra && tilMin(dag.lunsjFra) > tilMin(dag.fra)
            ? dag.lunsjFra
            : null,
        lunsjMin: dag.lunsjMin,
      },
      elever.length,
      perElev,
      pause,
    );
    const rader: Tidsplanrad[] = [];
    let lunsj: Utlagtdag["lunsj"] = null;
    for (const s of slots) {
      if (s.type === "lunsj")
        lunsj = { fra: tilKlokke(s.fra), til: tilKlokke(s.til) };
      else
        rader.push({
          elevId: elever[s.plass],
          fra: tilKlokke(s.fra),
          til: tilKlokke(s.til),
        });
    }
    const forMange =
      dag.oktId && dag.til
        ? rader.filter((r) => tilMin(r.til) > tilMin(dag.til!)).length
        : 0;
    return {
      dag,
      rader,
      lunsj,
      slutt: rader.length ? rader[rader.length - 1].til : null,
      forMange,
    };
  });
}

/** Flytter ett element i lista; tidene regnes ut på nytt etterpå. */
export function flytt<T>(liste: T[], fra: number, til: number): T[] {
  const ut = [...liste];
  const [x] = ut.splice(fra, 1);
  ut.splice(til, 0, x);
  return ut;
}

/** «14 elever · ferdig 12:58» — eller med flere dager, siste dags slutt. */
export function oppsummering(utlagt: Utlagtdag[]): string {
  const n = utlagt.reduce((s, d) => s + d.rader.length, 0);
  const slutt = [...utlagt].reverse().find((d) => d.slutt)?.slutt;
  return `${n} ${n === 1 ? "elev" : "elever"}${slutt ? ` · ferdig ${slutt}` : ""}`;
}

/** Hvor langt ut i samtalen klokka er, 0–1; null når den ikke pågår. */
export function framdrift(
  rad: { fra: string; til: string },
  dato: string,
  naa: Date,
): number | null {
  const p = (n: number) => String(n).padStart(2, "0");
  const idag = `${naa.getFullYear()}-${p(naa.getMonth() + 1)}-${p(naa.getDate())}`;
  if (dato !== idag) return null;
  const m = naa.getHours() * 60 + naa.getMinutes() + naa.getSeconds() / 60;
  const fra = tilMin(rad.fra);
  const til = tilMin(rad.til);
  if (m < fra || m >= til) return null;
  return (m - fra) / (til - fra);
}

// ------------------------------------------------------------------ basen

/** Tidsplanen slik den står i basen, for en serie samtaledager. */
export type Lesttidsplan = {
  /** elev → samtalen (den der eleven møtte, om det finnes flere) */
  samtale: Map<string, Samtale>;
  /** rekkefølgen: planen først, elevene som mangler i den, alfabetisk sist */
  rekke: string[];
  harPlan: boolean;
  /** minutter og pause slik planen er lagt ut, når det finnes en */
  tider: { minutter: number; pause: number } | null;
};

export async function lesTidsplan(
  dager: Samtaledag[],
  elever: { elevId: string; fornavn: string }[],
): Promise<Lesttidsplan> {
  const alle = (await Promise.all(dager.map((d) => hentSamtaler(d.id))))
    .map((s, i) => s.map((x) => ({ x, dato: dager[i].dato })))
    .flat()
    .sort(
      (a, b) =>
        a.dato.localeCompare(b.dato) ||
        a.x.klokkeslett.localeCompare(b.x.klokkeslett),
    );
  const tider = tiderITrekning(
    dager.map((d) =>
      alle
        .filter(({ x }) => x.samtaledagId === d.id)
        .map(({ x }) => ({
          fra: x.klokkeslett,
          til: tilKlokke(tilMin(x.klokkeslett) + x.varighetMin),
        })),
    ),
  );
  const samtale = new Map<string, Samtale>();
  for (const { x } of alle) {
    const f = samtale.get(x.elevId);
    if (!f || (!f.motte && x.motte)) samtale.set(x.elevId, x);
  }
  const med = new Set(elever.map((e) => e.elevId));
  const rekke = [
    ...new Set(alle.map(({ x }) => x.elevId).filter((id) => med.has(id))),
  ];
  for (const e of [...elever].sort((a, b) =>
    a.fornavn.localeCompare(b.fornavn, "nb"),
  ))
    if (!rekke.includes(e.elevId)) rekke.push(e.elevId);
  return { samtale, rekke, harPlan: alle.length > 0, tider };
}

/** Skriver rekkefølgen ut på dagene, med samtaletrekkerens lagring. */
export async function skrivTidsplan(
  rekke: string[],
  dager: Tidsplandag[],
  min: number,
  pause: number,
  tema: (elevId: string) => string | null,
): Promise<void> {
  for (const d of leggUtTidsplan(rekke, dager, min, pause)) {
    await lagreTrekning(
      d.dag.id,
      d.rader.map((r) => ({
        elevId: r.elevId,
        klokkeslett: r.fra,
        varighetMin: min,
        tema: tema(r.elevId),
      })),
    );
    // En dag i en økt beholder øktas slutt.
    if (!d.dag.oktId)
      await endreSamtaledag(d.dag.id, { til: d.slutt ?? d.dag.fra });
  }
}
