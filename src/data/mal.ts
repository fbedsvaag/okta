import { hent, Transaksjon } from "../db";
import { varsle, varsleVurderinger } from "./endringer";
import { mandag } from "./kalender";
import { hentOkter, type Okt } from "./okter";
import { hentPeriodemal, hentPerioder, type Periode } from "./perioder";

/**
 * Fjorårets år som mal (ARBEIDSLISTE 20.7).
 *
 * Periodene legges på de samme ukene i år, regnet fra skoleårets første
 * uke: en periode som gikk fra uke 3 til uke 9 i fjor, går fra uke 3 til
 * uke 9 i år og får øktene som ligger der. Har ferier flyttet seg, får den
 * en økt mer eller mindre. Tema, plan og agenda følger øktene i rekkefølge.
 * Vurderinger legges på økta nærmest der de lå i fjor.
 *
 * Ingenting om elevene blir med. Det som legges inn, erstatter årets
 * perioder, og alt kan angres.
 */

export type Fjorvurdering = {
  id: string;
  skalaId: string;
  tittel: string;
  type: string | null;
  beskrivelse: string | null;
  /** datoen den lå på i fjor: første økt, ellers fristen */
  dato: string | null;
};

export type Fjorar = {
  skolearFagId: string;
  navn: string;
  start: string;
  okter: Okt[];
  perioder: Periode[];
  mal: Map<string, string[]>;
  vurderinger: Fjorvurdering[];
};

/** Faget i det siste skoleåret før dette, eller null. */
export async function finnFjoraret(
  skolear: { id: string; start: string },
  fagId: string,
): Promise<Fjorar | null> {
  const [f] = await hent<{
    skolearFagId: string;
    skolearId: string;
    navn: string;
    start: string;
  }>(
    `SELECT sf.id AS skolearFagId, s.id AS skolearId, s.navn, s.start
       FROM skolear_fag sf
       JOIN skolear s ON s.id = sf.skolear_id AND s.slettet IS NULL
      WHERE sf.fag_id = $1 AND sf.slettet IS NULL AND s.start < $2
      ORDER BY s.start DESC LIMIT 1`,
    [fagId, skolear.start],
  );
  if (!f) return null;
  const [okter, perioder, mal, vurderinger] = await Promise.all([
    hentOkter(f.skolearId),
    hentPerioder(f.skolearFagId),
    hentPeriodemal(f.skolearFagId),
    hent<Fjorvurdering>(
      `SELECT v.id, v.skala_id AS skalaId, v.tittel, v.type, v.beskrivelse,
              COALESCE(
                (SELECT MIN(o.dato) FROM vurdering_okt vo
                   JOIN okt o ON o.id = vo.okt_id AND o.slettet IS NULL
                  WHERE vo.vurdering_id = v.id AND vo.slettet IS NULL),
                v.frist) AS dato
         FROM vurdering v
        WHERE v.skolear_fag_id = $1 AND v.slettet IS NULL
        ORDER BY dato`,
      [f.skolearFagId],
    ),
  ]);
  return {
    skolearFagId: f.skolearFagId,
    navn: f.navn,
    start: f.start,
    okter: sorter(okter.filter((o) => o.skolearFagId === f.skolearFagId)),
    perioder,
    mal,
    vurderinger,
  };
}

function sorter(okter: Okt[]): Okt[] {
  return [...okter].sort(
    (a, b) =>
      a.dato.localeCompare(b.dato) ||
      (a.klokkeslett ?? "").localeCompare(b.klokkeslett ?? ""),
  );
}

const ms = (d: string) => Date.parse(`${d}T12:00:00Z`);
const DAG = 86_400_000;

/** Samme uke og ukedag regnet fra skoleårets første uke. */
export function flyttDato(dato: string, fraStart: string, tilStart: string) {
  const uker = Math.round(
    (ms(mandag(dato)) - ms(mandag(fraStart))) / (7 * DAG),
  );
  const ukedag = Math.round((ms(dato) - ms(mandag(dato))) / DAG);
  return new Date(ms(mandag(tilStart)) + (uker * 7 + ukedag) * DAG)
    .toISOString()
    .slice(0, 10);
}

export type Malperiode = {
  periode: Periode;
  fjor: { fra: string; til: string; antall: number };
  /** øktene i år som får perioden */
  okter: Okt[];
};

export type Malplan = {
  perioder: Malperiode[];
  /** fjorårets økt nr. i → årets økt nr. i */
  par: { fra: Okt; til: Okt }[];
  vurderinger: { v: Fjorvurdering; okt: Okt }[];
};

/** Hva malen gir i år, uten å skrive noe. */
export function lagMalplan(fjor: Fjorar, iar: { start: string }, okter: Okt[]) {
  const arets = sorter(okter);
  const brukt = new Set<string>();
  const perioder: Malperiode[] = [];
  for (const p of [...fjor.perioder].sort((a, b) =>
    (a.start ?? "9").localeCompare(b.start ?? "9"),
  )) {
    const egne = fjor.okter.filter((o) => o.periodeId === p.id);
    if (egne.length === 0) continue;
    const fra = egne[0].dato;
    const til = egne[egne.length - 1].dato;
    const a = flyttDato(fra, fjor.start, iar.start);
    const b = flyttDato(til, fjor.start, iar.start);
    const her = arets.filter(
      (o) => o.dato >= a && o.dato <= b && !brukt.has(o.id),
    );
    her.forEach((o) => brukt.add(o.id));
    perioder.push({
      periode: p,
      fjor: { fra, til, antall: egne.length },
      okter: her,
    });
  }

  const par = fjor.okter
    .slice(0, arets.length)
    .map((fra, i) => ({ fra, til: arets[i] }));

  const vurderinger = fjor.vurderinger.flatMap((v) => {
    if (!v.dato || arets.length === 0) return [];
    const mal = ms(flyttDato(v.dato, fjor.start, iar.start));
    const okt = arets.reduce((best, o) =>
      Math.abs(ms(o.dato) - mal) < Math.abs(ms(best.dato) - mal) ? o : best,
    );
    return [{ v, okt }];
  });

  return { perioder, par, vurderinger } satisfies Malplan;
}

export type Malvalg = {
  perioder: boolean;
  mal: boolean;
  tema: boolean;
  vurderinger: boolean;
  plan: boolean;
};

/**
 * Legger malen inn i én transaksjon, og gir en funksjon som angrer alt.
 * Tema, plan og agenda fylles bare der årets økt er tom.
 */
export async function brukMal(
  plan: Malplan,
  fjor: Fjorar,
  skolearFagId: string,
  okter: Okt[],
  arsPerioder: Periode[],
  valg: Malvalg,
): Promise<() => Promise<void>> {
  const t = new Transaksjon();
  const nye: { tabell: string; id: string }[] = [];
  const forOkt = new Map(
    okter.map((o) => [
      o.id,
      { periode_id: o.periodeId, tema: o.tema, plan: o.plan, agenda: o.agenda },
    ]),
  );
  const endret = new Map<string, Record<string, unknown>>();
  const sett = (id: string, felt: Record<string, unknown>) =>
    endret.set(id, { ...(endret.get(id) ?? {}), ...felt });

  if (valg.perioder) {
    for (const p of arsPerioder) t.slett("periode", p.id);
    for (const o of okter) if (o.periodeId) sett(o.id, { periode_id: null });
    plan.perioder.forEach((mp, i) => {
      const id = t.settInn("periode", {
        skolear_fag_id: skolearFagId,
        navn: mp.periode.navn,
        rekkefolge: i + 1,
        farge: mp.periode.farge,
        notat: mp.periode.notat,
        kompetansemal: mp.periode.kompetansemal,
        start: mp.okter[0]?.dato ?? null,
        slutt: mp.okter[mp.okter.length - 1]?.dato ?? null,
      });
      nye.push({ tabell: "periode", id });
      for (const o of mp.okter) sett(o.id, { periode_id: id });
      if (valg.mal)
        for (const kode of fjor.mal.get(mp.periode.id) ?? [])
          nye.push({
            tabell: "periode_kompetansemal",
            id: t.settInn("periode_kompetansemal", { periode_id: id, kode }),
          });
    });
  }

  for (const { fra, til } of plan.par) {
    if (valg.tema && fra.tema && !til.tema) sett(til.id, { tema: fra.tema });
    if (valg.plan) {
      if (fra.plan && !til.plan) sett(til.id, { plan: fra.plan });
      if (fra.agenda && !til.agenda) sett(til.id, { agenda: fra.agenda });
    }
  }
  for (const [id, felt] of endret) t.oppdater("okt", id, felt);

  if (valg.vurderinger)
    for (const { v, okt } of plan.vurderinger) {
      const id = t.settInn("vurdering", {
        skolear_fag_id: skolearFagId,
        skala_id: v.skalaId,
        tittel: v.tittel,
        type: v.type,
        beskrivelse: v.beskrivelse,
        frist: okt.dato,
        // Et forslag til det er bekreftet (§24).
        utkast: 1,
      });
      nye.push({ tabell: "vurdering", id });
      nye.push({
        tabell: "vurdering_okt",
        id: t.settInn("vurdering_okt", { vurdering_id: id, okt_id: okt.id }),
      });
    }

  await t.kjor();
  varsle();
  varsleVurderinger();

  return async () => {
    const a = new Transaksjon();
    for (const n of nye) a.slett(n.tabell, n.id);
    if (valg.perioder)
      for (const p of arsPerioder)
        a.oppdater("periode", p.id, { slettet: null });
    for (const id of endret.keys()) {
      const f = forOkt.get(id);
      if (f) a.oppdater("okt", id, f);
    }
    await a.kjor();
    varsle();
    varsleVurderinger();
  };
}
