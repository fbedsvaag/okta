import { hent, nyId, oppdater, settInn, slett, Transaksjon } from "../db";
import { varsleKlassekart } from "./endringer";
import { makkere } from "./fordeling";

/**
 * Klassekart og gruppegenerator (SPEC §4.11, migrasjon 024).
 *
 * - **Rom**: tegnet én gang, brukt av mange kart. Oppsettet er en liste
 *   deler — pulter, kateter, tavle, dør og vinduer — på et rutenett.
 * - **Kart**: én elevgruppe (fag, klasse eller mentorgruppa) i ett rom.
 * - **Plassering**: hvem som satt hvor, eller i hvilken gruppe, da kartet
 *   ble brukt. Lagres når læreren trykker «Bruk», skriver ut eller kopierer.
 * - **Elevregel**: «hold fra hverandre», per kilde.
 *
 * Kjønn, innsats og bilder brukes bare her inne og går aldri ut av appen.
 */

// ------------------------------------------------------------------- rommet

export type Deltype =
  | "enkelt"
  | "dobbel"
  | "gruppe4"
  | "gruppe6"
  | "kateter"
  | "tavle"
  | "dor"
  | "vindu";

export type Rotasjon = 0 | 90 | 180 | 270;

export type Del = {
  id: string;
  type: Deltype;
  /** øvre venstre hjørne i px, på rutenettet */
  x: number;
  y: number;
  rot: Rotasjon;
};

/** Rutenettet i rom-editoren. Delene fester seg til det. */
export const RUTE = 20;

/**
 * Størrelsen på hver del uten rotasjon, og plassene på den (midtpunkter,
 * relativt til delens hjørne). Pultene er 100 × 60 per plass, som på
 * lerretet.
 */
export const DELER: Record<
  Deltype,
  { navn: string; b: number; h: number; plasser: [number, number][] }
> = {
  enkelt: { navn: "Enkeltpult", b: 100, h: 60, plasser: [[50, 30]] },
  dobbel: {
    navn: "Dobbeltpult",
    b: 200,
    h: 60,
    plasser: [
      [50, 30],
      [150, 30],
    ],
  },
  gruppe4: {
    navn: "Gruppebord (4)",
    b: 200,
    h: 120,
    plasser: [
      [50, 30],
      [150, 30],
      [50, 90],
      [150, 90],
    ],
  },
  gruppe6: {
    navn: "Gruppebord (6)",
    b: 300,
    h: 120,
    plasser: [
      [50, 30],
      [150, 30],
      [250, 30],
      [50, 90],
      [150, 90],
      [250, 90],
    ],
  },
  kateter: { navn: "Kateter", b: 140, h: 60, plasser: [] },
  tavle: { navn: "Tavle", b: 380, h: 20, plasser: [] },
  dor: { navn: "Dør", b: 80, h: 80, plasser: [] },
  vindu: { navn: "Vinduer", b: 380, h: 20, plasser: [] },
};

/** Bredde og høyde slik delen står, med rotasjonen. */
export function storrelse(d: Pick<Del, "type" | "rot">): {
  b: number;
  h: number;
} {
  const { b, h } = DELER[d.type];
  return d.rot % 180 === 0 ? { b, h } : { b: h, h: b };
}

export type Plass = {
  /** 1, 2, 3 … forfra og fra venstre */
  nr: number;
  delId: string;
  /** midtpunktet i rommet */
  x: number;
  y: number;
  /** pulten plassen hører til, til «sitter ved samme pult» */
  pult: string;
};

/**
 * Plassene i rommet, nummerert forfra (nærmest tavla) og fra venstre.
 * Uten tavle regnes toppen av rommet som foran. Plasser på samme rad
 * (innenfor en halv pult i dybden) nummereres fra venstre.
 */
export function plasserIRom(deler: Del[]): Plass[] {
  const tavle = deler.find((d) => d.type === "tavle");
  const tavleY = tavle ? tavle.y + storrelse(tavle).h / 2 : 0;
  const ut: Omit<Plass, "nr">[] = [];
  for (const d of deler) {
    const { b, h } = DELER[d.type];
    for (const [px, py] of DELER[d.type].plasser) {
      // Roter plassen rundt delens hjørne, og flytt den tilbake inn i
      // rammen delen har etter rotasjonen.
      const [rx, ry] =
        d.rot === 0
          ? [px, py]
          : d.rot === 90
            ? [h - py, px]
            : d.rot === 180
              ? [b - px, h - py]
              : [py, b - px];
      ut.push({ delId: d.id, pult: d.id, x: d.x + rx, y: d.y + ry });
    }
  }
  const rad = (p: { y: number }) => Math.round(Math.abs(p.y - tavleY) / 30);
  ut.sort((a, b) => rad(a) - rad(b) || a.x - b.x);
  return ut.map((p, i) => ({ ...p, nr: i + 1 }));
}

/** Rommalene i editoren (SPEC §4.11). Plassert under en tavle øverst. */
export function romMal(
  mal: "par" | "hestesko" | "grupper4" | "enkelt",
): Omit<Del, "id">[] {
  const tavle: Omit<Del, "id"> = { type: "tavle", x: 300, y: 20, rot: 0 };
  const kateter: Omit<Del, "id"> = { type: "kateter", x: 760, y: 80, rot: 0 };
  const dor: Omit<Del, "id"> = { type: "dor", x: 40, y: 560, rot: 0 };
  const deler: Omit<Del, "id">[] = [tavle, kateter, dor];
  if (mal === "par") {
    for (let r = 0; r < 5; r++)
      for (let k = 0; k < 3; k++)
        deler.push({
          type: "dobbel",
          x: 80 + k * 280,
          y: 160 + r * 80,
          rot: 0,
        });
  } else if (mal === "hestesko") {
    for (let k = 0; k < 6; k++)
      deler.push({ type: "dobbel", x: 80 + k * 200, y: 160, rot: 0 });
    for (let r = 0; r < 3; r++) {
      deler.push({ type: "dobbel", x: 60, y: 240 + r * 120, rot: 90 });
      deler.push({ type: "dobbel", x: 1180, y: 240 + r * 120, rot: 90 });
    }
  } else if (mal === "grupper4") {
    for (let r = 0; r < 2; r++)
      for (let k = 0; k < 4; k++)
        deler.push({
          type: "gruppe4",
          x: 80 + k * 260,
          y: 160 + r * 200,
          rot: 0,
        });
  } else {
    for (let r = 0; r < 5; r++)
      for (let k = 0; k < 6; k++)
        deler.push({
          type: "enkelt",
          x: 80 + k * 160,
          y: 160 + r * 80,
          rot: 0,
        });
  }
  return deler;
}

export type Rom = {
  id: string;
  navn: string;
  deler: Del[];
  /** kartene som bruker rommet */
  brukesAv: number;
};

function tolkOppsett(json: string): Del[] {
  try {
    const d = JSON.parse(json);
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

export async function hentRom(): Promise<Rom[]> {
  const rader = await hent<{
    id: string;
    navn: string;
    oppsett: string;
    brukesAv: number;
  }>(
    `SELECT r.id, r.navn, r.oppsett,
            (SELECT COUNT(*) FROM klassekart k
              WHERE k.rom_id = r.id AND k.slettet IS NULL) AS brukesAv
       FROM rom r
      WHERE r.slettet IS NULL
      ORDER BY r.navn COLLATE NOCASE`,
  );
  return rader.map((r) => ({
    id: r.id,
    navn: r.navn,
    deler: tolkOppsett(r.oppsett),
    brukesAv: r.brukesAv,
  }));
}

export async function opprettRom(
  navn: string,
  deler: Omit<Del, "id">[] | Del[],
): Promise<string> {
  const id = await settInn("rom", {
    navn,
    oppsett: JSON.stringify(
      deler.map((d) => ({ id: "id" in d ? d.id : nyId(), ...d })),
    ),
  });
  varsleKlassekart();
  return id;
}

export async function endreRom(
  id: string,
  felter: { navn?: string; deler?: Del[] },
): Promise<void> {
  await oppdater("rom", id, {
    ...(felter.navn !== undefined && { navn: felter.navn }),
    ...(felter.deler !== undefined && {
      oppsett: JSON.stringify(felter.deler),
    }),
  });
  varsleKlassekart();
}

/**
 * Sletter rommet. Kart som brukte det, mister rommet (rom_id blir tom), men
 * beholder elevene og historikken. Kallstedet spør først når rommet er i bruk.
 */
export async function slettRom(id: string): Promise<void> {
  const kart = await hent<{ id: string }>(
    "SELECT id FROM klassekart WHERE rom_id = $1 AND slettet IS NULL",
    [id],
  );
  for (const k of kart) await oppdater("klassekart", k.id, { rom_id: null });
  await slett("rom", id);
  varsleKlassekart();
}

// -------------------------------------------------------------------- kartet

export type Kildetype = "fag" | "klasse" | "mentorgruppe";
export type Fordelingsmodus = "tilfeldig" | "spre" | "samle";

export type Innstillinger = {
  fordeling: Fordelingsmodus;
  bland: boolean;
  unnga: boolean;
  antallGrupper: number;
  /** «Fra kateteret» (false) eller «Fra elevene» (true) */
  fraElevene: boolean;
  /** visningen kartet sist sto i */
  visning: "plasser" | "grupper";
  /**
   * Et skjult kart som bare bærer gruppene for en klasse eller et fag
   * (Grupper-fanen, 25.3/25.12). Står ikke blant klassekartene. Får det et
   * rom, blir det et vanlig kart med den samme historikken.
   */
  bareGrupper?: boolean;
  /** «Per gruppe» i stedet for antall grupper (25.4); null = antall */
  perGruppe?: number | null;
  /** «Bare de som er her» (25.5) */
  bareHer?: boolean;
  /**
   * «Sett sammen neste gang» (26.3): elev → elever hen aldri har vært
   * sammen med. Brukes ved neste Stokk, og tømmes når et sett lagres.
   */
  settSammen?: Record<string, string[]>;
};

export const STANDARD: Innstillinger = {
  fordeling: "tilfeldig",
  bland: true,
  unnga: true,
  antallGrupper: 6,
  fraElevene: false,
  visning: "plasser",
};

export type Kart = {
  id: string;
  skolearId: string;
  kildeType: Kildetype;
  kildeId: string;
  /** «MFL2», «2STA» eller «Mentorgruppe» */
  kildeNavn: string;
  farge: string | null;
  romId: string | null;
  romNavn: string | null;
  innstillinger: Innstillinger;
  antall: number;
  /** sist endret, lokal ISO */
  endret: string;
};

function tolkInnstillinger(json: string | null): Innstillinger {
  try {
    return { ...STANDARD, ...(json ? JSON.parse(json) : {}) };
  } catch {
    return STANDARD;
  }
}

/**
 * Kartene i skoleåret, med navnet på kilden og rommet. De skjulte
 * gruppekartene (`bareGrupper`) er bare med når `medSkjulte` er satt.
 */
export async function hentKart(
  skolearId: string,
  medSkjulte = false,
): Promise<Kart[]> {
  const rader = await hent<{
    id: string;
    skolearId: string;
    kildeType: Kildetype;
    kildeId: string;
    fagKode: string | null;
    farge: string | null;
    klasse: string | null;
    romId: string | null;
    romNavn: string | null;
    innstillinger: string | null;
    endret: string;
  }>(
    `SELECT k.id, k.endret, k.skolear_id AS skolearId, k.kilde_type AS kildeType,
            k.kilde_id AS kildeId,
            COALESCE(NULLIF(f.alias, ''), f.kode) AS fagKode, f.farge,
            kl.navn AS klasse, r.id AS romId, r.navn AS romNavn,
            k.innstillinger
       FROM klassekart k
       LEFT JOIN skolear_fag sf ON k.kilde_type = 'fag' AND sf.id = k.kilde_id
       LEFT JOIN fag f ON f.id = sf.fag_id
       LEFT JOIN klasse kl ON k.kilde_type = 'klasse' AND kl.id = k.kilde_id
       LEFT JOIN rom r ON r.id = k.rom_id AND r.slettet IS NULL
      WHERE k.skolear_id = $1 AND k.slettet IS NULL
        -- Et kart for et fag som er tatt ut av året, eller en klasse som er
        -- slettet, har ingen elever å vise og står ikke i lista.
        AND NOT (k.kilde_type = 'fag'
                 AND (sf.id IS NULL OR sf.slettet IS NOT NULL))
        AND NOT (k.kilde_type = 'klasse'
                 AND (kl.id IS NULL OR kl.slettet IS NOT NULL))
      ORDER BY k.opprettet`,
    [skolearId],
  );
  const ut: Kart[] = [];
  for (const r of rader) {
    const innstillinger = tolkInnstillinger(r.innstillinger);
    if (innstillinger.bareGrupper && !medSkjulte) continue;
    const elever = await hentKildeElever(r.kildeType, r.kildeId, skolearId);
    ut.push({
      id: r.id,
      skolearId: r.skolearId,
      kildeType: r.kildeType,
      kildeId: r.kildeId,
      kildeNavn:
        r.kildeType === "fag"
          ? (r.fagKode ?? "Fag")
          : r.kildeType === "klasse"
            ? (r.klasse ?? "Klasse")
            : "Mentorgruppe",
      farge: r.farge,
      romId: r.romId,
      romNavn: r.romNavn,
      innstillinger,
      antall: elever.length,
      endret: r.endret,
    });
  }
  return ut.sort((a, b) => a.kildeNavn.localeCompare(b.kildeNavn, "nb-NO"));
}

export async function opprettKart(k: {
  skolearId: string;
  kildeType: Kildetype;
  kildeId: string;
  romId: string | null;
}): Promise<string> {
  // Har kilden et skjult gruppekart, blir det kartet — med historikken.
  const skjult = (await hentKart(k.skolearId, true)).find(
    (x) =>
      x.innstillinger.bareGrupper &&
      x.kildeType === k.kildeType &&
      x.kildeId === k.kildeId,
  );
  if (skjult) {
    await endreKart(skjult.id, {
      romId: k.romId,
      innstillinger: { ...skjult.innstillinger, bareGrupper: false },
    });
    return skjult.id;
  }
  const id = await settInn("klassekart", {
    skolear_id: k.skolearId,
    kilde_type: k.kildeType,
    kilde_id: k.kildeId,
    rom_id: k.romId,
    innstillinger: JSON.stringify(STANDARD),
  });
  varsleKlassekart();
  return id;
}

export async function endreKart(
  id: string,
  felter: { romId?: string | null; innstillinger?: Innstillinger },
): Promise<void> {
  await oppdater("klassekart", id, {
    ...(felter.romId !== undefined && { rom_id: felter.romId }),
    ...(felter.innstillinger !== undefined && {
      innstillinger: JSON.stringify(felter.innstillinger),
    }),
  });
  varsleKlassekart();
}

/**
 * Kartet gruppene for en klasse eller et fag hører til (Grupper-fanen):
 * kildens kart om det finnes, ellers et nytt, skjult kart uten rom. Slik
 * deler fanen og klassekartet én historikk.
 */
export async function kartForKilde(
  skolearId: string,
  kildeType: Kildetype,
  kildeId: string,
): Promise<string> {
  const finnes = (await hentKart(skolearId, true)).filter(
    (x) => x.kildeType === kildeType && x.kildeId === kildeId,
  );
  const valgt = finnes.find((x) => !x.innstillinger.bareGrupper) ?? finnes[0];
  if (valgt) return valgt.id;
  const id = await settInn("klassekart", {
    skolear_id: skolearId,
    kilde_type: kildeType,
    kilde_id: kildeId,
    rom_id: null,
    innstillinger: JSON.stringify({ ...STANDARD, bareGrupper: true }),
  });
  varsleKlassekart();
  return id;
}

/**
 * Hvem i kilden som er borte i dag (25.5, «Bare de som er her»): har
 * «ikke i økta» (en verdi som ikke teller) i en økt i dag — i faget, når
 * kilden er et fag, ellers i hvilken som helst økt.
 */
export async function hentBorteIDag(
  kildeType: Kildetype,
  kildeId: string,
  skolearId: string,
  dato = new Date().toLocaleDateString("sv-SE"),
): Promise<Set<string>> {
  const elever = (await hentKildeElever(kildeType, kildeId, skolearId)).map(
    (e) => e.id,
  );
  if (elever.length === 0) return new Set();
  const plass = elever.map((_, i) => `$${i + 3}`).join(", ");
  const rader = await hent<{ id: string }>(
    `SELECT DISTINCT s.elev_id AS id
       FROM skaring s
       JOIN okt o ON o.id = s.okt_id AND o.slettet IS NULL
       JOIN skalaverdi v ON v.id = s.skalaverdi_id
      WHERE s.slettet IS NULL AND v.teller_ikke = 1 AND o.dato = $1
        AND ($2 = '' OR o.skolear_fag_id = $2)
        AND s.elev_id IN (${plass})`,
    [dato, kildeType === "fag" ? kildeId : "", ...elever],
  );
  return new Set(rader.map((r) => r.id));
}

// ------------------------------------------------------------ pultfarger

export type Plassfarge = {
  plass: number;
  farge: string;
  gruppenavn: string | null;
};

/** Gruppefargene på pultene i kartet (25.11). */
export async function hentPlassfarger(kartId: string): Promise<Plassfarge[]> {
  return hent<Plassfarge>(
    `SELECT plass, farge, gruppenavn FROM kart_plassfarge
      WHERE klassekart_id = $1 AND slettet IS NULL ORDER BY plass`,
    [kartId],
  );
}

/** Lagrer alle pultfargene i kartet på nytt, i én transaksjon (#2). */
export async function lagrePlassfarger(
  kartId: string,
  farger: Plassfarge[],
): Promise<void> {
  const gamle = await hent<{ id: string }>(
    "SELECT id FROM kart_plassfarge WHERE klassekart_id = $1 AND slettet IS NULL",
    [kartId],
  );
  const t = new Transaksjon();
  for (const g of gamle) t.slett("kart_plassfarge", g.id);
  for (const f of farger)
    t.settInn("kart_plassfarge", {
      klassekart_id: kartId,
      plass: f.plass,
      farge: f.farge,
      gruppenavn: f.gruppenavn?.trim() || null,
    });
  await t.kjor();
  varsleKlassekart();
}

export async function slettKart(id: string): Promise<void> {
  await slett("klassekart", id);
  varsleKlassekart();
}

// ------------------------------------------------------------------ elevene

export type Kartelev = {
  id: string;
  fornavn: string;
  etternavn: string;
  kjonn: "j" | "g" | null;
  /** 0 (rødt) til 1 (grønt); 0,5 uten skår */
  innsats: number;
  /** om eleven har noen skår å regne innsats av */
  harSkar: boolean;
};

/**
 * Elevene i kilden, med kjønn og innsats. Innsats er snittet av
 * trafikklyset i de siste ti skåringene — i faget, eller på tvers av
 * fagene for klasse og mentorgruppe. `teller_ikke` teller ikke (§5.1).
 */
export async function hentKildeElever(
  kildeType: Kildetype,
  kildeId: string,
  skolearId: string,
): Promise<Kartelev[]> {
  const elever =
    kildeType === "fag"
      ? await hent<Omit<Kartelev, "innsats" | "harSkar">>(
          `SELECT e.id, e.fornavn, e.etternavn, e.kjonn
             FROM elev_fag ef
             JOIN elev e ON e.id = ef.elev_id AND e.slettet IS NULL
            WHERE ef.skolear_fag_id = $1 AND ef.slettet IS NULL`,
          [kildeId],
        )
      : kildeType === "klasse"
        ? await hent<Omit<Kartelev, "innsats" | "harSkar">>(
            `SELECT e.id, e.fornavn, e.etternavn, e.kjonn
               FROM elev_klasse ek
               JOIN elev e ON e.id = ek.elev_id AND e.slettet IS NULL
              WHERE ek.klasse_id = $1 AND ek.slettet IS NULL`,
            [kildeId],
          )
        : await hent<Omit<Kartelev, "innsats" | "harSkar">>(
            `SELECT e.id, e.fornavn, e.etternavn, e.kjonn
               FROM elev_klasse ek
               JOIN elev e ON e.id = ek.elev_id AND e.slettet IS NULL
              WHERE ek.skolear_id = $1 AND ek.mentor = 1
                AND ek.slettet IS NULL`,
            [skolearId],
          );

  const innsats = await hent<{ elevId: string; snitt: number }>(
    `SELECT elevId, AVG(poeng) AS snitt FROM (
       SELECT s.elev_id AS elevId,
              CASE sv.farge WHEN 'gronn' THEN 1.0 WHEN 'gul' THEN 0.5 ELSE 0.0 END
                AS poeng,
              ROW_NUMBER() OVER (PARTITION BY s.elev_id
                                 ORDER BY o.dato DESC, o.klokkeslett DESC) AS n
         FROM skaring s
         JOIN okt o ON o.id = s.okt_id AND o.slettet IS NULL
         JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
         JOIN skalaverdi sv ON sv.id = s.skalaverdi_id
        WHERE s.slettet IS NULL
          AND sv.teller_ikke = 0
          AND sv.farge IN ('gronn', 'gul', 'rod')
          AND sf.skolear_id = $1
          AND ($2 IS NULL OR o.skolear_fag_id = $2)
     ) WHERE n <= 10
     GROUP BY elevId`,
    [skolearId, kildeType === "fag" ? kildeId : null],
  );
  const snitt = new Map(innsats.map((r) => [r.elevId, r.snitt]));
  return elever
    .map((e) => ({
      ...e,
      kjonn: e.kjonn === "j" || e.kjonn === "g" ? e.kjonn : null,
      innsats: snitt.get(e.id) ?? 0.5,
      harSkar: snitt.has(e.id),
    }))
    .sort(
      (a, b) =>
        a.fornavn.localeCompare(b.fornavn, "nb-NO") ||
        a.etternavn.localeCompare(b.etternavn, "nb-NO"),
    );
}

// ------------------------------------------------------- lagrede oppsett

export type Oppsettrad = {
  elevId: string;
  plass?: number | null;
  gruppe?: number | null;
  gruppenavn?: string | null;
  last?: boolean;
};

export type Oppsett = {
  id: string;
  /** når det ble lagret, lokal ISO */
  tid: string;
  /** navnet læreren ga det, f.eks. «Kildeoppgave»; null = bare dato */
  navn: string | null;
  rader: Required<Oppsettrad>[];
};

/**
 * Lagrer et oppsett — «Bruk», utskrift eller kopiering — med et navn om
 * læreren har gitt det. Én transaksjon (#2). Gir id-en tilbake.
 */
export async function lagreOppsett(
  kartId: string,
  type: "plass" | "gruppe",
  rader: Oppsettrad[],
  navn: string | null = null,
): Promise<string> {
  const oppsettId = nyId();
  const t = new Transaksjon();
  t.settInn("oppsett", {
    id: oppsettId,
    klassekart_id: kartId,
    type,
    navn: navn?.trim() || null,
  });
  for (const r of rader)
    t.settInn("plassering", {
      klassekart_id: kartId,
      oppsett_id: oppsettId,
      type,
      elev_id: r.elevId,
      plass: r.plass ?? null,
      gruppe: r.gruppe ?? null,
      gruppenavn: r.gruppenavn ?? null,
      last: r.last ? 1 : 0,
    });
  await t.kjor();
  varsleKlassekart();
  return oppsettId;
}

/** Gir et lagret oppsett et nytt navn. Tomt = bare dato. */
export async function navngiOppsett(id: string, navn: string): Promise<void> {
  await oppdater("oppsett", id, { navn: navn.trim() || null });
  varsleKlassekart();
}

/**
 * Sletter et lagret oppsett, med radene. Det teller da heller ikke lenger
 * i «Unngå samme grupper som sist» eller i hvem som har vært sammen.
 */
export async function slettOppsett(id: string): Promise<void> {
  const rader = await hent<{ id: string }>(
    "SELECT id FROM plassering WHERE oppsett_id = $1 AND slettet IS NULL",
    [id],
  );
  const t = new Transaksjon();
  t.slett("oppsett", id);
  for (const r of rader) t.slett("plassering", r.id);
  await t.kjor();
  varsleKlassekart();
}

/** De lagrede oppsettene i kartet, nyeste først. */
export async function hentOppsett(
  kartId: string,
  type: "plass" | "gruppe",
): Promise<Oppsett[]> {
  const rader = await hent<{
    oppsettId: string;
    tid: string;
    elevId: string;
    plass: number | null;
    gruppe: number | null;
    gruppenavn: string | null;
    last: number;
    navn: string | null;
  }>(
    `SELECT p.oppsett_id AS oppsettId, p.opprettet AS tid, p.elev_id AS elevId,
            p.plass, p.gruppe, p.gruppenavn, p.last, o.navn AS navn
       FROM plassering p
       JOIN elev e ON e.id = p.elev_id AND e.slettet IS NULL
       LEFT JOIN oppsett o ON o.id = p.oppsett_id
      WHERE p.klassekart_id = $1 AND p.type = $2 AND p.slettet IS NULL
        AND (o.id IS NULL OR o.slettet IS NULL)
      ORDER BY p.opprettet DESC, p.oppsett_id`,
    [kartId, type],
  );
  const ut = new Map<string, Oppsett>();
  for (const r of rader) {
    let o = ut.get(r.oppsettId);
    if (!o) {
      o = { id: r.oppsettId, tid: r.tid, navn: r.navn, rader: [] };
      ut.set(r.oppsettId, o);
    }
    o.rader.push({
      elevId: r.elevId,
      plass: r.plass,
      gruppe: r.gruppe,
      gruppenavn: r.gruppenavn,
      last: r.last === 1,
    });
  }
  return [...ut.values()];
}

/**
 * Plasseringen som gjaldt en dag (dokumentasjon fra øktkortet): den siste
 * som var tatt i bruk på eller før dagen. Et kart gjelder til et nytt er
 * brukt. `historikk` er nyeste først, som fra `hentOppsett`. Null når
 * kartet ikke var brukt ennå.
 */
export function gjeldendeOppsett(
  historikk: Oppsett[],
  dato: string,
): Oppsett | null {
  return historikk.find((o) => o.tid.slice(0, 10) <= dato) ?? null;
}

/**
 * Hvem som har delt pult eller gruppe før, og hvor mange ganger. Nøkkelen er
 * de to id-ene sortert og skilt med «|». Vekten er størst for de siste
 * oppsettene: det nyeste teller 1, det forrige 0,8, så 0,64 …
 */
export function sammenFor(
  oppsett: Oppsett[],
  samme: (a: Required<Oppsettrad>, b: Required<Oppsettrad>) => boolean,
): { vekt: Map<string, number>; ganger: Map<string, number> } {
  const vekt = new Map<string, number>();
  const ganger = new Map<string, number>();
  oppsett.forEach((o, i) => {
    const v = Math.pow(0.8, i);
    for (let a = 0; a < o.rader.length; a++)
      for (let b = a + 1; b < o.rader.length; b++) {
        if (!samme(o.rader[a], o.rader[b])) continue;
        const k = parNokkel(o.rader[a].elevId, o.rader[b].elevId);
        vekt.set(k, (vekt.get(k) ?? 0) + v);
        ganger.set(k, (ganger.get(k) ?? 0) + 1);
      }
  });
  return { vekt, ganger };
}

export function parNokkel(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// ------------------------------------------------------------- reglene

export type Elevregel = { id: string; elevA: string; elevB: string };

export async function hentRegler(
  kildeType: Kildetype,
  kildeId: string,
): Promise<Elevregel[]> {
  return hent<Elevregel>(
    `SELECT r.id, r.elev_a AS elevA, r.elev_b AS elevB
       FROM elevregel r
       JOIN elev a ON a.id = r.elev_a AND a.slettet IS NULL
       JOIN elev b ON b.id = r.elev_b AND b.slettet IS NULL
      WHERE r.kilde_type = $1 AND r.kilde_id = $2 AND r.slettet IS NULL
      ORDER BY r.opprettet`,
    [kildeType, kildeId],
  );
}

/** «Hold fra hverandre». Finnes regelen fra før, gis den tilbake. */
export async function leggTilRegel(
  kildeType: Kildetype,
  kildeId: string,
  elevA: string,
  elevB: string,
): Promise<string> {
  if (elevA === elevB) throw new Error("En elev kan ikke holdes fra seg selv.");
  const [finnes] = await hent<{ id: string }>(
    `SELECT id FROM elevregel
      WHERE kilde_type = $1 AND kilde_id = $2 AND slettet IS NULL
        AND ((elev_a = $3 AND elev_b = $4) OR (elev_a = $4 AND elev_b = $3))`,
    [kildeType, kildeId, elevA, elevB],
  );
  if (finnes) return finnes.id;
  const id = await settInn("elevregel", {
    kilde_type: kildeType,
    kilde_id: kildeId,
    elev_a: elevA,
    elev_b: elevB,
  });
  varsleKlassekart();
  return id;
}

export async function slettRegel(id: string): Promise<void> {
  await slett("elevregel", id);
  varsleKlassekart();
}

/** Til sletting av en elev: plasseringene og reglene går med. */
export async function slettForElev(elevId: string): Promise<void> {
  const t = new Transaksjon();
  await slettForElevI(t, elevId);
  await t.kjor();
}

/** Som `slettForElev`, men inn i en større transaksjon (#2). */
export async function slettForElevI(
  t: Transaksjon,
  elevId: string,
): Promise<void> {
  const plasseringer = await hent<{ id: string }>(
    "SELECT id FROM plassering WHERE elev_id = $1 AND slettet IS NULL",
    [elevId],
  );
  for (const r of plasseringer) t.slett("plassering", r.id);
  const regler = await hent<{ id: string }>(
    `SELECT id FROM elevregel
      WHERE (elev_a = $1 OR elev_b = $1) AND slettet IS NULL`,
    [elevId],
  );
  for (const r of regler) t.slett("elevregel", r.id);
}

// ------------------------------------------------------------ elevkortet

type Navn = { id: string; fornavn: string; etternavn: string };

export type ElevIKart = {
  kartId: string;
  kildeType: Kildetype;
  kildeId: string;
  kildeNavn: string;
  romNavn: string | null;
  /** plassen i sist brukte plassering; null når kartet ikke er brukt */
  plass: number | null;
  last: boolean;
  /** raden plassen står på, forfra (1 = første rad) */
  rad: number | null;
  /** de som sitter ved samme pult */
  sitterVed: Navn[];
  /** «hold fra hverandre» med eleven, i kartets kilde */
  regler: { id: string; andre: Navn }[];
  /** de andre i kilden — til «+ Legg til» */
  medelever: Navn[];
  /** hvem eleven har vært i gruppe med i kartets lagrede grupper, oftest først */
  iGruppeMed: (Navn & { ganger: number })[];
};

/** Hvem eleven har vært i samme gruppe med, og hvor mange ganger. */
export function gruppekamerater(
  oppsett: Oppsett[],
  elevId: string,
): Map<string, number> {
  const ganger = new Map<string, number>();
  for (const o of oppsett) {
    const min = o.rader.find((r) => r.elevId === elevId);
    if (min?.gruppe == null) continue;
    for (const r of o.rader)
      if (r.elevId !== elevId && r.gruppe === min.gruppe)
        ganger.set(r.elevId, (ganger.get(r.elevId) ?? 0) + 1);
  }
  return ganger;
}

/**
 * Hvor eleven sitter i kartene i året, til elevkortet (lerretet «ElevArk»):
 * kartet, rommet, hvem eleven sitter ved, låsen og «kan ikke sitte med».
 */
export async function hentElevIKart(
  elevId: string,
  skolearId: string,
): Promise<ElevIKart[]> {
  const [kartene, rommene] = await Promise.all([
    // Også de skjulte gruppekartene: gruppeloggen hører til eleven.
    hentKart(skolearId, true),
    hentRom(),
  ]);
  const ut: ElevIKart[] = [];
  for (const k of kartene) {
    const elever = await hentKildeElever(k.kildeType, k.kildeId, skolearId);
    if (!elever.some((e) => e.id === elevId)) continue;
    const navn = new Map<string, Navn>(
      elever.map((e) => [
        e.id,
        { id: e.id, fornavn: e.fornavn, etternavn: e.etternavn },
      ]),
    );
    const rom = rommene.find((r) => r.id === k.romId);
    const plasser = plasserIRom(rom?.deler ?? []);
    const [sist] = await hentOppsett(k.id, "plass");
    const min = sist?.rader.find((r) => r.elevId === elevId);
    const minPlass = plasser.find((p) => p.nr === min?.plass);
    const rader = [...new Set(plasser.map((p) => Math.round(p.y / 30)))].sort(
      (a, b) => a - b,
    );
    const sitterVed = minPlass
      ? (sist?.rader ?? [])
          .filter((r) => r.elevId !== elevId)
          // Makkerne: ved siden av, vannrett (ikke overfor ved et firerbord).
          .filter((r) =>
            makkere(plasser).some(
              ([a, b]) =>
                (a === minPlass.nr && b === r.plass) ||
                (b === minPlass.nr && a === r.plass),
            ),
          )
          .map((r) => navn.get(r.elevId))
          .filter((x): x is Navn => !!x)
      : [];
    const regler = (await hentRegler(k.kildeType, k.kildeId))
      .filter((r) => r.elevA === elevId || r.elevB === elevId)
      .map((r) => ({
        id: r.id,
        andre: navn.get(r.elevA === elevId ? r.elevB : r.elevA),
      }))
      .filter((r): r is { id: string; andre: Navn } => !!r.andre);
    ut.push({
      kartId: k.id,
      kildeType: k.kildeType,
      kildeId: k.kildeId,
      kildeNavn: k.kildeNavn,
      romNavn: k.romNavn,
      plass: minPlass?.nr ?? null,
      last: !!min?.last,
      rad: minPlass ? rader.indexOf(Math.round(minPlass.y / 30)) + 1 : null,
      sitterVed,
      regler,
      medelever: [...navn.values()].filter((e) => e.id !== elevId),
      iGruppeMed: [
        ...gruppekamerater(await hentOppsett(k.id, "gruppe"), elevId),
      ]
        .map(([id, ganger]) => {
          const n = navn.get(id);
          return n ? { ...n, ganger } : null;
        })
        .filter((x): x is Navn & { ganger: number } => !!x)
        .sort(
          (a, b) => b.ganger - a.ganger || a.fornavn.localeCompare(b.fornavn),
        ),
    });
  }
  return ut;
}
