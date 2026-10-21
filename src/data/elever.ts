import { slettForElevI } from "./klassekart";
import { varsleElever } from "./endringer";
import { slettElevbildeI } from "./elevbilde";
import {
  hent,
  oppdater,
  settInn,
  slett,
  Transaksjon,
  settInnEllerOppdater,
} from "../db";
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
  /** 1 = min mentorelev dette året. Krever at eleven har en klasse (§3.2). */
  mentor: boolean;
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
  /** fordelingen av skåringene som teller, til innsatskolonnen */
  gronn: number;
  gul: number;
  rod: number;
};

// ------------------------------------------------------------------ klasser

/** Alle elevene, på tvers av år, sortert etter navn (Personvern, 23.9). */
export async function hentAlleElever(): Promise<
  { id: string; fornavn: string; etternavn: string }[]
> {
  return hent(
    `SELECT id, fornavn, etternavn FROM elev WHERE slettet IS NULL
      ORDER BY fornavn COLLATE NOCASE, etternavn COLLATE NOCASE`,
  );
}

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

export async function giKlasseNyttNavn(
  id: string,
  navn: string,
): Promise<void> {
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

/**
 * Om en elev passerer fagfilteret.
 *
 * `alle` er AND: eleven må ha samtlige valgte fag. Det er den som svarer på
 * «hvem har både MFL1 og ENG1». `minstEtt` er OR, som er nyttig når man leter
 * etter en elev man ikke husker hvilket fag man har hen i.
 *
 * Ingen valgte fag slipper alle gjennom — et tomt filter er ikke et filter.
 */
export function passerFagfilter(
  fagIder: string[],
  valgte: ReadonlySet<string>,
  modus: "alle" | "minstEtt",
): boolean {
  if (valgte.size === 0) return true;

  let treff = 0;
  for (const id of valgte) if (fagIder.includes(id)) treff++;

  return modus === "alle" ? treff === valgte.size : treff > 0;
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
    mentor: number;
    endret: string;
  }>(
    `SELECT e.id, e.kode, e.fornavn, e.etternavn, e.endret,
            k.id AS klasseId, k.navn AS klasseNavn,
            COALESCE(ek.mentor, 0) AS mentor
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

  const fag = await hent<{
    elevId: string;
    skolearFagId: string;
    kode: string;
  }>(
    `SELECT ef.elev_id AS elevId, sf.id AS skolearFagId, COALESCE(NULLIF(f.alias, ''), f.kode) AS kode
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
    mentor: r.mentor === 1,
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

/**
 * Ny elev med klasse, fag og mentorflagg i én transaksjon (Ny elev, 19.1).
 * Feiler noe underveis, er ingenting lagret: aldri en elev uten den klassen
 * eller de fagene du valgte. Mentorflagget krever klasse (§3.2).
 */
export async function opprettElevMed(n: {
  fornavn: string;
  etternavn: string;
  skolearId: string;
  klasseId: string | null;
  fagIder: string[];
  mentor: boolean;
}): Promise<string> {
  const kode = lagElevkode(n.fornavn, n.etternavn, await opptatteKoder());
  const t = new Transaksjon();
  const id = t.settInn("elev", {
    fornavn: n.fornavn,
    etternavn: n.etternavn,
    kode,
  });
  if (n.klasseId)
    t.settInn("elev_klasse", {
      elev_id: id,
      klasse_id: n.klasseId,
      skolear_id: n.skolearId,
      mentor: n.mentor ? 1 : 0,
    });
  for (const f of new Set(n.fagIder))
    t.settInn("elev_fag", { elev_id: id, skolear_fag_id: f });
  await t.kjor();
  varsleElever();
  return id;
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
/**
 * Merker eleven som mentorelev dette skoleåret, eller fjerner merket.
 *
 * Flagget ligger på klassekoblingen (§3.2), så en mentorelev må ha en klasse.
 * Det er ikke en begrensning i praksis — mentorgruppa *er* en delmengde av en
 * klasse — men det betyr at merket følger med når klassen fjernes.
 *
 * Returnerer false hvis eleven ikke har en klasse i året, så kallstedet kan
 * si fra i stedet for at handlingen forsvinner i stillhet.
 */
export async function settMentor(
  elevId: string,
  skolearId: string,
  pa: boolean,
): Promise<boolean> {
  const finnes = await hent<{ id: string }>(
    `SELECT id FROM elev_klasse
      WHERE elev_id = $1 AND skolear_id = $2 AND slettet IS NULL`,
    [elevId, skolearId],
  );
  if (!finnes[0]) return false;

  await oppdater("elev_klasse", finnes[0].id, { mentor: pa ? 1 : 0 });
  varsleElever();
  return true;
}

export async function settKlasse(
  elevId: string,
  skolearId: string,
  klasseId: string | null,
): Promise<void> {
  if (klasseId === null) {
    const finnes = await hent<{ id: string }>(
      "SELECT id FROM elev_klasse WHERE elev_id = $1 AND skolear_id = $2 AND slettet IS NULL",
      [elevId, skolearId],
    );
    if (finnes[0]) await slett("elev_klasse", finnes[0].id);
  } else {
    await settInnEllerOppdater("elev_klasse", ["elev_id", "skolear_id"], {
      elev_id: elevId,
      klasse_id: klasseId,
      skolear_id: skolearId,
    });
  }
  varsleElever();
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
    // Koblet før og tatt ut: raden gjenbrukes (UNIQUE, §12).
    if (finnes[0].slettet)
      await oppdater("elev_fag", finnes[0].id, { slettet: null });
  } else {
    await settInn("elev_fag", {
      elev_id: elevId,
      skolear_fag_id: skolearFagId,
    });
  }
  varsleElever();
}

/**
 * Spørsmålet som stilles før en elev kobles fra et fag.
 *
 * Frakoblingen rører aldri skåringene — de blir liggende, og kobler du til
 * igjen, kommer de tilbake i heatmapet. Men eleven forsvinner ut av fagets
 * lister i mellomtiden, og det er verdt å si fra om.
 */
export function frakobletekst(
  fornavn: string,
  fagKode: string,
  skaringer: number,
): string {
  return (
    `Koble ${fornavn} fra ${fagKode}?\n\n` +
    `${skaringer} skåringer blir liggende i basen, men eleven forsvinner ` +
    "ut av fagets lister og heatmap.\n\n" +
    "Du kan koble til igjen når som helst. Da kommer de tilbake."
  );
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
  varsleElever();
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
): Promise<{ skaringer: number; vurderinger: number; notater: number }> {
  const [r] = await hent<{
    skaringer: number;
    vurderinger: number;
    notater: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM skaring WHERE elev_id = $1 AND slettet IS NULL)
         AS skaringer,
       (SELECT COUNT(*) FROM vurderingsresultat WHERE elev_id = $1
          AND slettet IS NULL) AS vurderinger,
       (SELECT COUNT(*) FROM elevnotat WHERE elev_id = $1 AND slettet IS NULL)
         AS notater`,
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
/** Samme tall som `tellForElev`, men for flere elever under ett. */
export async function tellForElever(
  elevIder: string[],
): Promise<{ skaringer: number; vurderinger: number; notater: number }> {
  if (elevIder.length === 0)
    return { skaringer: 0, vurderinger: 0, notater: 0 };

  const plass = elevIder.map((_, i) => `$${i + 1}`).join(", ");
  const [r] = await hent<{
    skaringer: number;
    vurderinger: number;
    notater: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM skaring WHERE elev_id IN (${plass})
          AND slettet IS NULL) AS skaringer,
       (SELECT COUNT(*) FROM vurderingsresultat WHERE elev_id IN (${plass})
          AND slettet IS NULL) AS vurderinger,
       (SELECT COUNT(*) FROM elevnotat WHERE elev_id IN (${plass})
          AND slettet IS NULL) AS notater`,
    elevIder,
  );
  return r;
}

/**
 * Spørsmålet som stilles før elever slettes.
 *
 * Eleven lever på tvers av skoleår (§3.2), så en sletting tar med seg alt —
 * også det som ble ført i fjor. Det må stå i spørsmålet.
 */
export function slettElevtekst(
  navn: string[],
  n: { skaringer: number; vurderinger: number; notater: number },
): string {
  const hvem =
    navn.length === 1 ? `Slette ${navn[0]}?` : `Slette ${navn.length} elever?`;

  const hva = [
    n.skaringer && `${n.skaringer} skåringer`,
    n.vurderinger && `${n.vurderinger} vurderingsresultater`,
    n.notater && `${n.notater} notater`,
  ].filter(Boolean);

  const omfang =
    hva.length > 0
      ? `Dette fjerner ${hva.join(", ")}, i alle skoleår, ikke bare dette.`
      : navn.length === 1
        ? "Eleven har ingen skåringer eller vurderinger registrert."
        : "Ingen av dem har skåringer eller vurderinger registrert.";

  return `${hvem}\n\n${omfang}\n\nSikkerhetskopien fra i dag er veien tilbake.`;
}

/** Sletter flere elever under ett, med alt som henger på dem. */
export async function slettElever(elevIder: string[]): Promise<void> {
  for (const id of elevIder) await slettElevHelt(id);
}

export async function slettElevHelt(elevId: string): Promise<void> {
  // Alt leses først, og slettingen skjer i én transaksjon: enten er hele
  // eleven borte, eller ingenting (#2).
  const t = new Transaksjon();
  await slettElevHeltI(t, elevId);
  await t.kjor();
  varsleElever();
}

async function slettElevHeltI(t: Transaksjon, elevId: string): Promise<void> {
  for (const tabell of [
    "skaring",
    "oktnotat",
    "vurderingsresultat",
    "elevnotat",
    "samtale",
    "elev_fag",
    "elev_klasse",
  ]) {
    const rader = await hent<{ id: string }>(
      `SELECT id FROM ${tabell} WHERE elev_id = $1 AND slettet IS NULL`,
      [elevId],
    );
    for (const r of rader) t.slett(tabell, r.id);
  }
  await slettElevbildeI(t, elevId);
  await slettForElevI(t, elevId);
  t.slett("elev", elevId);
}

// ------------------------------------------- elevene fra et tidligere år

/** Elevene i året: med klasse eller fag der. */
async function eleverIAr(skolearId: string): Promise<string[]> {
  const rader = await hent<{ id: string }>(
    `SELECT elev_id AS id FROM elev_klasse
      WHERE skolear_id = $1 AND slettet IS NULL
     UNION
     SELECT ef.elev_id FROM elev_fag ef
       JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
      WHERE sf.skolear_id = $1 AND ef.slettet IS NULL`,
    [skolearId],
  );
  return rader.map((r) => r.id);
}

/** Elevene i året som også har klasse eller fag i et annet år. */
async function iAndreAr(skolearId: string): Promise<Set<string>> {
  const rader = await hent<{ id: string }>(
    `SELECT elev_id AS id FROM elev_klasse
      WHERE skolear_id <> $1 AND slettet IS NULL
     UNION
     SELECT ef.elev_id FROM elev_fag ef
       JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
      WHERE sf.skolear_id <> $1 AND sf.slettet IS NULL
        AND ef.slettet IS NULL`,
    [skolearId],
  );
  return new Set(rader.map((r) => r.id));
}

export type Elevar = {
  elever: number;
  /** elever som bare finnes i året, og forsvinner helt */
  helt: number;
  skaringer: number;
  vurderinger: number;
  notater: number;
};

/** Hva «Slett elevene fra et tidligere år» tar med seg (23.9). */
export async function tellEleverIAr(skolearId: string): Promise<Elevar> {
  const elever = await eleverIAr(skolearId);
  const andre = await iAndreAr(skolearId);
  const [r] = await hent<Omit<Elevar, "elever" | "helt">>(
    `SELECT
       (SELECT COUNT(*) FROM skaring s
          JOIN okt o ON o.id = s.okt_id
          JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
         WHERE sf.skolear_id = $1 AND s.slettet IS NULL) AS skaringer,
       (SELECT COUNT(*) FROM vurderingsresultat r
          JOIN vurdering v ON v.id = r.vurdering_id
          JOIN skolear_fag sf ON sf.id = v.skolear_fag_id
         WHERE sf.skolear_id = $1 AND r.slettet IS NULL) AS vurderinger,
       (SELECT COUNT(*) FROM elevnotat
         WHERE skolear_id = $1 AND slettet IS NULL) AS notater`,
    [skolearId],
  );
  return {
    elever: elever.length,
    helt: elever.filter((id) => !andre.has(id)).length,
    skaringer: r?.skaringer ?? 0,
    vurderinger: r?.vurderinger ?? 0,
    notater: r?.notater ?? 0,
  };
}

/**
 * Sletter elevene fra ett skoleår (Innstillinger › Personvern, 23.9).
 * Fag, økter, vurderinger og planer blir stående. Det som går, er alt som
 * knytter elever til året: skår, resultater, notater, samtaler, klasser,
 * fag og klassekart. En elev som bare finnes i dette året, slettes helt
 * (med bilde); en som også går i et annet år, beholder det året.
 * Én transaksjon (#2).
 */
export async function slettEleverIAr(skolearId: string): Promise<void> {
  const elever = await eleverIAr(skolearId);
  const andre = await iAndreAr(skolearId);
  const t = new Transaksjon();
  const sql: [string, string][] = [
    [
      "skaring",
      `SELECT s.id FROM skaring s JOIN okt o ON o.id = s.okt_id
         JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
        WHERE sf.skolear_id = $1 AND s.slettet IS NULL`,
    ],
    [
      "oktnotat",
      `SELECT n.id FROM oktnotat n JOIN okt o ON o.id = n.okt_id
         JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
        WHERE sf.skolear_id = $1 AND n.slettet IS NULL`,
    ],
    [
      "vurderingsresultat",
      `SELECT r.id FROM vurderingsresultat r
         JOIN vurdering v ON v.id = r.vurdering_id
         JOIN skolear_fag sf ON sf.id = v.skolear_fag_id
        WHERE sf.skolear_id = $1 AND r.slettet IS NULL`,
    ],
    [
      "elevnotat",
      "SELECT id FROM elevnotat WHERE skolear_id = $1 AND slettet IS NULL",
    ],
    [
      "samtale",
      `SELECT s.id FROM samtale s JOIN samtaledag d ON d.id = s.samtaledag_id
        WHERE d.skolear_id = $1 AND s.slettet IS NULL`,
    ],
    [
      "elev_fag",
      `SELECT ef.id FROM elev_fag ef
         JOIN skolear_fag sf ON sf.id = ef.skolear_fag_id
        WHERE sf.skolear_id = $1 AND ef.slettet IS NULL`,
    ],
    [
      "elev_klasse",
      "SELECT id FROM elev_klasse WHERE skolear_id = $1 AND slettet IS NULL",
    ],
    [
      "plassering",
      `SELECT p.id FROM plassering p
         JOIN klassekart k ON k.id = p.klassekart_id
        WHERE k.skolear_id = $1 AND p.slettet IS NULL`,
    ],
    [
      "elevregel",
      `SELECT id FROM elevregel WHERE slettet IS NULL AND kilde_id IN (
         SELECT id FROM skolear_fag WHERE skolear_id = $1
         UNION SELECT id FROM klasse WHERE skolear_id = $1
         UNION SELECT $1)`,
    ],
  ];
  for (const [tabell, q] of sql)
    for (const r of await hent<{ id: string }>(q, [skolearId]))
      t.slett(tabell, r.id);
  // Elever som bare fantes i året: resten av dem også. En rad som kommer
  // med to ganger, får bare samme sletting igjen.
  for (const id of elever.filter((e) => !andre.has(e)))
    await slettElevHeltI(t, id);
  await t.kjor();
  varsleElever();
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

/**
 * Kjønn på eleven (SPEC §4.11): «j», «g» eller ikke satt. Valgfritt, og
 * brukes bare til å blande i klassekartet. Vises bare i elevkortet og går
 * aldri ut av appen. Satt for hånd overstyrer en gjetning fra importen.
 */
export async function settKjonn(
  elevId: string,
  kjonn: "j" | "g" | null,
  /** «gjettet» fra importen (9.8), ellers satt av læreren */
  kilde: "satt" | "gjettet" = "satt",
): Promise<void> {
  await oppdater("elev", elevId, {
    kjonn,
    kjonn_kilde: kjonn === null ? null : kilde,
  });
  varsleElever();
}
