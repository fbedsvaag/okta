import { hent, Transaksjon } from "../db";
import type { Skala, Skalaverdi } from "../skala";

/**
 * Egne karakterskalaer (ARBEIDSLISTE §22, lerretet Skalaer, SPEC §5.3).
 *
 * Datamodellen er den som fantes: `skala` og `skalaverdi`, med `kode` som
 * verdien og `etikett` som forklaringen. Rekkefølgen i redigeringen er
 * `rang` (øverst lavest, i tiere). Tast 0 for rang 0 gjelder fortsatt (§5).
 *
 * Reglene når skalaen er brukt (22.6): navn, forklaring, farge og
 * rekkefølge kan endres. En verdi som er brukt — av en skåring eller et
 * vurderingsresultat — kan ikke slettes; resultatene beholder verdien sin.
 * Hele skalaen kan bare slettes når den ikke er brukt i det hele tatt.
 */

export type Redigerbar = {
  /** null = ny verdi */
  id: string | null;
  kode: string;
  etikett: string;
  farge: Skalaverdi["farge"];
  bestatt: number | null;
  teller_ikke: number;
  /** verdien hadde rang 0 (tast 0, «ingenting her»), og beholder det øverst */
  null0?: boolean;
};

export type Skalautkast = {
  id: string | null;
  navn: string;
  bruksomrade: Skala["bruksomrade"];
  verdier: Redigerbar[];
};

export type Mal = "liste" | "pm" | "poeng" | "kopi";

const tom = (kode = ""): Redigerbar => ({
  id: null,
  kode,
  etikett: "",
  farge: null,
  bestatt: null,
  teller_ikke: 0,
});

/** Verdiene en mal begynner med (22.2). Alt kan endres etterpå. */
export function malVerdier(mal: Exclude<Mal, "kopi">, maks = 20): Redigerbar[] {
  if (mal === "pm") {
    const koder = ["1"];
    for (let k = 2; k <= 5; k++) koder.push(`${k}−`, String(k), `${k}+`);
    koder.push("6−", "6");
    return koder.map((k) => ({ ...tom(k), bestatt: k === "1" ? 0 : 1 }));
  }
  if (mal === "poeng")
    return Array.from({ length: Math.max(1, maks) + 1 }, (_, i) =>
      tom(String(i)),
    );
  return [tom(), tom(), tom()];
}

/** En skala gjort om til et utkast, til kopiering eller redigering. */
export function tilUtkast(
  skala: Skala,
  verdier: Skalaverdi[],
  kopi = false,
): Skalautkast {
  return {
    id: kopi ? null : skala.id,
    navn: kopi ? `${skala.navn} (kopi)` : skala.navn,
    bruksomrade: skala.bruksomrade,
    verdier: [...verdier]
      .sort((a, b) => a.rang - b.rang)
      .map((v) => ({
        id: kopi ? null : v.id,
        kode: v.kode,
        etikett: v.etikett ?? "",
        farge: v.farge,
        bestatt: v.bestatt,
        teller_ikke: v.teller_ikke,
        null0: v.rang === 0,
      })),
  };
}

/** Rang etter plass: rang 0 bare for en «ingenting her»-verdi øverst. */
export function rangFor(verdier: Redigerbar[]): number[] {
  return verdier.map((v, i) => (i === 0 && v.null0 ? 0 : (i + 1) * 10));
}

/** Hvor mange ganger hver verdi i skalaen er brukt. */
export async function bruktPerVerdi(
  skalaId: string,
): Promise<Map<string, number>> {
  const rader = await hent<{ id: string; n: number }>(
    `SELECT v.id,
            (SELECT COUNT(*) FROM skaring s
              WHERE s.skalaverdi_id = v.id AND s.slettet IS NULL)
          + (SELECT COUNT(*) FROM vurderingsresultat r
              WHERE r.skalaverdi_id = v.id AND r.slettet IS NULL) AS n
       FROM skalaverdi v
      WHERE v.skala_id = $1 AND v.slettet IS NULL`,
    [skalaId],
  );
  return new Map(rader.map((r) => [r.id, r.n]));
}

/** Hvor skalaen er i bruk: vurderinger og fag som skårer med den. */
export async function bruktSkala(
  skalaId: string,
): Promise<{ vurderinger: number; fag: number; resultater: number }> {
  const [r] = await hent<{ vurderinger: number; fag: number }>(
    `SELECT (SELECT COUNT(*) FROM vurdering
              WHERE skala_id = $1 AND slettet IS NULL) AS vurderinger,
            (SELECT COUNT(*) FROM skolear_fag
              WHERE skaringsskala_id = $1 AND slettet IS NULL) AS fag`,
    [skalaId],
  );
  const verdier = await bruktPerVerdi(skalaId);
  return {
    vurderinger: r?.vurderinger ?? 0,
    fag: r?.fag ?? 0,
    resultater: [...verdier.values()].reduce((s, n) => s + n, 0),
  };
}

export class SkalaFeil extends Error {}

/**
 * Lagrer et utkast i én transaksjon og gir skalaens id. Verdier som er
 * tatt bort, slettes mykt — men aldri en som er brukt (da kastes SkalaFeil
 * og ingenting lagres). Innebygde skalaer kan ikke lagres.
 */
export async function lagreSkala(u: Skalautkast): Promise<string> {
  const navn = u.navn.trim();
  if (!navn) throw new SkalaFeil("Skalaen trenger et navn.");
  const verdier = u.verdier.filter((v) => v.kode.trim());
  if (verdier.length < 2)
    throw new SkalaFeil("En skala trenger minst to verdier.");
  const koder = verdier.map((v) => v.kode.trim().toLocaleLowerCase("nb-NO"));
  if (new Set(koder).size !== koder.length)
    throw new SkalaFeil("To verdier har samme kode.");

  const t = new Transaksjon();
  let id = u.id;
  if (id) {
    const [s] = await hent<{ innebygd: number }>(
      "SELECT innebygd FROM skala WHERE id = $1",
      [id],
    );
    if (s?.innebygd) throw new SkalaFeil("Innebygde skalaer kan ikke endres.");
    t.oppdater("skala", id, { navn, bruksomrade: u.bruksomrade });
    const brukt = await bruktPerVerdi(id);
    const igjen = new Set(verdier.map((v) => v.id).filter(Boolean));
    for (const [vid, n] of brukt) {
      if (igjen.has(vid)) continue;
      if (n > 0)
        throw new SkalaFeil("En verdi som er brukt, kan ikke slettes.");
      t.slett("skalaverdi", vid);
    }
  } else {
    id = t.settInn("skala", {
      navn,
      bruksomrade: u.bruksomrade,
      innebygd: 0,
    });
  }

  const rang = rangFor(verdier);
  verdier.forEach((v, i) => {
    const felt = {
      kode: v.kode.trim(),
      etikett: v.etikett.trim() || null,
      rang: rang[i],
      farge: v.farge,
      bestatt: v.bestatt,
      teller_ikke: v.teller_ikke,
    };
    if (v.id) t.oppdater("skalaverdi", v.id, felt);
    else t.settInn("skalaverdi", { ...felt, skala_id: id });
  });
  await t.kjor();
  return id!;
}

/** Sletter skalaen mykt, bare når den ikke er brukt noe sted. */
export async function slettSkala(skalaId: string): Promise<void> {
  const [s] = await hent<{ innebygd: number }>(
    "SELECT innebygd FROM skala WHERE id = $1",
    [skalaId],
  );
  if (s?.innebygd) throw new SkalaFeil("Innebygde skalaer kan ikke slettes.");
  const b = await bruktSkala(skalaId);
  if (b.vurderinger + b.fag + b.resultater > 0)
    throw new SkalaFeil("Skalaen er brukt og kan ikke slettes.");
  const t = new Transaksjon();
  t.slett("skala", skalaId);
  for (const id of (await bruktPerVerdi(skalaId)).keys())
    t.slett("skalaverdi", id);
  await t.kjor();
}
