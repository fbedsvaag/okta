import { hent, oppdater, settInn, slett } from "../db";
import type { Skala, Skalaverdi } from "../skala";

/**
 * Vurderinger, SPEC §3.4 og §4.6.
 *
 * Vurderingen er en oppgave som tilhører faget i et bestemt skoleår.
 * Resultatene henger under, ett per elev.
 */

export type Vurderingstype = "skriftlig" | "muntlig" | "praktisk";

export type Vurdering = {
  id: string;
  skolearFagId: string;
  fagKode: string;
  farge: string | null;
  skalaId: string;
  skalaNavn: string;
  tittel: string;
  type: Vurderingstype | null;
  frist: string | null;
  beskrivelse: string | null;
  /** antall resultater med en skalaverdi satt */
  fort: number;
  /** antall elever koblet til faget */
  elever: number;
};

export type VurderingElev = {
  elevId: string;
  fornavn: string;
  etternavn: string;
  skalaverdiId: string | null;
  levert: number;
  kommentar: string | null;
  /**
   * Oppgaven eleven fikk trukket, når vurderingen har en samtaletrekning
   * knyttet til seg (§4.10). Null når den ikke har det.
   */
  oppgave: string | null;
  /** «24. nov 10:20» — når samtalen var */
  samtaletid: string | null;
};

export async function hentVurderinger(skolearId: string): Promise<Vurdering[]> {
  return hent<Vurdering>(
    `SELECT v.id,
            v.skolear_fag_id AS skolearFagId,
            f.kode           AS fagKode,
            f.farge          AS farge,
            v.skala_id       AS skalaId,
            sk.navn          AS skalaNavn,
            v.tittel, v.type, v.frist, v.beskrivelse,
            (SELECT COUNT(*) FROM vurderingsresultat r
              WHERE r.vurdering_id = v.id AND r.slettet IS NULL
                AND r.skalaverdi_id IS NOT NULL) AS fort,
            (SELECT COUNT(*) FROM elev_fag ef
               JOIN elev e ON e.id = ef.elev_id AND e.slettet IS NULL
              WHERE ef.skolear_fag_id = v.skolear_fag_id
                AND ef.slettet IS NULL) AS elever
       FROM vurdering v
       JOIN skolear_fag sf ON sf.id = v.skolear_fag_id AND sf.slettet IS NULL
       JOIN fag f ON f.id = sf.fag_id AND f.slettet IS NULL
       JOIN skala sk ON sk.id = v.skala_id
      WHERE v.slettet IS NULL AND sf.skolear_id = $1
      ORDER BY v.frist IS NULL, v.frist, v.tittel`,
    [skolearId],
  );
}

/** Som elevlista i en økt: leses live fra faget, ikke lagret på forhånd. */
export async function hentVurderingElever(
  vurderingId: string,
  skolearFagId: string,
): Promise<VurderingElev[]> {
  return hent<VurderingElev>(
    `SELECT e.id AS elevId, e.fornavn, e.etternavn,
            r.skalaverdi_id AS skalaverdiId,
            COALESCE(r.levert, 0) AS levert,
            r.kommentar,
            -- Oppgaven og tidspunktet fra trekningen, hvis vurderingen har
            -- en. Hentet som delspørring og ikke som join: en elev som ikke
            -- møtte og ble satt opp på nytt har to rader, og en join ville
            -- gitt eleven to linjer i vurderingslista.
            (SELECT sa.tema FROM samtale sa
               JOIN samtaledag sd ON sd.id = sa.samtaledag_id
                                 AND sd.slettet IS NULL
              WHERE sd.vurdering_id = $1 AND sa.elev_id = e.id
                AND sa.slettet IS NULL
              ORDER BY sa.motte DESC, sd.dato DESC, sa.klokkeslett DESC
              LIMIT 1) AS oppgave,
            (SELECT sd.dato || ' ' || sa.klokkeslett FROM samtale sa
               JOIN samtaledag sd ON sd.id = sa.samtaledag_id
                                 AND sd.slettet IS NULL
              WHERE sd.vurdering_id = $1 AND sa.elev_id = e.id
                AND sa.slettet IS NULL
              ORDER BY sa.motte DESC, sd.dato DESC, sa.klokkeslett DESC
              LIMIT 1) AS samtaletid
       FROM elev_fag ef
       JOIN elev e ON e.id = ef.elev_id AND e.slettet IS NULL
       LEFT JOIN vurderingsresultat r
              ON r.elev_id = e.id AND r.vurdering_id = $1 AND r.slettet IS NULL
      WHERE ef.skolear_fag_id = $2 AND ef.slettet IS NULL
      ORDER BY e.fornavn COLLATE NOCASE, e.etternavn COLLATE NOCASE`,
    [vurderingId, skolearFagId],
  );
}

export async function hentVurderingsskalaer(): Promise<Skala[]> {
  return hent<Skala>(
    `SELECT id, navn, bruksomrade, innebygd FROM skala
      WHERE slettet IS NULL AND bruksomrade IN ('vurdering', 'begge')
      ORDER BY navn`,
  );
}

export async function hentSkalaverdier(skalaId: string): Promise<Skalaverdi[]> {
  return hent<Skalaverdi>(
    "SELECT * FROM skalaverdi WHERE skala_id = $1 ORDER BY rang",
    [skalaId],
  );
}

export async function opprettVurdering(
  skolearFagId: string,
  skalaId: string,
  tittel: string,
  type: Vurderingstype | null,
  frist: string | null,
): Promise<string> {
  return settInn("vurdering", {
    skolear_fag_id: skolearFagId,
    skala_id: skalaId,
    tittel,
    type,
    frist,
  });
}

export async function endreVurdering(
  id: string,
  felter: {
    tittel?: string;
    type?: Vurderingstype | null;
    frist?: string | null;
    beskrivelse?: string | null;
    skala_id?: string;
  },
): Promise<void> {
  await oppdater("vurdering", id, felter);
}

export async function slettVurdering(id: string): Promise<void> {
  await slett("vurdering", id);
}

async function finnResultat(
  vurderingId: string,
  elevId: string,
): Promise<string | null> {
  const rader = await hent<{ id: string }>(
    "SELECT id FROM vurderingsresultat WHERE vurdering_id = $1 AND elev_id = $2",
    [vurderingId, elevId],
  );
  return rader[0]?.id ?? null;
}

/**
 * Setter resultat for én elev.
 *
 * `levert` settes med: en verdi med rang over 0 betyr at eleven leverte noe.
 * Rang 0 — "ikke levert" — betyr det motsatte. Brukeren kan overstyre etterpå.
 *
 * UNIQUE(vurdering_id, elev_id) gjelder også soft-slettede rader, så raden
 * gjenbrukes i stedet for at vi setter inn en ny (§12).
 */
export async function settResultat(
  vurderingId: string,
  elevId: string,
  skalaverdi: Skalaverdi,
): Promise<void> {
  const id = await finnResultat(vurderingId, elevId);
  const felter = {
    skalaverdi_id: skalaverdi.id,
    levert: skalaverdi.rang > 0 ? 1 : 0,
    slettet: null,
  };

  if (id) await oppdater("vurderingsresultat", id, felter);
  else
    await settInn("vurderingsresultat", {
      vurdering_id: vurderingId,
      elev_id: elevId,
      ...felter,
    });
}

export async function fjernResultat(
  vurderingId: string,
  elevId: string,
): Promise<void> {
  const id = await finnResultat(vurderingId, elevId);
  if (id) await slett("vurderingsresultat", id);
}

export async function settLevert(
  vurderingId: string,
  elevId: string,
  levert: boolean,
): Promise<void> {
  const id = await finnResultat(vurderingId, elevId);
  if (id) await oppdater("vurderingsresultat", id, { levert: levert ? 1 : 0 });
  else
    await settInn("vurderingsresultat", {
      vurdering_id: vurderingId,
      elev_id: elevId,
      levert: levert ? 1 : 0,
    });
}

export async function settKommentar(
  vurderingId: string,
  elevId: string,
  kommentar: string,
): Promise<void> {
  const id = await finnResultat(vurderingId, elevId);
  if (id) await oppdater("vurderingsresultat", id, { kommentar });
  else
    await settInn("vurderingsresultat", {
      vurdering_id: vurderingId,
      elev_id: elevId,
      kommentar,
    });
}
