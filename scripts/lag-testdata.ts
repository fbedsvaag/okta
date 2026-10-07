/**
 * Bygger testbasen fra `dummydata/testbase/` (eieren, 07.10.2026).
 *
 *   npm run testdata
 *
 * Lukk appen først. Skriptet
 *
 *   1. tar kopi av arbeidsfila, ved siden av den
 *      (elevtracking-for-testdata-<tid>.sqlite),
 *   2. tømmer alle tabeller med elever og undervisning: migrasjonene, de
 *      innebygde skalaene og innstillingene (utseende, zoom osv.) står,
 *   3. lager skoleåret 2026/27 med fridager, tre klasser à 32 elever
 *      (3STA Sopranos, 3STB Andeby, 3STC Tolkien) og tre fag (Norsk vg3,
 *      Historie vg3, Religion og etikk) med perioder, økter for hele året,
 *      kompetansemål, planer, logger, lekser, skåringer og fravær fram til i
 *      dag, vurderinger med resultater, notater og gjøremål.
 *
 * Alt skrives gjennom appens eget datalag (src/data), så det får samme
 * UUID-er, stempler og regler som når læreren gjør det selv. Tilfeldighetene
 * har fast frø, så to kjøringer gir samme base.
 *
 * Det kjøres som en «test» i Vitest fordi det er der datalaget kan kobles
 * til en vanlig SQLite-fil i stedet for Tauri: se scripts/testdata.config.ts.
 */
import { test, vi } from "vitest";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

const MAPPE = join(
  homedir(),
  "Library",
  "Application Support",
  "no.elevtracking.app",
);
const FIL = join(MAPPE, "elevtracking.sqlite");
const DATA = join(import.meta.dirname, "..", "dummydata", "testbase");

// ------------------------------------------------------------ tilkoblingen

/** Samme form som `@tauri-apps/plugin-sql`, over en vanlig SQLite-fil. */
let base: DatabaseSync | null = null;
function navngi(args: unknown[]): Record<string, SQLInputValue> {
  return Object.fromEntries(
    args.map((v, i) => [String(i + 1), (v ?? null) as SQLInputValue]),
  );
}
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: async () => ({
      select: async (sql: string, args: unknown[] = []) =>
        base!.prepare(sql).all(navngi(args)),
      execute: async (sql: string, args: unknown[] = []) => {
        const r = base!.prepare(sql).run(navngi(args));
        return { rowsAffected: Number(r.changes) };
      },
    }),
  },
}));

// ------------------------------------------------------------ hjelpere

/** Fast frø: samme base hver gang. */
function rng(frø: number) {
  return () => {
    frø |= 0;
    frø = (frø + 0x6d2b79f5) | 0;
    let t = Math.imul(frø ^ (frø >>> 15), 1 | frø);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const tilfeldig = rng(20261007);
const velg = <T>(l: T[]) => l[Math.floor(tilfeldig() * l.length)];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const IDAG = new Date().toLocaleDateString("sv-SE");

// Trafikklyset fra 002_seed_skalaer.sql.
const IKKE_I_OKTA = "5ca1ade1-0001-4000-8000-000000000001";
const ROD = "5ca1ade1-0001-4000-8000-000000000002";
const GUL = "5ca1ade1-0001-4000-8000-000000000003";
const GRONN = "5ca1ade1-0001-4000-8000-000000000004";

type Fagdata = {
  kode: string;
  alias: string;
  navn: string;
  grep: string;
  farge: string;
  rom: string;
  klasse: string;
  tider: { ukedag: number; kl: string; min: number }[];
  perioder: { navn: string; til: string; mal: number[]; temaer: string[] }[];
  vurderinger: {
    tittel: string;
    type: "skriftlig" | "muntlig";
    frist: string;
  }[];
};

// ------------------------------------------------------------ selve jobben

test("bygger testbasen", { timeout: 600_000 }, async () => {
  if (!existsSync(FIL))
    throw new Error(
      `Fant ikke ${FIL}. Start appen én gang, så den lager basen.`,
    );

  const kopi = join(
    MAPPE,
    `elevtracking-for-testdata-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
  );
  copyFileSync(FIL, kopi);
  console.log(`Kopi av basen: ${kopi}`);

  base = new DatabaseSync(FIL);
  tom(base);

  const oppsett = JSON.parse(readFileSync(join(DATA, "fag.json"), "utf8"));
  const grep = JSON.parse(
    readFileSync(
      join(import.meta.dirname, "..", "src", "assets", "grep-fag.json"),
      "utf8",
    ),
  ) as {
    fag: { fagkode: string | null; kompetansemaal: { kode: string }[] }[];
  };

  const { opprettSkolear, opprettFridag, settInnstilling } =
    await import("../src/data/skolear");
  const {
    opprettElev,
    finnEllerOpprettKlasse,
    settKlasse,
    settMentor,
    koblePaFag,
    settKjonn,
  } = await import("../src/data/elever");
  const { leggFagIAr, endreFagIAr, endreFag } = await import("../src/data/fag");
  const { opprettOkt, endreOkt, settSkaring, settSkaringsnotat, slettOkt } =
    await import("../src/data/okter");
  const { opprettPeriode, fargelegg, settPeriodemal } =
    await import("../src/data/perioder");
  const {
    opprettVurdering,
    hentVurderingsskalaer,
    hentSkalaverdier,
    settResultat,
  } = await import("../src/data/vurderinger");
  const { opprettElevnotat, settLukket } =
    await import("../src/data/elevnotat");
  const { nyttGjoremal } = await import("../src/data/gjoremal");
  const { rodekart } = await import("../src/data/kalender");
  const { parseListe } = await import("../src/import/parser");
  const { gjettKjonn } = await import("../src/import/kjonn");

  // Skoleåret og fridagene.
  const ar = oppsett.skolear;
  const skolearId = await opprettSkolear(ar.navn, ar.start, ar.slutt);
  for (const f of ar.fridager)
    await opprettFridag(skolearId, f.navn, f.type, f.fra, f.til);
  await settInnstilling("laerer_navn", oppsett.laerer);
  await settInnstilling("standard_varighet_min", "90");

  // Elevene, klasse for klasse. Fagkoblingen settes tilbake til før
  // skolestart, ellers ville appen ikke gitt fravær for øktene som er holdt
  // (en elev som kom inn i faget etter en økt, får ikke fravær for den).
  const klasser = new Map<string, string[]>();
  for (const fil of [
    "3STA-sopranos.txt",
    "3STB-andeby.txt",
    "3STC-tolkien.txt",
  ]) {
    const { elever } = parseListe(readFileSync(join(DATA, fil), "utf8"));
    for (const [i, e] of elever.entries()) {
      const id = await opprettElev(e.fornavn, e.etternavn);
      const klasseId = await finnEllerOpprettKlasse(skolearId, e.klasse!);
      await settKlasse(id, skolearId, klasseId);
      const k = gjettKjonn(e.fornavn);
      if (k) await settKjonn(id, k, "satt");
      // Mentorgruppa: halve 3STA.
      if (e.klasse === "3STA" && i < 16) await settMentor(id, skolearId, true);
      klasser.set(e.klasse!, [...(klasser.get(e.klasse!) ?? []), id]);
    }
  }

  const karakter = (await hentVurderingsskalaer()).find((s) =>
    /1.6/.test(s.navn),
  )!;
  const karakterer = await hentSkalaverdier(karakter.id);
  const rode = rodekart(ar.start, ar.slutt);
  const fri = (dato: string) =>
    rode.has(dato) ||
    ar.fridager.some(
      (f: { type: string; fra: string; til: string }) =>
        f.type !== "hendelse" && dato >= f.fra && dato <= f.til,
    );

  for (const fag of oppsett.fag as Fagdata[]) {
    const kmal = grep.fag.find((g) => g.fagkode === fag.grep)!.kompetansemaal;
    const arstimer = Number(
      (
        grep.fag.find((g) => g.fagkode === fag.grep) as unknown as {
          timer: number;
        }
      ).timer,
    );
    const fagId = await leggFagIAr(
      skolearId,
      fag.kode,
      fag.navn,
      fag.farge,
      fag.grep,
      arstimer,
    );
    const sf = base
      .prepare("SELECT fag_id FROM skolear_fag WHERE id = ?")
      .get(fagId) as { fag_id: string };
    await endreFag(sf.fag_id, { alias: fag.alias });
    await endreFagIAr(fagId, { rom: fag.rom });

    const elever = klasser.get(fag.klasse)!;
    for (const e of elever) await koblePaFag(e, fagId);
    base
      .prepare("UPDATE elev_fag SET opprettet = ? WHERE skolear_fag_id = ?")
      .run(`${ar.start}T08:00:00`, fagId);

    // Øktene: hver uke på de faste tidene, utenom ferier og røde dager.
    const okter: { id: string; dato: string; min: number }[] = [];
    for (
      let d = new Date(`${ar.start}T00:00:00Z`);
      iso(d) <= ar.slutt;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const dato = iso(d);
      if (fri(dato)) continue;
      for (const t of fag.tider)
        if (d.getUTCDay() === t.ukedag)
          okter.push({
            id: await opprettOkt(fagId, fag.kode, dato, t.kl, t.min),
            dato,
            min: t.min,
          });
    }

    // Ikke flere timer enn årstimetallet: de siste øktene i året stryks.
    let sum = okter.reduce((s, o) => s + o.min, 0);
    while (sum > arstimer * 60) {
      const siste = okter.pop()!;
      sum -= siste.min;
      await slettOkt(siste.id);
    }

    // Periodene, med tema på hver økt og kompetansemålene periodene dekker.
    let fra = 0;
    for (const [pi, p] of fag.perioder.entries()) {
      const egne = okter.slice(fra).filter((o) => o.dato <= p.til);
      fra += egne.length;
      const periodeId = await opprettPeriode(fagId, p.navn, null, null, pi);
      await fargelegg(
        egne.map((o) => o.id),
        periodeId,
      );
      for (const n of p.mal)
        await settPeriodemal(periodeId, kmal[n - 1].kode, true);
      for (const [i, o] of egne.entries()) {
        const tema =
          i < p.temaer.length
            ? p.temaer[i]
            : `${p.temaer[i % p.temaer.length]} (${["arbeidsøkt", "fordypning", "oppsummering"][Math.floor(i / p.temaer.length) % 3]})`;
        const fortid = o.dato < IDAG;
        const narFremtid =
          !fortid &&
          okter.findIndex((x) => x.id === o.id) -
            okter.findIndex((x) => x.dato >= IDAG) <
            6;
        await endreOkt(o.id, {
          tema,
          lekse: i % 4 === 2 ? velg(oppsett.lekser) : null,
          agenda: narFremtid ? `Repetisjon · ${tema} · Exit-lapp` : null,
          plan:
            narFremtid || (fortid && tilfeldig() < 0.3)
              ? velg(oppsett.planer)
              : null,
          // Avkrysningene i loggen blir gjøremål på I dag. De eldre er gjort.
          logg:
            fortid && tilfeldig() < 0.75
              ? o.dato <
                new Date(Date.now() - 7 * 86_400_000).toLocaleDateString(
                  "sv-SE",
                )
                ? velg(oppsett.logger as string[]).replace("- [ ]", "- [x]")
                : velg(oppsett.logger)
              : null,
        });
      }
    }

    // Skåringer og fravær fram til i dag. Hver elev har sitt nivå og sitt
    // fravær; noen få er mye borte, så fraværsmerkene får noe å vise.
    const profil = elever.map((_, i) => ({
      niva: 0.35 + tilfeldig() * 0.6,
      borte:
        i === 3
          ? 0.62
          : i === 7
            ? 0.32
            : i === 11
              ? 0.2
              : i === 19
                ? 0.12
                : 0.03,
    }));
    for (const o of okter.filter((x) => x.dato < IDAG)) {
      for (const [i, e] of elever.entries()) {
        const p = profil[i];
        if (tilfeldig() < p.borte) {
          // Halvparten trykkes som «ikke i økta», resten står tomme; begge er borte.
          if (tilfeldig() < 0.5) await settSkaring(e, o.id, IKKE_I_OKTA);
          continue;
        }
        const r = tilfeldig();
        const verdi =
          r < p.niva ? GRONN : r < p.niva + (1 - p.niva) * 0.65 ? GUL : ROD;
        await settSkaring(e, o.id, verdi);
        if (tilfeldig() < 0.04)
          await settSkaringsnotat(e, o.id, velg(oppsett.elevnotater));
      }
    }

    // Vurderinger, med resultater når fristen er passert.
    for (const v of fag.vurderinger) {
      const vid = await opprettVurdering(
        fagId,
        karakter.id,
        v.tittel,
        v.type,
        v.frist,
      );
      if (v.frist >= IDAG) continue;
      for (const [i, e] of elever.entries()) {
        if (profil[i].borte > 0.5) continue;
        const n = Math.max(
          2,
          Math.min(
            6,
            Math.round(2 + profil[i].niva * 4 + (tilfeldig() - 0.5) * 1.5),
          ),
        );
        const verdi = karakterer.find((k) => k.kode === String(n));
        if (verdi) await settResultat(vid, e, verdi);
      }
    }
  }

  // Notater og oppfølging på noen elever, og to gjøremål.
  const sopranos = klasser.get("3STA")!;
  const forrigeUke = new Date(Date.now() - 6 * 86_400_000).toLocaleDateString(
    "sv-SE",
  );
  await opprettElevnotat(sopranos[3], skolearId, {
    dato: forrigeUke,
    tekst: "Mye fravær siste uker. Avtalt samtale med kontaktlærer.",
    skalFolgesOpp: true,
    frist: forrigeUke,
  });
  await opprettElevnotat(sopranos[7], skolearId, {
    dato: forrigeUke,
    tekst: "Spurte om hjelp med struktur i skriftlige oppgaver.",
    skalFolgesOpp: true,
  });
  const lukket = await opprettElevnotat(sopranos[0], skolearId, {
    dato: "2026-09-02",
    tekst: "Oppstartssamtale. Mål for året: jobbe jevnere med lesing.",
    skalFolgesOpp: true,
  });
  await settLukket(lukket, true);
  await opprettElevnotat(klasser.get("3STB")![5], skolearId, {
    dato: "2026-09-21",
    tekst: "Leste høyt for klassen for første gang i år.",
  });
  await nyttGjoremal(skolearId, {
    tekst: "Kopier prøvene til fredag",
    frist: IDAG,
  });
  await nyttGjoremal(skolearId, {
    tekst: "Bestille rom til muntlig fordypning",
  });

  const tell = (t: string) =>
    (
      base!
        .prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE slettet IS NULL`)
        .get() as { n: number }
    ).n;
  console.log(
    `Ferdig: ${tell("elev")} elever, ${tell("skolear_fag")} fag, ${tell("okt")} økter, ` +
      `${tell("skaring")} skåringer, ${tell("vurdering")} vurderinger.`,
  );
  base.close();
});

/**
 * Tømmer basen for elever og undervisning. Det som står igjen: migrasjonene,
 * de innebygde skalaene og innstillingene, unntatt hvilket skoleår som er
 * aktivt (det finnes ikke lenger).
 */
function tom(b: DatabaseSync) {
  const behold = new Set([
    "_sqlx_migrations",
    "skala",
    "skalaverdi",
    "innstilling",
  ]);
  const tabeller = (
    b
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as {
      name: string;
    }[]
  ).map((r) => r.name);
  b.exec("PRAGMA foreign_keys = OFF");
  b.exec("BEGIN");
  for (const t of tabeller) if (!behold.has(t)) b.exec(`DELETE FROM "${t}"`);
  b.exec(
    "DELETE FROM skalaverdi WHERE skala_id IN (SELECT id FROM skala WHERE innebygd = 0)",
  );
  b.exec("DELETE FROM skala WHERE innebygd = 0");
  b.exec("DELETE FROM innstilling WHERE nokkel = 'aktivt_skolear'");
  b.exec("COMMIT");
  b.exec("PRAGMA foreign_keys = ON");
  b.exec("VACUUM");
}
