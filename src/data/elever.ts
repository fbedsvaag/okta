import { hent, oppdater, settInn, slett } from "../db";
import { lagElevkode } from "./elevkode";
import type { EksisterendeElev } from "../import/duplikat";

export type Klasse = {
  id: string;
  navn: string;
  antall: number;
};

export type ElevRad = {
  id: string;
  kode: string | null;
  fornavn: string;
  etternavn: string;
  klasseId: string | null;
  klasseNavn: string | null;
  /** skolear_fag-id-ene eleven er koblet til i året */
  fagIder: string[];
  /** fagkodene, til visning */
  fagKoder: string[];
  /** antall skåringer som teller, i året */
  okter: number;
  /** dato for siste skåring, ISO. null hvis ingen. */
  siste: string | null;
  /** når elevraden sist ble endret, lokal ISO */
  endret: string;
  notat: string | null;
  /** fordelingen av skåringene som teller, til innsatskolonnen */
  gronn: number;
  gul: number;
  rod: number;
};

// ------------------------------------------------------------------ klasser

export async function hentKlasser(skolearId: string): Promise<Klasse[]> {
  return hent<Klasse>(
    `SELECT k.id, k.navn,
            (SELECT COUNT(*) FROM elev_klasse ek
              JOIN elev e ON e.id = ek.elev_id AND e.slettet IS NULL
             WHERE ek.klasse_id = k.id AND ek.slettet IS NULL) AS antall
       FROM klasse k
      WHERE k.skolear_id = $1 AND k.slettet IS NULL
      ORDER BY k.navn`,
    [skolearId],
  );
}

export async function finnEllerOpprettKlasse(
  skolearId: string,
  navn: string,
): Promise<string> {
  const finnes = await hent<{ id: string }>(
    "SELECT id FROM klasse WHERE skolear_id = $1 AND navn = $2 AND slettet IS NULL",
    [skolearId, navn],
  );
  if (finnes[0]) return finnes[0].id;
  return settInn("klasse", { skolear_id: skolearId, navn });
}

export async function giKlasseNyttNavn(id: string, navn: string): Promise<void> {
  await oppdater("klasse", id, { navn });
}

/** Sletter klassen, ikke elevene. De blir stående uten klasse det året (§4.3). */
export async function slettKlasse(id: string): Promise<void> {
  const koblinger = await hent<{ id: string }>(
    "SELECT id FROM elev_klasse WHERE klasse_id = $1 AND slettet IS NULL",
    [id],
  );
  for (const k of koblinger) await slett("elev_klasse", k.id);
  await slett("klasse", id);
}

// ------------------------------------------------------------------ elever

export async function hentElever(skolearId: string): Promise<ElevRad[]> {
  const rader = await hent<{
    id: string;
    kode: string | null;
    fornavn: string;
    etternavn: string;
    klasseId: string | null;
    klasseNavn: string | null;
    endret: string;
    notat: string | null;
  }>(
    `SELECT e.id, e.kode, e.fornavn, e.etternavn, e.endret, e.notat,
            k.id AS klasseId, k.navn AS klasseNavn
       FROM elev e
       LEFT JOIN elev_klasse ek
              ON ek.elev_id = e.id AND ek.skolear_id = $1 AND ek.slettet IS NULL
       LEFT JOIN klasse k ON k.id = ek.klasse_id AND k.slettet IS NULL
      WHERE e.slettet IS NULL
        AND (ek.id IS NOT NULL
             OR EXISTS (SELECT 1 FROM elev_fag ef
                          JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
                         WHERE ef.elev_id = e.id AND ef.slettet IS NULL
                           AND sf.slettet IS NULL AND sf.skolear_id = $1)
             -- En elev uten klasse og uten fag hører ikke til noe år, men må
             -- likevel vises: det er slik hen ser ut i sekundet etter at du
             -- har skrevet navnet, før du har rukket å plassere hen. Uten
             -- dette lages eleven i stillhet og forsvinner (§4.3).
             OR (NOT EXISTS (SELECT 1 FROM elev_klasse ek2
                              WHERE ek2.elev_id = e.id AND ek2.slettet IS NULL)
                 AND NOT EXISTS (SELECT 1 FROM elev_fag ef2
                                  WHERE ef2.elev_id = e.id AND ef2.slettet IS NULL)))
      ORDER BY e.fornavn COLLATE NOCASE, e.etternavn COLLATE NOCASE`,
    [skolearId],
  );

  const fag = await hent<{ elevId: string; skolearFagId: string; kode: string }>(
    `SELECT ef.elev_id AS elevId, sf.id AS skolearFagId, f.kode AS kode
       FROM elev_fag ef
       JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $1
       JOIN fag f ON f.id = sf.fag_id AND f.slettet IS NULL
      WHERE ef.slettet IS NULL
      ORDER BY f.kode`,
    [skolearId],
  );

  // Verdier med teller_ikke = 1 holdes utenfor her, i spørringslaget, slik at
  // ingen visning kan glemme det (§12).
  const skaringer = await hent<{
    elevId: string;
    antall: number;
    siste: string;
    gronn: number;
    gul: number;
    rod: number;
  }>(
    `SELECT s.elev_id AS elevId, COUNT(*) AS antall, MAX(o.dato) AS siste,
            SUM(CASE WHEN v.farge = 'gronn' THEN 1 ELSE 0 END) AS gronn,
            SUM(CASE WHEN v.farge = 'gul'   THEN 1 ELSE 0 END) AS gul,
            SUM(CASE WHEN v.farge = 'rod'   THEN 1 ELSE 0 END) AS rod
       FROM skaring s
       JOIN okt o ON o.id = s.okt_id AND o.slettet IS NULL
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $1
       JOIN skalaverdi v ON v.id = s.skalaverdi_id
      WHERE s.slettet IS NULL AND v.teller_ikke = 0
      GROUP BY s.elev_id`,
    [skolearId],
  );

  const fagPerElev = new Map<string, { ider: string[]; koder: string[] }>();
  for (const f of fag) {
    const post = fagPerElev.get(f.elevId) ?? { ider: [], koder: [] };
    post.ider.push(f.skolearFagId);
    post.koder.push(f.kode);
    fagPerElev.set(f.elevId, post);
  }

  const skaringPerElev = new Map(skaringer.map((s) => [s.elevId, s]));

  return rader.map((r) => ({
    ...r,
    fagIder: fagPerElev.get(r.id)?.ider ?? [],
    fagKoder: fagPerElev.get(r.id)?.koder ?? [],
    okter: skaringPerElev.get(r.id)?.antall ?? 0,
    siste: skaringPerElev.get(r.id)?.siste ?? null,
    gronn: skaringPerElev.get(r.id)?.gronn ?? 0,
    gul: skaringPerElev.get(r.id)?.gul ?? 0,
    rod: skaringPerElev.get(r.id)?.rod ?? 0,
  }));
}

/** Formen duplikatgjenkjenningen trenger (§7.1). */
export async function hentForDuplikatsjekk(
  skolearId: string,
): Promise<EksisterendeElev[]> {
  const elever = await hentElever(skolearId);
  return elever.map((e) => ({
    id: e.id,
    fornavn: e.fornavn,
    etternavn: e.etternavn,
    klasse: e.klasseNavn,
    fag: e.fagKoder,
    skolearFagIder: e.fagIder,
  }));
}

async function opptatteKoder(): Promise<Set<string>> {
  const rader = await hent<{ kode: string }>(
    "SELECT kode FROM elev WHERE kode IS NOT NULL",
  );
  return new Set(rader.map((r) => r.kode));
}

export async function opprettElev(
  fornavn: string,
  etternavn: string,
): Promise<string> {
  const kode = lagElevkode(fornavn, etternavn, await opptatteKoder());
  return settInn("elev", { fornavn, etternavn, kode });
}

export async function endreElev(
  id: string,
  felter: { fornavn?: string; etternavn?: string },
): Promise<void> {
  await oppdater("elev", id, felter);
}

export async function slettElev(id: string): Promise<void> {
  await slett("elev", id);
}

// ------------------------------------------------------- koblinger til år

/** Én klasse per elev per skoleår. Å sette en ny bytter ut den forrige. */
export async function settKlasse(
  elevId: string,
  skolearId: string,
  klasseId: string | null,
): Promise<void> {
  const finnes = await hent<{ id: string }>(
    "SELECT id FROM elev_klasse WHERE elev_id = $1 AND skolear_id = $2",
    [elevId, skolearId],
  );

  if (klasseId === null) {
    if (finnes[0]) {
      await slett("elev_klasse", finnes[0].id);
    }
    return;
  }

  // UNIQUE(elev_id, skolear_id) gjelder også soft-slettede rader, så raden
  // gjenbrukes i stedet for at vi setter inn en ny (§12).
  if (finnes[0]) {
    await oppdater("elev_klasse", finnes[0].id, {
      klasse_id: klasseId,
      slettet: null,
    });
    return;
  }

  await settInn("elev_klasse", {
    elev_id: elevId,
    klasse_id: klasseId,
    skolear_id: skolearId,
  });
}

export async function koblePaFag(
  elevId: string,
  skolearFagId: string,
): Promise<void> {
  const finnes = await hent<{ id: string; slettet: string | null }>(
    "SELECT id, slettet FROM elev_fag WHERE elev_id = $1 AND skolear_fag_id = $2",
    [elevId, skolearFagId],
  );

  if (finnes[0]) {
    if (finnes[0].slettet) await oppdater("elev_fag", finnes[0].id, { slettet: null });
    return;
  }

  await settInn("elev_fag", { elev_id: elevId, skolear_fag_id: skolearFagId });
}

export async function frakobleFag(
  elevId: string,
  skolearFagId: string,
): Promise<void> {
  const finnes = await hent<{ id: string }>(
    "SELECT id FROM elev_fag WHERE elev_id = $1 AND skolear_fag_id = $2 AND slettet IS NULL",
    [elevId, skolearFagId],
  );
  if (finnes[0]) {
    await slett("elev_fag", finnes[0].id);
  }
}

// --------------------------------------------------------------- opprydding

/**
 * Hva som forsvinner om en elev slettes.
 *
 * Tallene vises i bekreftelsen. En sletting man ikke vet omfanget av, er ikke
 * en beslutning — den er et sjansespill.
 */
export async function tellForElev(
  elevId: string,
): Promise<{ skaringer: number; vurderinger: number; oppfolging: number }> {
  const [r] = await hent<{
    skaringer: number;
    vurderinger: number;
    oppfolging: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM skaring WHERE elev_id = $1 AND slettet IS NULL)
         AS skaringer,
       (SELECT COUNT(*) FROM vurderingsresultat WHERE elev_id = $1
          AND slettet IS NULL) AS vurderinger,
       (SELECT COUNT(*) FROM oppfolging WHERE elev_id = $1 AND slettet IS NULL)
         AS oppfolging`,
    [elevId],
  );
  return r;
}

/**
 * Sletter en elev og alt som henger på hen.
 *
 * Soft delete hele veien (§9), så ingenting forsvinner fysisk — men det
 * kommer ikke tilbake gjennom grensesnittet. Sikkerhetskopien fra i dag er
 * veien tilbake hvis det var feil elev.
 */
export async function slettElevHelt(elevId: string): Promise<void> {
  for (const tabell of [
    "skaring",
    "vurderingsresultat",
    "oppfolging",
    "elev_fag",
    "elev_klasse",
  ]) {
    const rader = await hent<{ id: string }>(
      `SELECT id FROM ${tabell} WHERE elev_id = $1 AND slettet IS NULL`,
      [elevId],
    );
    for (const r of rader) await slett(tabell, r.id);
  }
  await slett("elev", elevId);
}

/** Hvor mange skåringer eleven har i ett fag, i året faget hører til. */
export async function tellSkaringerIFag(
  elevId: string,
  skolearFagId: string,
): Promise<number> {
  const [r] = await hent<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM skaring s
       JOIN okt o ON o.id = s.okt_id AND o.slettet IS NULL
      WHERE s.elev_id = $1 AND s.slettet IS NULL
        AND o.skolear_fag_id = $2`,
    [elevId, skolearFagId],
  );
  return r?.n ?? 0;
}
