import { hent, oppdater, settInn, slett } from "../db";
import { varsle } from "./endringer";
import type { Skalaverdi } from "../skala";

/**
 * Økter, SPEC §4.2.
 *
 * Økta er dato + fag. Tema, varighet, plan og logg er innhold, ikke identitet.
 * Ingenting sperrer for to økter i samme fag samme dag — klokkeslettet skiller
 * dem, og i praksis skjer det sjelden.
 */

export type Okt = {
  id: string;
  kode: string | null;
  skolearFagId: string;
  fagKode: string;
  fagNavn: string;
  farge: string | null;
  periodeId: string | null;
  dato: string;
  klokkeslett: string | null;
  varighetMin: number;
  tema: string | null;
  sted: string | null;
  /** kort beskrivelse for eleven; går ut i kalenderen */
  agenda: string | null;
  /** lekse til økta. Står på årsplanarket, går aldri ut i kalenderen. */
  lekse: string | null;
  /** lokal ISO. Brukes som DTSTAMP og til å se hva som faktisk er endret. */
  endret: string;
  plan: string | null;
  logg: string | null;
  /** antall skåringsrader som faktisk finnes */
  skaret: number;
  /** antall elever koblet til faget i år */
  elever: number;
  /** fordelingen av skåringene som teller, til stripa i lista */
  gronn: number;
  gul: number;
  rod: number;
};

export type OktElev = {
  elevId: string;
  fornavn: string;
  etternavn: string;
  kode: string | null;
  /** null = ingen skåringsrad. Vises som 0 hvis økta er avholdt. */
  skalaverdiId: string | null;
  notat: string | null;
};

/**
 * Øktene som ligger innenfor skoleårets spenn.
 *
 * En økt datert før skolestart eller etter skoleslutt blir stående — den
 * vises tonet ned i kalenderen, så du kan se den og rette den. Men den skal
 * ikke telle i timeregnskapet, for da måles planen mot et årstimetall den
 * ikke hører til.
 */
export function innenforAret<T extends { dato: string }>(
  okter: T[],
  start: string,
  slutt: string,
): T[] {
  return okter.filter((o) => o.dato >= start && o.dato <= slutt);
}

export async function hentOkter(skolearId: string): Promise<Okt[]> {
  return hent<Okt>(
    `SELECT o.id,
            o.kode,
            o.skolear_fag_id AS skolearFagId,
            f.kode           AS fagKode,
            f.navn           AS fagNavn,
            f.farge          AS farge,
            o.periode_id     AS periodeId,
            o.dato,
            o.klokkeslett,
            o.varighet_min   AS varighetMin,
            o.tema, o.sted, o.agenda, o.lekse, o.plan, o.logg, o.endret,
            (SELECT COUNT(*) FROM skaring s
              WHERE s.okt_id = o.id AND s.slettet IS NULL) AS skaret,
            (SELECT COUNT(*) FROM skaring s
               JOIN skalaverdi v ON v.id = s.skalaverdi_id
              WHERE s.okt_id = o.id AND s.slettet IS NULL
                AND v.teller_ikke = 0 AND v.farge = 'gronn') AS gronn,
            (SELECT COUNT(*) FROM skaring s
               JOIN skalaverdi v ON v.id = s.skalaverdi_id
              WHERE s.okt_id = o.id AND s.slettet IS NULL
                AND v.teller_ikke = 0 AND v.farge = 'gul') AS gul,
            (SELECT COUNT(*) FROM skaring s
               JOIN skalaverdi v ON v.id = s.skalaverdi_id
              WHERE s.okt_id = o.id AND s.slettet IS NULL
                AND v.teller_ikke = 0 AND v.farge = 'rod') AS rod,
            (SELECT COUNT(*) FROM elev_fag ef
               JOIN elev e ON e.id = ef.elev_id AND e.slettet IS NULL
              WHERE ef.skolear_fag_id = o.skolear_fag_id
                AND ef.slettet IS NULL) AS elever
       FROM okt o
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id AND sf.slettet IS NULL
       JOIN fag f ON f.id = sf.fag_id AND f.slettet IS NULL
      WHERE o.slettet IS NULL AND sf.skolear_id = $1
      ORDER BY o.dato, o.klokkeslett IS NULL, o.klokkeslett`,
    [skolearId],
  );
}

/**
 * Elevlista leses live fra faget, hver gang panelet åpnes. Legges en elev til
 * i MFL1 i november, dukker hen opp i alle MFL1-økter — også de som allerede
 * er skåret, der hen står med 0.
 */
export async function hentOktElever(
  oktId: string,
  skolearFagId: string,
): Promise<OktElev[]> {
  return hent<OktElev>(
    `SELECT e.id        AS elevId,
            e.fornavn, e.etternavn, e.kode,
            s.skalaverdi_id AS skalaverdiId,
            s.notat
       FROM elev_fag ef
       JOIN elev e ON e.id = ef.elev_id AND e.slettet IS NULL
       LEFT JOIN skaring s
              ON s.elev_id = e.id AND s.okt_id = $1 AND s.slettet IS NULL
      WHERE ef.skolear_fag_id = $2 AND ef.slettet IS NULL
      ORDER BY e.fornavn COLLATE NOCASE, e.etternavn COLLATE NOCASE`,
    [oktId, skolearFagId],
  );
}

/** Skåringsskalaen som gjelder for faget. Trafikklyset hvis ingenting er satt. */
export async function hentSkaringsskala(
  skolearFagId: string,
): Promise<Skalaverdi[]> {
  return hent<Skalaverdi>(
    `SELECT v.*
       FROM skolear_fag sf
       JOIN skalaverdi v ON v.skala_id = COALESCE(
              sf.skaringsskala_id, '5ca1a000-0000-4000-8000-000000000001')
      WHERE sf.id = $1
      ORDER BY v.rang`,
    [skolearFagId],
  );
}

/** Lesbar id: YYMM-fagkode-#, der # teller øktene i faget den måneden. */
async function lagOktkode(
  skolearFagId: string,
  fagKode: string,
  dato: string,
): Promise<string> {
  const [ar, maned] = dato.split("-");
  const iManeden = await hent<{ antall: number }>(
    `SELECT COUNT(*) AS antall FROM okt
      WHERE skolear_fag_id = $1 AND slettet IS NULL AND dato LIKE $2`,
    [skolearFagId, `${ar}-${maned}-%`],
  );
  return `${ar.slice(2)}${maned}-${fagKode}-${(iManeden[0]?.antall ?? 0) + 1}`;
}

export async function opprettOkt(
  skolearFagId: string,
  fagKode: string,
  dato: string,
  klokkeslett: string | null,
  varighetMin: number,
): Promise<string> {
  // Fagets standard rom følger med inn i økta, så det ikke må skrives på
  // hver av dem. Endres det på én økt, gjelder det bare den.
  const [fag] = await hent<{ rom: string | null }>(
    "SELECT rom FROM skolear_fag WHERE id = $1",
    [skolearFagId],
  );
  const id = await settInn("okt", {
    skolear_fag_id: skolearFagId,
    dato,
    klokkeslett,
    varighet_min: varighetMin,
    sted: fag?.rom ?? null,
    kode: await lagOktkode(skolearFagId, fagKode, dato),
  });
  varsle();
  return id;
}

export async function endreOkt(
  id: string,
  felter: {
    dato?: string;
    klokkeslett?: string | null;
    varighet_min?: number;
    tema?: string | null;
    sted?: string | null;
    agenda?: string | null;
    lekse?: string | null;
    plan?: string | null;
    logg?: string | null;
    periode_id?: string | null;
  },
): Promise<void> {
  await oppdater("okt", id, felter);
  varsle();
}

export async function slettOkt(id: string): Promise<void> {
  await slett("okt", id);
  varsle();
}

/**
 * Sletter flere økter under ett.
 *
 * Varselet går én gang til slutt, ikke per økt, så ingen lytter laster på
 * nytt midt i en batch.
 */
export async function slettOkter(ider: string[]): Promise<void> {
  if (ider.length === 0) return;
  for (const id of ider) await slett("okt", id);
  varsle();
}

/**
 * Spørsmålet som stilles før økter slettes.
 *
 * Skåringene er det som gjør slettingen alvorlig: en økt kan legges inn
 * igjen, men det elevene fikk registrert er borte fra heatmapet. Derfor
 * står antallet i spørsmålet, ikke bare antall økter.
 */
export function slettetekst(
  valgte: { fagKode: string; dato: string; skaret: number }[],
): string {
  const skaret = valgte.reduce((n, o) => n + o.skaret, 0);
  const hva =
    valgte.length === 1
      ? `Slette økta ${valgte[0].fagKode} ${langDato(valgte[0].dato)}?`
      : `Slette ${valgte.length} økter?`;
  const advarsel =
    skaret > 0
      ? `\n\n${skaret} skåring${skaret === 1 ? "" : "er"} er ført på ` +
        `${valgte.length === 1 ? "den" : "dem"} og forsvinner fra heatmapet.`
      : "";
  return hva + advarsel;
}

/**
 * Økta som tekst å lime inn i Teams.
 *
 * Bare det som er skrevet for eleven blir med: fagkode, når, tema, agenda
 * og lekse.
 * `plan` og `logg` er lærerens egne notater og skal aldri ut — samme
 * feltgrense som kalenderpubliseringen i §8.1, og av samme grunn.
 *
 * Tomme felter utelates helt framfor å stå igjen som tomme linjer.
 */
export function teamstekst(okt: {
  fagKode: string;
  dato: string;
  klokkeslett: string | null;
  tema: string | null;
  agenda: string | null;
  lekse?: string | null;
}): string {
  const nar = okt.klokkeslett
    ? `${langDato(okt.dato)}, ${okt.klokkeslett}`
    : langDato(okt.dato);

  const lekse = okt.lekse?.trim();
  return [
    `${okt.fagKode} — ${nar}`,
    okt.tema?.trim(),
    okt.agenda?.trim(),
    lekse && `Lekse: ${lekse}`,
  ]
    .filter((d) => d && d !== "")
    .join("\n\n");
}

function langDato(dato: string): string {
  return new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Setter skåring. Én rad per elev per økt — skåres på nytt, oppdateres raden.
 *
 * UNIQUE(elev_id, okt_id) gjelder også soft-slettede rader, så en rad som er
 * fjernet med ⌫ gjenbrukes i stedet for at vi setter inn en ny (§12).
 */
export async function settSkaring(
  elevId: string,
  oktId: string,
  skalaverdiId: string,
): Promise<void> {
  const finnes = await hent<{ id: string }>(
    "SELECT id FROM skaring WHERE elev_id = $1 AND okt_id = $2",
    [elevId, oktId],
  );

  if (finnes[0]) {
    await oppdater("skaring", finnes[0].id, {
      skalaverdi_id: skalaverdiId,
      slettet: null,
    });
    return;
  }

  await settInn("skaring", {
    elev_id: elevId,
    okt_id: oktId,
    skalaverdi_id: skalaverdiId,
  });
}

export async function fjernSkaring(
  elevId: string,
  oktId: string,
): Promise<void> {
  const finnes = await hent<{ id: string }>(
    "SELECT id FROM skaring WHERE elev_id = $1 AND okt_id = $2 AND slettet IS NULL",
    [elevId, oktId],
  );
  if (finnes[0]) await slett("skaring", finnes[0].id);
}

export async function settSkaringsnotat(
  elevId: string,
  oktId: string,
  notat: string,
): Promise<void> {
  const finnes = await hent<{ id: string }>(
    "SELECT id FROM skaring WHERE elev_id = $1 AND okt_id = $2 AND slettet IS NULL",
    [elevId, oktId],
  );
  if (finnes[0]) await oppdater("skaring", finnes[0].id, { notat });
}

export type OktVurdering = {
  id: string;
  tittel: string;
  frist: string | null;
  oktId: string | null;
  skolearFagId: string;
};

/**
 * Vurderingene knyttet til øktene i året, til kolonnen i §4.2.
 *
 * En vurdering henger på ei økt på to måter: den er koblet til den direkte
 * (`okt_id`), eller fristen faller på samme dato i samme fag. Den andre er
 * den vanlige — man legger inn en innlevering med frist, ikke en kobling.
 */
export async function hentOktVurderinger(
  skolearId: string,
): Promise<Map<string, OktVurdering[]>> {
  const alle = await hent<OktVurdering>(
    `SELECT v.id, v.tittel, v.frist, v.okt_id AS oktId,
            v.skolear_fag_id AS skolearFagId
       FROM vurdering v
       JOIN skolear_fag sf ON sf.id = v.skolear_fag_id AND sf.slettet IS NULL
      WHERE v.slettet IS NULL AND sf.skolear_id = $1`,
    [skolearId],
  );

  const okter = await hent<{ id: string; dato: string; skolearFagId: string }>(
    `SELECT o.id, o.dato, o.skolear_fag_id AS skolearFagId
       FROM okt o
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id AND sf.slettet IS NULL
      WHERE o.slettet IS NULL AND sf.skolear_id = $1`,
    [skolearId],
  );

  const kart = new Map<string, OktVurdering[]>();
  for (const okt of okter) {
    const treff = alle.filter(
      (v) =>
        v.oktId === okt.id ||
        (v.oktId === null &&
          v.frist === okt.dato &&
          v.skolearFagId === okt.skolearFagId),
    );
    if (treff.length > 0) kart.set(okt.id, treff);
  }
  return kart;
}
