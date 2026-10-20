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
  /** øktene vurderingen holdes i — én, flere, eller ingen */
  oktIder: string[];
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
  /**
   * Notatet fra samtalen. Det bor i elevens møtelogg (`elevnotat` med
   * `samtale_id`), ikke på resultatet — her leses det bare, så det finnes
   * ett sted og ikke to som kan komme i utakt.
   */
  samtalenotat: string | null;
};

export async function hentVurderinger(skolearId: string): Promise<Vurdering[]> {
  const rader = await hent<
    Omit<Vurdering, "oktIder"> & { oktIder: string | null }
  >(
    `SELECT v.id,
            v.skolear_fag_id AS skolearFagId,
            COALESCE(NULLIF(f.alias, ''), f.kode) AS fagKode,
            f.farge          AS farge,
            v.skala_id       AS skalaId,
            sk.navn          AS skalaNavn,
            v.tittel, v.type, v.frist, v.beskrivelse,
            (SELECT group_concat(vo.okt_id) FROM vurdering_okt vo
               JOIN okt o ON o.id = vo.okt_id AND o.slettet IS NULL
              WHERE vo.vurdering_id = v.id AND vo.slettet IS NULL) AS oktIder,
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
  return rader.map((r) => ({ ...r, oktIder: delListe(r.oktIder) }));
}

/** group_concat gir én kommaseparert streng, eller null. */
function delListe(s: string | null): string[] {
  return s ? s.split(",") : [];
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
              LIMIT 1) AS samtaletid,
            -- Samtalenotatet står også når en ny trekning har erstattet
            -- samtaleraden, så slettet-merket på samtalen sjekkes ikke.
            (SELECT n.tekst FROM elevnotat n
               JOIN samtale sa ON sa.id = n.samtale_id
               JOIN samtaledag sd ON sd.id = sa.samtaledag_id
              WHERE sd.vurdering_id = $1 AND n.elev_id = e.id
                AND n.slettet IS NULL AND TRIM(n.tekst) <> ''
              ORDER BY n.endret DESC
              LIMIT 1) AS samtalenotat
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
  const id = await settInn("vurdering", {
    skolear_fag_id: skolearFagId,
    skala_id: skalaId,
    tittel,
    type,
    frist,
  });
  const okt = frist ? await oktPaDato(skolearFagId, frist) : null;
  if (okt) await knyttOkt(id, okt);
  return id;
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

/** Øktene vurderingen er knyttet til nå, med dato. */
async function knyttede(
  vurderingId: string,
): Promise<{ radId: string; oktId: string; dato: string }[]> {
  return hent(
    `SELECT vo.id AS radId, vo.okt_id AS oktId, o.dato
       FROM vurdering_okt vo
       JOIN okt o ON o.id = vo.okt_id AND o.slettet IS NULL
      WHERE vo.vurdering_id = $1 AND vo.slettet IS NULL
      ORDER BY o.dato`,
    [vurderingId],
  );
}

/**
 * Flytter fristen, og økta følger med når det finnes en å følge.
 *
 * Koblingen flyttes bare når den er enkel — ingen økt, eller én økt på den
 * gamle fristdagen — og den nye fristdagen har én økt i faget. En vurdering
 * over flere økter, eller en innlevering som gis ut i én time og leveres en
 * uke senere, beholder øktene sine. Har den nye dagen ingen økt, blir
 * koblingen stående heller enn å forsvinne.
 */
export async function settFrist(
  id: string,
  frist: string | null,
): Promise<void> {
  const [v] = await hent<{ skolearFagId: string; frist: string | null }>(
    "SELECT skolear_fag_id AS skolearFagId, frist FROM vurdering WHERE id = $1",
    [id],
  );
  if (!v) return;
  await oppdater("vurdering", id, { frist });

  const na = await knyttede(id);
  const fulgteFristen =
    na.length === 0 || (na.length === 1 && na[0].dato === v.frist);
  if (!fulgteFristen || !frist) return;

  const ny = await oktPaDato(v.skolearFagId, frist);
  if (!ny) return;
  for (const k of na) await slett("vurdering_okt", k.radId);
  await knyttOkt(id, ny);
}

/**
 * Knytter vurderingen til en økt til. Mangler vurderingen frist, blir øktas
 * dato fristen — ett valg i stedet for to.
 *
 * En koblingsrad som er løst tidligere, gjenbrukes: UNIQUE gjelder også
 * soft-slettede rader (§12).
 */
export async function knyttOkt(
  vurderingId: string,
  oktId: string,
): Promise<void> {
  const [rad] = await hent<{ id: string }>(
    "SELECT id FROM vurdering_okt WHERE vurdering_id = $1 AND okt_id = $2",
    [vurderingId, oktId],
  );
  if (rad) await oppdater("vurdering_okt", rad.id, { slettet: null });
  else
    await settInn("vurdering_okt", {
      vurdering_id: vurderingId,
      okt_id: oktId,
    });

  const [v] = await hent<{ frist: string | null; dato: string }>(
    `SELECT v.frist, o.dato FROM vurdering v, okt o
      WHERE v.id = $1 AND o.id = $2`,
    [vurderingId, oktId],
  );
  if (v && v.frist === null)
    await oppdater("vurdering", vurderingId, { frist: v.dato });
}

/** Løser vurderingen fra én økt. De andre øktene står. */
export async function losOkt(
  vurderingId: string,
  oktId: string,
): Promise<void> {
  const [rad] = await hent<{ id: string }>(
    `SELECT id FROM vurdering_okt
      WHERE vurdering_id = $1 AND okt_id = $2 AND slettet IS NULL`,
    [vurderingId, oktId],
  );
  if (rad) await slett("vurdering_okt", rad.id);
}

/**
 * Ny vurdering rett fra økta (ARBEIDSLISTE 16.9): opprettes i faget med
 * skalaen faget sist brukte (eller den første vurderingsskalaen), knyttes
 * til økta og får økta som frist. Kriterier og vekt redigeres under
 * Vurderinger som før.
 */
export async function nyVurderingIOkt(
  okt: { id: string; skolearFagId: string; dato: string },
  tittel: string,
  type: Vurderingstype | null,
): Promise<string> {
  const [sist] = await hent<{ skalaId: string }>(
    `SELECT skala_id AS skalaId FROM vurdering
      WHERE skolear_fag_id = $1 AND slettet IS NULL
      ORDER BY opprettet DESC LIMIT 1`,
    [okt.skolearFagId],
  );
  const skalaId = sist?.skalaId ?? (await hentVurderingsskalaer())[0]?.id;
  if (!skalaId) throw new Error("Ingen vurderingsskala finnes.");
  const id = await opprettVurdering(
    okt.skolearFagId,
    skalaId,
    tittel.trim() || "Ny vurdering",
    type,
    okt.dato,
  );
  await knyttOkt(id, okt.id);
  return id;
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
  varighetMin: number;
  tema: string | null;
};

/** Øktene i faget, til «Økt»-valget på vurderingen. */
export async function hentOktvalg(skolearFagId: string): Promise<Oktvalg[]> {
  return hent<Oktvalg>(
    `SELECT id, dato, klokkeslett, varighet_min AS varighetMin, tema FROM okt
      WHERE skolear_fag_id = $1 AND slettet IS NULL
      ORDER BY dato, klokkeslett`,
    [skolearFagId],
  );
}

export type Vurderingsvalg = {
  id: string;
  tittel: string;
  oktIder: string[];
};

/** Vurderingene i faget, til «Vurdering»-valget på økta. */
export async function hentVurderingsvalg(
  skolearFagId: string,
): Promise<Vurderingsvalg[]> {
  const rader = await hent<{
    id: string;
    tittel: string;
    oktIder: string | null;
  }>(
    `SELECT v.id, v.tittel,
            (SELECT group_concat(vo.okt_id) FROM vurdering_okt vo
              WHERE vo.vurdering_id = v.id AND vo.slettet IS NULL) AS oktIder
       FROM vurdering v
      WHERE v.skolear_fag_id = $1 AND v.slettet IS NULL
      ORDER BY v.frist IS NULL, v.frist, v.tittel`,
    [skolearFagId],
  );
  return rader.map((r) => ({ ...r, oktIder: delListe(r.oktIder) }));
}
