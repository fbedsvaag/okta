import { hent, oppdater, settInn, slett } from "../db";

/**
 * Fagbanken er uavhengig av skoleår. `skolear_fag` er faget slik det ser ut i
 * ett bestemt år, og det er den alt undervisningsnært henger på (SPEC §3.2).
 *
 * FagIAr er de to slått sammen til det UI-et trenger: én rad per fag du har
 * i år, med både bank-id og års-id.
 */
export type FagIAr = {
  /** skolear_fag.id — den alt annet peker på */
  id: string;
  /** fag.id — banken */
  fagId: string;
  /** det faget kalles: aliaset hvis det finnes, ellers koden */
  kode: string;
  /** fagets egen kode i banken, f.eks. SAM3045 — uansett alias */
  fagkode: string;
  navn: string;
  farge: string | null;
  arstimetall: number | null;
  /** offisiell fagkode fra Udir, f.eks. MFL1001. Fritekst i v1 (§10). */
  grepKode: string | null;
  /** kallenavn, f.eks. «MFL1» for SAM3045. Brukes i søket. */
  alias: string | null;
  standardVarighetMin: number | null;
  /** standard rom; forhåndsutfyller `okt.sted` */
  rom: string | null;
  /** faglærer. null = lærernavnet fra innstillingene */
  laerer: string | null;
  /** kompetansemål som fritekst, for fag uten Udir-kode */
  kompetansemal: string | null;
  /** fritekst øverst på årsplanarket */
  arknotat: string | null;
};

export type Fag = {
  id: string;
  kode: string;
  navn: string;
  farge: string | null;
};

/** Trafikklyset, seedet i migrasjon 002. */
const TRAFIKKLYS = "5ca1a000-0000-4000-8000-000000000001";

export async function hentFagbank(): Promise<Fag[]> {
  return hent<Fag>(
    "SELECT id, kode, navn, farge FROM fag WHERE slettet IS NULL ORDER BY kode",
  );
}

export async function hentFagIAr(skolearId: string): Promise<FagIAr[]> {
  return hent<FagIAr>(
    `SELECT sf.id            AS id,
            f.id             AS fagId,
            -- Det læreren kaller faget: aliaset, ellers koden. Den offisielle
            -- koden står i fagkode, der den trengs (øktkoder, redigering).
            COALESCE(NULLIF(f.alias, ''), f.kode) AS kode,
            f.kode           AS fagkode,
            f.navn           AS navn,
            f.farge          AS farge,
            f.grep_kode      AS grepKode,
            f.alias          AS alias,
            sf.arstimetall   AS arstimetall,
            sf.standard_varighet_min AS standardVarighetMin,
            sf.rom, sf.laerer, sf.kompetansemal, sf.arknotat
       FROM skolear_fag sf
       JOIN fag f ON f.id = sf.fag_id AND f.slettet IS NULL
      WHERE sf.skolear_id = $1 AND sf.slettet IS NULL
      ORDER BY f.kode`,
    [skolearId],
  );
}

/**
 * Oppretter faget i banken hvis koden ikke finnes fra før, og kobler det til
 * skoleåret. Kaller man to ganger med samme kode, gjenbrukes bankfaget.
 */
export async function leggFagIAr(
  skolearId: string,
  kode: string,
  navn: string,
  farge: string | null,
  grepKode?: string | null,
  arstimetall?: number | null,
): Promise<string> {
  const fagId = await finnEllerOpprettFag(kode, navn, farge);
  // Fagkoden fra Udir er nøkkelen til kompetansemålene (§10). Den settes her
  // og ikke i finnEllerOpprettFag, som også brukes av lim-inn-veien der
  // ingen har valgt et fag fra lista.
  if (grepKode) await oppdater("fag", fagId, { grep_kode: grepKode });

  const finnes = await hent<{ id: string; slettet: string | null }>(
    "SELECT id, slettet FROM skolear_fag WHERE skolear_id = $1 AND fag_id = $2",
    [skolearId, fagId],
  );

  // En soft-slettet rad opptar fortsatt plassen i UNIQUE-indeksen, så den
  // gjenbrukes i stedet for at vi prøver å sette inn en ny (§12).
  if (finnes[0]) {
    if (finnes[0].slettet) {
      await oppdater("skolear_fag", finnes[0].id, { slettet: null });
    }
    return finnes[0].id;
  }

  // Årstimetallet hører til året, ikke til fagbanken — det kan være et annet
  // neste gang faget undervises (§3.2).
  return settInn("skolear_fag", {
    skolear_id: skolearId,
    fag_id: fagId,
    skaringsskala_id: TRAFIKKLYS,
    arstimetall: arstimetall ?? null,
  });
}

async function finnEllerOpprettFag(
  kode: string,
  navn: string,
  farge: string | null,
): Promise<string> {
  const finnes = await hent<{ id: string }>(
    "SELECT id FROM fag WHERE kode = $1 AND slettet IS NULL",
    [kode],
  );
  if (finnes[0]) return finnes[0].id;

  return settInn("fag", { kode, navn, farge });
}

/** Endrer faget i banken. Slår gjennom på alle skoleår faget brukes i. */
export async function endreFag(
  fagId: string,
  felter: Partial<Pick<Fag, "kode" | "navn" | "farge">> & {
    grep_kode?: string | null;
    alias?: string | null;
  },
): Promise<void> {
  await oppdater("fag", fagId, felter);
}

/**
 * Endrer faget for dette skoleåret alene. Årstimetall og standard varighet
 * kan være noe annet neste år uten at bankfaget røres.
 */
export async function endreFagIAr(
  skolearFagId: string,
  felter: {
    arstimetall?: number | null;
    standard_varighet_min?: number | null;
    rom?: string | null;
    laerer?: string | null;
    kompetansemal?: string | null;
    arknotat?: string | null;
  },
): Promise<void> {
  // Nytt standard rom gjelder også øktene som finnes: de uten rom, og de som
  // hadde det gamle standardrommet. Et rom satt for hånd på én økt står.
  let gammeltRom: string | null = null;
  if (felter.rom !== undefined) {
    const [f] = await hent<{ rom: string | null }>(
      "SELECT rom FROM skolear_fag WHERE id = $1",
      [skolearFagId],
    );
    gammeltRom = f?.rom ?? null;
  }

  await oppdater("skolear_fag", skolearFagId, felter);

  if (felter.rom !== undefined && felter.rom !== gammeltRom) {
    const okter = await hent<{ id: string }>(
      `SELECT id FROM okt
        WHERE skolear_fag_id = $1 AND slettet IS NULL
          AND (sted IS NULL OR sted = '' OR sted = $2)`,
      [skolearFagId, gammeltRom ?? ""],
    );
    for (const o of okter) await oppdater("okt", o.id, { sted: felter.rom });
  }
}

/** Fjerner faget fra skoleåret. Bankfaget og elevkoblingene blir stående. */
export async function fjernFagFraAr(skolearFagId: string): Promise<void> {
  await slett("skolear_fag", skolearFagId);
}

// --------------------------------------------------------------- opprydding

export type Omfang = {
  ar: number;
  okter: number;
  skaringer: number;
  perioder: number;
  vurderinger: number;
  elevkoblinger: number;
};

/** Hva en sletting av faget vil ta med seg, på tvers av alle skoleår. */
export async function tellForFag(fagId: string): Promise<Omfang> {
  const [r] = await hent<Omfang>(
    `WITH sf AS (
       SELECT id FROM skolear_fag WHERE fag_id = $1 AND slettet IS NULL
     )
     SELECT
       (SELECT COUNT(*) FROM sf) AS ar,
       (SELECT COUNT(*) FROM okt WHERE skolear_fag_id IN (SELECT id FROM sf)
          AND slettet IS NULL) AS okter,
       (SELECT COUNT(*) FROM skaring s JOIN okt o ON o.id = s.okt_id
         WHERE o.skolear_fag_id IN (SELECT id FROM sf)
           AND s.slettet IS NULL AND o.slettet IS NULL) AS skaringer,
       (SELECT COUNT(*) FROM periode WHERE skolear_fag_id IN (SELECT id FROM sf)
          AND slettet IS NULL) AS perioder,
       (SELECT COUNT(*) FROM vurdering WHERE skolear_fag_id IN (SELECT id FROM sf)
          AND slettet IS NULL) AS vurderinger,
       (SELECT COUNT(*) FROM elev_fag WHERE skolear_fag_id IN (SELECT id FROM sf)
          AND slettet IS NULL) AS elevkoblinger`,
    [fagId],
  );
  return r;
}

/**
 * Sletter faget fra fagbanken, med alt som henger under i alle skoleår.
 *
 * Dette er noe annet enn `fjernFagFraAr`, som bare tar faget ut av ett år og
 * lar øktene stå. Her forsvinner øktene, periodene, vurderingene og
 * skåringene også.
 *
 * Elevene røres ikke — de lever på tvers av fag og år (§3.2).
 */
export async function slettFagHelt(fagId: string): Promise<void> {
  const arene = await hent<{ id: string }>(
    "SELECT id FROM skolear_fag WHERE fag_id = $1 AND slettet IS NULL",
    [fagId],
  );

  for (const sf of arene) {
    const okter = await hent<{ id: string }>(
      "SELECT id FROM okt WHERE skolear_fag_id = $1 AND slettet IS NULL",
      [sf.id],
    );
    for (const o of okter) {
      const sk = await hent<{ id: string }>(
        "SELECT id FROM skaring WHERE okt_id = $1 AND slettet IS NULL",
        [o.id],
      );
      for (const s of sk) await slett("skaring", s.id);
      await slett("okt", o.id);
    }

    const vurderinger = await hent<{ id: string }>(
      "SELECT id FROM vurdering WHERE skolear_fag_id = $1 AND slettet IS NULL",
      [sf.id],
    );
    for (const v of vurderinger) {
      const res = await hent<{ id: string }>(
        "SELECT id FROM vurderingsresultat WHERE vurdering_id = $1 AND slettet IS NULL",
        [v.id],
      );
      for (const r of res) await slett("vurderingsresultat", r.id);
      await slett("vurdering", v.id);
    }

    for (const tabell of ["periode", "elev_fag", "elevnotat"]) {
      const rader = await hent<{ id: string }>(
        `SELECT id FROM ${tabell} WHERE skolear_fag_id = $1 AND slettet IS NULL`,
        [sf.id],
      );
      for (const r of rader) await slett(tabell, r.id);
    }

    await slett("skolear_fag", sf.id);
  }

  await slett("fag", fagId);
}
