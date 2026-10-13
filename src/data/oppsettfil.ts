import { db, hent, naa, nyId, oppdater, settInn } from "../db";
import { hentFagIAr } from "./fag";
import {
  hentAktivtSkolear,
  hentFridager,
  hentInnstilling,
  opprettFridag,
  opprettSkolear,
  settInnstilling,
} from "./skolear";
import { LAERERNAVN } from "./arsplanark";
import { FAGFARGER } from "../ui/farger";

/**
 * Oppsettfila, SPEC §8.2 og docs/oppsettfil.md.
 *
 * En lærer lager fila, en kollega leser den inn og slipper å skrive inn
 * skoleåret, fridagene og faglista selv.
 *
 * **Personvern.** Fila bygges felt for felt fra en fast liste (hviteliste),
 * og leser bare fra `skolear`, `fridag`, `fag`, `skolear_fag`, `innstilling`
 * og `skala`/`skalaverdi`. Ingen elevtabell leses. Importen avviser en fil
 * med nøkler som ikke står på lista.
 */

export const FORMAT = "okta-oppsett";
export const VERSJON = 1;

export type Oppsettfag = {
  kode: string;
  navn: string;
  alias: string | null;
  grep_kode: string | null;
  arstimetall: number | null;
  standard_varighet_min: number | null;
};

export type Oppsettskala = {
  navn: string;
  bruksomrade: "skaring" | "vurdering" | "begge";
  verdier: {
    kode: string;
    etikett: string | null;
    rang: number;
    farge: string | null;
    bestatt: number | null;
    teller_ikke: number;
  }[];
};

export type Oppsett = {
  format: typeof FORMAT;
  versjon: number;
  laget: string;
  laget_av: string | null;
  skole: string | null;
  skolear: { navn: string; start: string; slutt: string } | null;
  fridager: { navn: string; type: string; fra: string; til: string }[];
  fag: Oppsettfag[];
  innstillinger: { standard_varighet_min?: number };
  skalaer: Oppsettskala[];
};

/** Delene som kan krysses av i eksporten. */
export type Deler = {
  skolear: boolean;
  fag: boolean;
  oktlengde: boolean;
  skalaer: boolean;
};

// ------------------------------------------------------------------ eksport

/** Bygger oppsettet fra det aktive skoleåret. Ingenting om elever. */
export async function lagOppsett(valg: {
  skole: string | null;
  deler: Deler;
}): Promise<Oppsett> {
  const ar = await hentAktivtSkolear();
  const fridager = valg.deler.skolear && ar ? await hentFridager(ar.id) : [];
  const fag = valg.deler.fag && ar ? await hentFagIAr(ar.id) : [];
  const varighet = valg.deler.oktlengde
    ? await hentInnstilling("standard_varighet_min")
    : null;

  const skalaer: Oppsettskala[] = [];
  if (valg.deler.skalaer) {
    const egne = await hent<{
      id: string;
      navn: string;
      bruksomrade: Oppsettskala["bruksomrade"];
    }>(
      "SELECT id, navn, bruksomrade FROM skala WHERE innebygd = 0 AND slettet IS NULL ORDER BY navn",
    );
    for (const s of egne) {
      const verdier = await hent<Oppsettskala["verdier"][number]>(
        `SELECT kode, etikett, rang, farge, bestatt, teller_ikke
           FROM skalaverdi WHERE skala_id = $1 ORDER BY rang`,
        [s.id],
      );
      skalaer.push({ navn: s.navn, bruksomrade: s.bruksomrade, verdier });
    }
  }

  return {
    format: FORMAT,
    versjon: VERSJON,
    laget: lokalTid(),
    laget_av: (await hentInnstilling(LAERERNAVN))?.trim() || null,
    skole: valg.skole?.trim() || null,
    skolear:
      valg.deler.skolear && ar
        ? { navn: ar.navn, start: ar.start, slutt: ar.slutt }
        : null,
    fridager: fridager.map((f) => ({
      navn: f.navn,
      type: f.type,
      fra: f.fra,
      til: f.til,
    })),
    fag: fag.map((f) => ({
      kode: f.fagkode,
      navn: f.navn,
      alias: f.alias,
      grep_kode: f.grepKode,
      arstimetall: f.arstimetall,
      standard_varighet_min: f.standardVarighetMin,
    })),
    innstillinger:
      varighet && Number(varighet) > 0
        ? { standard_varighet_min: Number(varighet) }
        : {},
    skalaer,
  };
}

/** «BPG-oppsett 2026-27.okta» */
export function filnavn(o: Oppsett): string {
  const ar = (o.skolear?.navn ?? "").replace(/\//g, "-");
  const skole = o.skole ? `${o.skole}-` : "";
  return `${skole}oppsett${ar ? ` ${ar}` : ""}.okta`.replace(
    /[\\:*?"<>|]/g,
    "",
  );
}

// ------------------------------------------------------------------ lesing

const TOPPNOKLER = [
  "format",
  "versjon",
  "laget",
  "laget_av",
  "skole",
  "skolear",
  "fridager",
  "fag",
  "innstillinger",
  "skalaer",
];
const FAGNOKLER = [
  "kode",
  "navn",
  "alias",
  "grep_kode",
  "arstimetall",
  "standard_varighet_min",
];
const FRIDAGTYPER = ["ferie", "planlegging", "annet", "hendelse", "helligdag"];
const VERDINOKLER = [
  "kode",
  "etikett",
  "rang",
  "farge",
  "bestatt",
  "teller_ikke",
];

const erDato = (s: unknown): s is string =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const objekt = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * Leser og sjekker fila. Returnerer oppsettet, eller en liste med feil på
 * norsk som sier hva som er galt.
 */
export function lesOppsett(
  tekst: string,
): { ok: true; oppsett: Oppsett } | { ok: false; feil: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(tekst);
  } catch {
    return {
      ok: false,
      feil: [
        "Fila er ikke en oppsettfil fra Økta (den kan ikke leses som JSON).",
      ],
    };
  }
  if (!objekt(data) || data.format !== FORMAT)
    return { ok: false, feil: ["Fila er ikke en oppsettfil fra Økta."] };
  if (typeof data.versjon !== "number" || data.versjon > VERSJON)
    return {
      ok: false,
      feil: [
        `Fila er laget i en nyere versjon av Økta (format ${String(data.versjon)}). Oppdater appen og prøv igjen.`,
      ],
    };

  const feil: string[] = [];
  const ukjente = (o: Record<string, unknown>, lov: string[], hvor: string) => {
    for (const k of Object.keys(o))
      if (!lov.includes(k))
        feil.push(`Ukjent felt «${k}» ${hvor}. Fila godtas ikke.`);
  };
  ukjente(data, TOPPNOKLER, "øverst i fila");

  const ar = data.skolear;
  if (ar !== null && ar !== undefined) {
    if (!objekt(ar)) feil.push("Skoleåret er ikke lesbart.");
    else {
      ukjente(ar, ["navn", "start", "slutt"], "i skoleåret");
      if (typeof ar.navn !== "string" || !ar.navn.trim())
        feil.push("Skoleåret mangler navn.");
      if (!erDato(ar.start))
        feil.push("Skoleårets startdato er ikke en gyldig dato.");
      if (!erDato(ar.slutt))
        feil.push("Skoleårets sluttdato er ikke en gyldig dato.");
      if (erDato(ar.start) && erDato(ar.slutt) && ar.start >= ar.slutt)
        feil.push("Skoleåret slutter før det starter.");
    }
  }

  const fridager = Array.isArray(data.fridager) ? data.fridager : [];
  if (data.fridager !== undefined && !Array.isArray(data.fridager))
    feil.push("Fridagene er ikke en liste.");
  for (const [i, f] of fridager.entries()) {
    if (!objekt(f)) {
      feil.push(`Fridag nr. ${i + 1} er ikke lesbar.`);
      continue;
    }
    ukjente(f, ["navn", "type", "fra", "til"], `i fridag nr. ${i + 1}`);
    const hvem =
      typeof f.navn === "string" && f.navn ? `«${f.navn}»` : `nr. ${i + 1}`;
    if (typeof f.navn !== "string" || !f.navn.trim())
      feil.push(`Fridag nr. ${i + 1} mangler navn.`);
    if (!FRIDAGTYPER.includes(f.type as string))
      feil.push(`Fridagen ${hvem} har en ukjent type.`);
    if (!erDato(f.fra) || !erDato(f.til))
      feil.push(`Fridagen ${hvem} har en ugyldig dato.`);
    else if (f.fra > f.til)
      feil.push(`Fridagen ${hvem} slutter før den starter.`);
    else if (
      objekt(ar) &&
      erDato(ar.start) &&
      erDato(ar.slutt) &&
      (f.til < ar.start || f.fra > ar.slutt)
    )
      feil.push(`Fridagen ${hvem} ligger utenfor skoleåret.`);
  }

  const fag = Array.isArray(data.fag) ? data.fag : [];
  if (data.fag !== undefined && !Array.isArray(data.fag))
    feil.push("Fagene er ikke en liste.");
  const koder = new Set<string>();
  for (const [i, f] of fag.entries()) {
    if (!objekt(f)) {
      feil.push(`Fag nr. ${i + 1} er ikke lesbart.`);
      continue;
    }
    ukjente(f, FAGNOKLER, `i fag nr. ${i + 1}`);
    if (typeof f.kode !== "string" || !f.kode.trim()) {
      feil.push(`Fag nr. ${i + 1} mangler kode.`);
      continue;
    }
    if (typeof f.navn !== "string" || !f.navn.trim())
      feil.push(`Faget ${f.kode} mangler navn.`);
    const k = f.kode.trim().toLowerCase();
    if (koder.has(k)) feil.push(`Faget ${f.kode} står to ganger.`);
    koder.add(k);
    for (const tall of ["arstimetall", "standard_varighet_min"] as const)
      if (
        f[tall] !== null &&
        f[tall] !== undefined &&
        !(typeof f[tall] === "number" && (f[tall] as number) > 0)
      )
        feil.push(
          `Faget ${f.kode} har et ugyldig ${tall === "arstimetall" ? "årstimetall" : "øktlengde"}.`,
        );
  }

  const inn = data.innstillinger;
  if (inn !== undefined) {
    if (!objekt(inn)) feil.push("Innstillingene er ikke lesbare.");
    else {
      ukjente(inn, ["standard_varighet_min"], "i innstillingene");
      if (
        inn.standard_varighet_min !== undefined &&
        !(
          typeof inn.standard_varighet_min === "number" &&
          inn.standard_varighet_min > 0
        )
      )
        feil.push("Øktlengden i innstillingene er ugyldig.");
    }
  }

  const skalaer = Array.isArray(data.skalaer) ? data.skalaer : [];
  for (const [i, s] of skalaer.entries()) {
    if (!objekt(s)) {
      feil.push(`Skala nr. ${i + 1} er ikke lesbar.`);
      continue;
    }
    ukjente(s, ["navn", "bruksomrade", "verdier"], `i skala nr. ${i + 1}`);
    if (typeof s.navn !== "string" || !s.navn.trim())
      feil.push(`Skala nr. ${i + 1} mangler navn.`);
    if (!["skaring", "vurdering", "begge"].includes(s.bruksomrade as string))
      feil.push(`Skalaen ${String(s.navn)} har et ukjent bruksområde.`);
    if (!Array.isArray(s.verdier) || s.verdier.length === 0)
      feil.push(`Skalaen ${String(s.navn)} har ingen verdier.`);
    else
      for (const v of s.verdier) {
        if (
          !objekt(v) ||
          typeof v.kode !== "string" ||
          typeof v.rang !== "number"
        )
          feil.push(
            `Skalaen ${String(s.navn)} har en verdi som ikke er lesbar.`,
          );
        else ukjente(v, VERDINOKLER, `i skalaen ${String(s.navn)}`);
      }
  }

  if (feil.length > 0) return { ok: false, feil };

  return {
    ok: true,
    oppsett: {
      format: FORMAT,
      versjon: data.versjon as number,
      laget: typeof data.laget === "string" ? data.laget : "",
      laget_av: typeof data.laget_av === "string" ? data.laget_av : null,
      skole: typeof data.skole === "string" ? data.skole : null,
      skolear: objekt(ar)
        ? {
            navn: (ar.navn as string).trim(),
            start: ar.start as string,
            slutt: ar.slutt as string,
          }
        : null,
      fridager: fridager as Oppsett["fridager"],
      fag: (fag as Record<string, unknown>[]).map((f) => ({
        kode: (f.kode as string).trim(),
        navn: (f.navn as string).trim(),
        alias:
          typeof f.alias === "string" && f.alias.trim() ? f.alias.trim() : null,
        grep_kode:
          typeof f.grep_kode === "string" && f.grep_kode.trim()
            ? f.grep_kode.trim()
            : null,
        arstimetall: (f.arstimetall as number | null | undefined) ?? null,
        standard_varighet_min:
          (f.standard_varighet_min as number | null | undefined) ?? null,
      })),
      innstillinger: objekt(inn) ? (inn as Oppsett["innstillinger"]) : {},
      skalaer: skalaer as Oppsettskala[],
    },
  };
}

// ------------------------------------------------------------------ import

export type Importplan = {
  oppsett: Oppsett;
  skolear:
    | { status: "ny"; navn: string }
    | { status: "finnes"; id: string; navn: string; ulikeDatoer: boolean }
    | null;
  fridagerNye: Oppsett["fridager"];
  fridagerFinnes: number;
  fagNye: Oppsettfag[];
  fagFinnes: Oppsettfag[];
  settOktlengde: boolean;
  skalaerNye: Oppsettskala[];
  skalaerFinnes: string[];
};

/** Hva importen vil gjøre, uten å skrive noe. */
export async function planleggImport(oppsett: Oppsett): Promise<Importplan> {
  let skolear: Importplan["skolear"] = null;
  let fridagerNye = oppsett.fridager;
  let fridagerFinnes = 0;
  if (oppsett.skolear) {
    const [finnes] = await hent<{ id: string; start: string; slutt: string }>(
      "SELECT id, start, slutt FROM skolear WHERE navn = $1 AND slettet IS NULL",
      [oppsett.skolear.navn],
    );
    if (finnes) {
      skolear = {
        status: "finnes",
        id: finnes.id,
        navn: oppsett.skolear.navn,
        ulikeDatoer:
          finnes.start !== oppsett.skolear.start ||
          finnes.slutt !== oppsett.skolear.slutt,
      };
      const har = await hentFridager(finnes.id);
      const nokkel = (f: { navn: string; fra: string }) => `${f.navn}|${f.fra}`;
      const harNokler = new Set(har.map(nokkel));
      fridagerNye = oppsett.fridager.filter((f) => !harNokler.has(nokkel(f)));
      fridagerFinnes = oppsett.fridager.length - fridagerNye.length;
    } else skolear = { status: "ny", navn: oppsett.skolear.navn };
  }

  const bank = await hent<{ kode: string; grep_kode: string | null }>(
    "SELECT kode, grep_kode FROM fag WHERE slettet IS NULL",
  );
  const koder = new Set(bank.map((f) => f.kode.toLowerCase()));
  const grep = new Set(
    bank.map((f) => f.grep_kode).filter(Boolean) as string[],
  );
  const finnes = (f: Oppsettfag) =>
    koder.has(f.kode.toLowerCase()) ||
    (f.grep_kode !== null && grep.has(f.grep_kode));

  // Øktlengden fra fila gjelder en ny bruker. Basen har en standard fra
  // migrasjonen (180) fra første start, så «ikke satt» er aldri sant; i
  // stedet settes den når det ikke finnes økter ennå. En lærer som har
  // begynt å legge inn økter, beholder sin.
  const varighetNaa = await hentInnstilling("standard_varighet_min");
  const [{ okter }] = await hent<{ okter: number }>(
    "SELECT COUNT(*) AS okter FROM okt WHERE slettet IS NULL",
  );
  const onsket = oppsett.innstillinger.standard_varighet_min;
  const skalanavn = new Set(
    (
      await hent<{ navn: string }>(
        "SELECT navn FROM skala WHERE slettet IS NULL",
      )
    ).map((s) => s.navn.toLowerCase()),
  );

  return {
    oppsett,
    skolear,
    fridagerNye,
    fridagerFinnes,
    fagNye: oppsett.fag.filter((f) => !finnes(f)),
    fagFinnes: oppsett.fag.filter(finnes),
    settOktlengde:
      onsket !== undefined &&
      String(onsket) !== varighetNaa &&
      (varighetNaa === null || okter === 0),
    skalaerNye: oppsett.skalaer.filter(
      (s) => !skalanavn.has(s.navn.toLowerCase()),
    ),
    skalaerFinnes: oppsett.skalaer
      .filter((s) => skalanavn.has(s.navn.toLowerCase()))
      .map((s) => s.navn),
  };
}

/** Planen som setninger, til trinn 3: «Skoleåret 2026/27 opprettes.» */
export function plantekst(p: Importplan): string[] {
  const ut: string[] = [];
  const flertall = (n: number, en: string, flere: string) =>
    `${n} ${n === 1 ? en : flere}`;
  if (p.skolear?.status === "ny")
    ut.push(`Skoleåret ${p.skolear.navn} opprettes.`);
  if (p.skolear?.status === "finnes")
    ut.push(
      p.skolear.ulikeDatoer
        ? `Skoleåret ${p.skolear.navn} finnes fra før, med andre datoer. Datoene dine endres ikke.`
        : `Skoleåret ${p.skolear.navn} finnes fra før.`,
    );
  if (p.fridagerNye.length > 0)
    ut.push(
      `${flertall(p.fridagerNye.length, "fridag", "fridager")} legges inn.`,
    );
  if (p.fridagerFinnes > 0)
    ut.push(
      `${flertall(p.fridagerFinnes, "fridag finnes", "fridager finnes")} fra før.`,
    );
  if (p.fagNye.length > 0)
    ut.push(`${flertall(p.fagNye.length, "fag", "fag")} legges i fagbanken.`);
  if (p.fagFinnes.length > 0)
    ut.push(
      `${flertall(p.fagFinnes.length, "fag", "fag")} finnes fra før: ${p.fagFinnes.map((f) => f.kode).join(", ")}.`,
    );
  if (p.settOktlengde)
    ut.push(
      `Standard øktlengde settes til ${p.oppsett.innstillinger.standard_varighet_min} minutter.`,
    );
  if (p.skalaerNye.length > 0)
    ut.push(
      `${flertall(p.skalaerNye.length, "skala", "skalaer")} legges til: ${p.skalaerNye.map((s) => s.navn).join(", ")}.`,
    );
  if (p.skalaerFinnes.length > 0)
    ut.push(`Skalaene ${p.skalaerFinnes.join(", ")} finnes fra før.`);
  if (ut.length === 0)
    ut.push("Alt i fila finnes fra før. Ingenting legges til.");
  return ut;
}

/**
 * Skriver planen. Sjekk og plan er gjort på forhånd; går noe galt
 * underveis, tas det som alt er lagt inn, bort igjen, så ingenting står
 * halvveis (tilkoblingen har ingen transaksjoner på tvers av kall).
 *
 * Fagene havner i fagbanken, ikke i skoleåret: mottakeren krysser av for
 * dem i oppsettet (§8.2).
 */
export async function importerOppsett(
  p: Importplan,
): Promise<{ skolearId: string | null }> {
  const lagt: { tabell: string; id: string }[] = [];
  const logg = (tabell: string, id: string) => (lagt.push({ tabell, id }), id);
  let aktivFor: string | null = null;
  try {
    let skolearId: string | null =
      p.skolear?.status === "finnes" ? p.skolear.id : null;
    if (p.skolear?.status === "ny" && p.oppsett.skolear) {
      aktivFor = await hentInnstilling("aktivt_skolear");
      const o = p.oppsett.skolear;
      skolearId = logg(
        "skolear",
        await opprettSkolear(o.navn, o.start, o.slutt),
      );
    }
    if (skolearId)
      for (const f of p.fridagerNye)
        logg(
          "fridag",
          await opprettFridag(skolearId, f.navn, f.type as never, f.fra, f.til),
        );

    const [{ n }] = await hent<{ n: number }>("SELECT COUNT(*) AS n FROM fag");
    for (const [i, f] of p.fagNye.entries())
      logg(
        "fag",
        await settInn("fag", {
          kode: f.kode,
          navn: f.navn,
          alias: f.alias,
          grep_kode: f.grep_kode,
          farge: FAGFARGER[(n + i) % FAGFARGER.length],
        }),
      );

    if (p.settOktlengde)
      await settInnstilling(
        "standard_varighet_min",
        String(p.oppsett.innstillinger.standard_varighet_min),
      );

    for (const s of p.skalaerNye) {
      const id = logg(
        "skala",
        await settInn("skala", {
          navn: s.navn,
          bruksomrade: s.bruksomrade,
          innebygd: 0,
        }),
      );
      for (const v of s.verdier)
        await (
          await db()
        ).execute(
          `INSERT INTO skalaverdi (id, skala_id, kode, etikett, rang, farge, bestatt, teller_ikke)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            nyId(),
            id,
            v.kode,
            v.etikett ?? null,
            v.rang,
            v.farge ?? null,
            v.bestatt ?? null,
            v.teller_ikke ?? 0,
          ],
        );
    }
    return { skolearId };
  } catch (e) {
    // Tilbake til der vi startet.
    for (const r of lagt.reverse())
      await oppdater(r.tabell, r.id, { slettet: naa() }).catch(() => {});
    if (aktivFor !== null)
      await settInnstilling("aktivt_skolear", aktivFor).catch(() => {});
    else
      await (
        await db()
      )
        .execute("DELETE FROM innstilling WHERE nokkel = 'aktivt_skolear'")
        .catch(() => {});
    throw e;
  }
}

/** Fagene fra oppsettet slik de står i fagbanken nå, til avkrysning i veiviseren. */
export async function fagFraOppsett(
  oppsett: Oppsett,
): Promise<(Oppsettfag & { fagId: string; farge: string | null })[]> {
  const bank = await hent<{
    id: string;
    kode: string;
    grep_kode: string | null;
    farge: string | null;
  }>("SELECT id, kode, grep_kode, farge FROM fag WHERE slettet IS NULL");
  return oppsett.fag.flatMap((f) => {
    const b =
      bank.find((x) => x.kode.toLowerCase() === f.kode.toLowerCase()) ??
      bank.find((x) => f.grep_kode !== null && x.grep_kode === f.grep_kode);
    return b ? [{ ...f, fagId: b.id, farge: b.farge }] : [];
  });
}

/** 2026-10-05T18:00:00+02:00 */
function lokalTid(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const o = -d.getTimezoneOffset();
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${o >= 0 ? "+" : "-"}${p(Math.floor(Math.abs(o) / 60))}:${p(Math.abs(o) % 60)}`
  );
}
