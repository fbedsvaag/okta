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
  /** økta vurderingen holdes i. null = ikke knyttet til noen økt */
  oktId: string | null;
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
            v.tittel, v.type, v.frist, v.okt_id AS oktId, v.beskrivelse,
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

/**
 * Økta faget har på en dato — bare når det er nøyaktig én. Er det to økter
 * samme dag, vet ikke appen hvilken, og da gjettes det ikke.
 */
export async function oktPaDato(
  skolearFagId: string,
  dato: string,
): Promise<string | null> {
  const treff = await hent<{ id: string }>(
    `SELECT id FROM okt
      WHERE skolear_fag_id = $1 AND dato = $2 AND slettet IS NULL`,
    [skolearFagId, dato],
  );
  return treff.length === 1 ? treff[0].id : null;
}

/**
 * Oppretter vurderingen. Faller fristen på en dag faget har én økt, knyttes
 * vurderingen til den økta med en gang — det er det vanlige: prøven holdes
 * i timen, og fristen er timen.
 */
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
    okt_id: frist ? await oktPaDato(skolearFagId, frist) : null,
  });
}

export async function endreVurdering(
  id: string,
  felter: {
    tittel?: string;
    type?: Vurderingstype | null;
    beskrivelse?: string | null;
    skala_id?: string;
  },
): Promise<void> {
  await oppdater("vurdering", id, felter);
}

/**
 * Flytter fristen, og økta følger med når det finnes en å følge.
 *
 * Koblingen flyttes bare når den var «økta på fristdagen» (eller mangler),
 * og den nye fristdagen har én økt i faget. Har du knyttet vurderingen til
 * en økt på en annen dag — en innlevering som gis ut i én time og leveres en
 * uke senere — står den koblingen. Og har den nye dagen ingen økt, blir
 * koblingen stående heller enn å forsvinne: panelet viser den, og den kan
 * endres der.
 */
export async function settFrist(
  id: string,
  frist: string | null,
): Promise<void> {
  const [v] = await hent<{
    skolearFagId: string;
    frist: string | null;
    oktDato: string | null;
    oktId: string | null;
  }>(
    `SELECT v.skolear_fag_id AS skolearFagId, v.frist, v.okt_id AS oktId,
            o.dato AS oktDato
       FROM vurdering v
       LEFT JOIN okt o ON o.id = v.okt_id AND o.slettet IS NULL
      WHERE v.id = $1`,
    [id],
  );
  if (!v) return;

  const felter: Record<string, unknown> = { frist };
  const fulgteFristen = v.oktId === null || v.oktDato === v.frist;
  if (fulgteFristen && frist) {
    const ny = await oktPaDato(v.skolearFagId, frist);
    if (ny) felter.okt_id = ny;
  }
  await oppdater("vurdering", id, felter);
}

/**
 * Knytter vurderingen til en økt, eller løser den (null). Mangler
 * vurderingen frist, blir øktas dato fristen — ett valg i stedet for to.
 */
export async function kobleTilOkt(
  vurderingId: string,
  oktId: string | null,
): Promise<void> {
  const felter: Record<string, unknown> = { okt_id: oktId };
  if (oktId) {
    const [rad] = await hent<{ frist: string | null; dato: string }>(
      `SELECT v.frist, o.dato FROM vurdering v, okt o
        WHERE v.id = $1 AND o.id = $2`,
      [vurderingId, oktId],
    );
    if (rad && rad.frist === null) felter.frist = rad.dato;
  }
  await oppdater("vurdering", vurderingId, felter);
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

export type Oktvalg = {
  id: string;
  dato: string;
  klokkeslett: string | null;
  tema: string | null;
};

/** Øktene i faget, til «Økt»-valget på vurderingen. */
export async function hentOktvalg(skolearFagId: string): Promise<Oktvalg[]> {
  return hent<Oktvalg>(
    `SELECT id, dato, klokkeslett, tema FROM okt
      WHERE skolear_fag_id = $1 AND slettet IS NULL
      ORDER BY dato, klokkeslett`,
    [skolearFagId],
  );
}

export type Vurderingsvalg = {
  id: string;
  tittel: string;
  oktId: string | null;
};

/** Vurderingene i faget, til «Vurdering»-valget på økta. */
export async function hentVurderingsvalg(
  skolearFagId: string,
): Promise<Vurderingsvalg[]> {
  return hent<Vurderingsvalg>(
    `SELECT id, tittel, okt_id AS oktId FROM vurdering
      WHERE skolear_fag_id = $1 AND slettet IS NULL
      ORDER BY frist IS NULL, frist, tittel`,
    [skolearFagId],
  );
}
