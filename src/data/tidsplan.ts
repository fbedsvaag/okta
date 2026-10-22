import { leggUtDagen, tilKlokke, tilMin } from "./samtale";

/**
 * Tidsplangeneratoren (ARBEIDSLISTE 28.2b): elevene i en rekkefølge lagt ut
 * på dagene, med minutter per elev, pause og lunsj. Brukes av muntlig
 * vurdering og mentorsamtalene (29.6). Selve utleggingen av en dag er
 * samtaletrekkerens `leggUtDagen` — samme kode, ikke en kopi.
 *
 * Dagene har ingen sluttid her: elevene fordeles jevnt, og dagen slutter
 * når den siste er ferdig. Det er det «ferdig 12:58» i oppsummeringen sier.
 */

export type Tidsplandag = {
  id: string;
  dato: string;
  fra: string;
  lunsjFra: string | null;
  lunsjMin: number | null;
};

export type Tidsplanrad = { elevId: string; fra: string; til: string };

export type Utlagtdag = {
  dag: Tidsplandag;
  rader: Tidsplanrad[];
  lunsj: { fra: string; til: string } | null;
  /** når den siste er ferdig; null når dagen er tom */
  slutt: string | null;
};

/** Så jevnt som mulig: de første dagene får én ekstra når det ikke går opp. */
export function fordelJevnt(antall: number, dager: number): number[] {
  if (dager <= 0) return [];
  const grunn = Math.floor(antall / dager);
  const rest = antall % dager;
  return Array.from({ length: dager }, (_, i) => grunn + (i < rest ? 1 : 0));
}

export function leggUtTidsplan(
  rekkefolge: string[],
  dager: Tidsplandag[],
  perElev: number,
  pause: number,
): Utlagtdag[] {
  const antall = fordelJevnt(rekkefolge.length, dager.length);
  let i = 0;
  return dager.map((dag, d) => {
    const elever = rekkefolge.slice(i, i + antall[d]);
    i += antall[d];
    const slots = leggUtDagen(
      {
        fra: dag.fra,
        til: "23:59",
        // En dag som begynner etter lunsj, har ingen lunsj i seg.
        lunsjFra:
          dag.lunsjFra && tilMin(dag.lunsjFra) > tilMin(dag.fra)
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
    return {
      dag,
      rader,
      lunsj,
      slutt: rader.length ? rader[rader.length - 1].til : null,
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
