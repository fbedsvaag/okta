import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const {
  opprettSkolear,
  opprettFridag,
  settInnstilling,
  hentSkolear,
  hentFridager,
  hentInnstilling,
} = await import("./skolear");
const { leggFagIAr, hentFagbank, endreFag, endreFagIAr } =
  await import("./fag");
const { opprettElev, koblePaFag, finnEllerOpprettKlasse, settKlasse } =
  await import("./elever");
const { opprettOkt, settSkaring, settSkaringsnotat } = await import("./okter");
const { opprettElevnotat } = await import("./elevnotat");
const { settElevbilde } = await import("./elevbilde");
const { hent } = await import("../db");
const {
  lagOppsett,
  lesOppsett,
  planleggImport,
  importerOppsett,
  plantekst,
  filnavn,
} = await import("./oppsettfil");

const ALT = { skolear: true, fag: true, oktlengde: true, skalaer: true };
const GRONN = "5ca1ade1-0001-4000-8000-000000000004";

/** En base med et skoleår, fridager, to fag og en egen skala. */
async function kilde() {
  const ar = await opprettSkolear("2026/27", "2026-08-19", "2027-06-18");
  await opprettFridag(ar, "Høstferie", "ferie", "2026-10-05", "2026-10-09");
  await opprettFridag(ar, "Juleferie", "ferie", "2026-12-21", "2027-01-01");
  const mfl = await leggFagIAr(
    ar,
    "SAM3045",
    "Markedsføring og ledelse 1",
    "#2f5d8a",
    "SAM3045",
    140,
  );
  const [bankfag] = await hentFagbank();
  await endreFag(bankfag.id, { alias: "MFL1" });
  await endreFagIAr(mfl, { standard_varighet_min: 180, rom: "214" });
  await leggFagIAr(ar, "ENG1", "Engelsk 1", null, null, null);
  await settInnstilling("standard_varighet_min", "90");
  await settInnstilling("laerer_navn", "Fredrik Bedsvaag");
  const [{ n }] = await hent<{ n: number }>("SELECT COUNT(*) AS n FROM skala");
  void n;
  await base.execute(
    "INSERT INTO skala (id, navn, bruksomrade, innebygd, opprettet, endret) VALUES ('s1', 'Lav til høy', 'vurdering', 0, 'x', 'x')",
  );
  await base.execute(
    "INSERT INTO skalaverdi (id, skala_id, kode, etikett, rang, farge, bestatt, teller_ikke) VALUES ('v1', 's1', 'Lav', NULL, 10, NULL, NULL, 0), ('v2', 's1', 'Høy', NULL, 20, NULL, NULL, 0)",
  );
  return { ar, mfl };
}

beforeEach(() => base.nullstill());

describe("eksport", () => {
  it("tar med skoleåret, fridagene, fagene, øktlengden og egne skalaer", async () => {
    await kilde();
    const o = await lagOppsett({ skole: "BPG", deler: ALT });
    expect(o.format).toBe("okta-oppsett");
    expect(o.laget_av).toBe("Fredrik Bedsvaag");
    expect(o.skolear).toEqual({
      navn: "2026/27",
      start: "2026-08-19",
      slutt: "2027-06-18",
    });
    expect(o.fridager.map((f) => f.navn)).toEqual(["Høstferie", "Juleferie"]);
    expect(o.fag).toContainEqual({
      kode: "SAM3045",
      navn: "Markedsføring og ledelse 1",
      alias: "MFL1",
      grep_kode: "SAM3045",
      arstimetall: 140,
      standard_varighet_min: 180,
    });
    expect(o.innstillinger).toEqual({ standard_varighet_min: 90 });
    expect(o.skalaer.map((s) => s.navn)).toEqual(["Lav til høy"]);
    // Farge og rom er med vilje ikke med.
    expect(JSON.stringify(o)).not.toContain("#2f5d8a");
    expect(JSON.stringify(o)).not.toContain("214");
    expect(filnavn(o)).toBe("BPG-oppsett 2026-27.okta");
  });

  it("tar bare med delene som er krysset av", async () => {
    await kilde();
    const o = await lagOppsett({
      skole: null,
      deler: { skolear: false, fag: true, oktlengde: false, skalaer: false },
    });
    expect(o.skolear).toBeNull();
    expect(o.fridager).toEqual([]);
    expect(o.fag).toHaveLength(2);
    expect(o.innstillinger).toEqual({});
    expect(o.skalaer).toEqual([]);
  });

  it("har aldri noe om elever i seg", async () => {
    const { ar, mfl } = await kilde();
    const elev = await opprettElev("Carmela", "Soprano");
    await settKlasse(elev, ar, await finnEllerOpprettKlasse(ar, "3STA"));
    await koblePaFag(elev, mfl);
    const okt = await opprettOkt(mfl, "MFL1", "2026-09-01", "08:30", 90);
    await settSkaring(elev, okt, GRONN);
    await settSkaringsnotat(elev, okt, "Hemmelig øktnotat");
    await opprettElevnotat(elev, ar, {
      dato: "2026-09-02",
      tekst: "Hemmelig møtelogg",
    });
    await settElevbilde(elev, "data:image/jpeg;base64,AAAA", "InSchool");

    const tekst = JSON.stringify(
      await lagOppsett({ skole: "BPG", deler: ALT }),
    );
    for (const s of [
      "Carmela",
      "Soprano",
      "3STA",
      "Hemmelig",
      "base64",
      "2026-09-01",
    ])
      expect(tekst).not.toContain(s);
  });
});

describe("eksport leser aldri elevtabellene", () => {
  it("spør bare skoleår, fridager, fag, innstillinger og skalaer", async () => {
    await kilde();
    const sporringer: string[] = [];
    const ekte = base.select.bind(base);
    base.select = (async (sql: string, args?: unknown[]) => {
      sporringer.push(sql);
      return ekte(sql, args);
    }) as typeof base.select;
    try {
      await lagOppsett({ skole: "BPG", deler: ALT });
    } finally {
      base.select = ekte;
    }
    expect(sporringer.length).toBeGreaterThan(0);
    for (const sql of sporringer)
      expect(sql).not.toMatch(
        /\b(elev|elev_klasse|elev_fag|elevbilde|elevnotat|oktnotat|skaring|vurderingsresultat|samtale|klasse|okt|gjoremal)\b/,
      );
  });
});

describe("lesing", () => {
  const gyldig = () => ({
    format: "okta-oppsett",
    versjon: 1,
    laget: "2026-10-05T18:00:00+02:00",
    laget_av: "Fredrik Bedsvaag",
    skole: "BPG",
    skolear: { navn: "2026/27", start: "2026-08-19", slutt: "2027-06-18" },
    fridager: [
      {
        navn: "Høstferie",
        type: "ferie",
        fra: "2026-10-05",
        til: "2026-10-09",
      },
    ],
    fag: [
      {
        kode: "MFL2",
        navn: "Markedsføring og ledelse 2",
        alias: null,
        grep_kode: null,
        arstimetall: 140,
        standard_varighet_min: 180,
      },
    ],
    innstillinger: { standard_varighet_min: 180 },
    skalaer: [],
  });

  it("godtar en gyldig fil", () => {
    expect(lesOppsett(JSON.stringify(gyldig())).ok).toBe(true);
  });

  it("avviser noe som ikke er en oppsettfil", () => {
    expect(lesOppsett("hei")).toEqual({
      ok: false,
      feil: [expect.stringContaining("ikke en oppsettfil")],
    });
    expect(lesOppsett("{}")).toEqual({
      ok: false,
      feil: ["Fila er ikke en oppsettfil fra Økta."],
    });
  });

  it("avviser en nyere versjon med en forståelig melding", () => {
    const r = lesOppsett(JSON.stringify({ ...gyldig(), versjon: 2 }));
    expect(r).toEqual({
      ok: false,
      feil: [expect.stringContaining("nyere versjon")],
    });
  });

  it("avviser ukjente nøkler, også nede i fagene", () => {
    expect(lesOppsett(JSON.stringify({ ...gyldig(), elever: [] })).ok).toBe(
      false,
    );
    const g = gyldig();
    (g.fag[0] as Record<string, unknown>).elever = ["Tony"];
    const r = lesOppsett(JSON.stringify(g));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.feil[0]).toContain("«elever»");
  });

  it("avviser ugyldige datoer, fridager utenfor året og like fagkoder", () => {
    const g = gyldig();
    g.skolear.start = "2026-13-40";
    g.fridager.push({
      navn: "Sommer",
      type: "ferie",
      fra: "2027-07-01",
      til: "2027-07-10",
    });
    g.fag.push({ ...g.fag[0], kode: "mfl2" });
    const r = lesOppsett(JSON.stringify(g));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.feil.join(" ")).toContain("startdato");
      expect(r.feil.join(" ")).toContain("to ganger");
    }
  });
});

describe("import", () => {
  async function fil() {
    await kilde();
    const tekst = JSON.stringify(
      await lagOppsett({ skole: "BPG", deler: ALT }),
    );
    base.nullstill();
    const r = lesOppsett(tekst);
    if (!r.ok) throw new Error(r.feil.join("\n"));
    return r.oppsett;
  }

  it("bygger skoleåret, fridagene og fagbanken i en tom base", async () => {
    const o = await fil();
    const plan = await planleggImport(o);
    expect(plantekst(plan)).toEqual([
      "Skoleåret 2026/27 opprettes.",
      "2 fridager legges inn.",
      "2 fag legges i fagbanken.",
      "Standard øktlengde settes til 90 minutter.",
      "1 skala legges til: Lav til høy.",
    ]);
    const { skolearId } = await importerOppsett(plan);
    expect((await hentSkolear()).map((s) => s.navn)).toEqual(["2026/27"]);
    expect((await hentFridager(skolearId!)).map((f) => f.navn)).toEqual([
      "Høstferie",
      "Juleferie",
    ]);
    const bank = await hentFagbank();
    expect(bank.map((f) => f.kode).sort()).toEqual(["ENG1", "SAM3045"]);
    // Fagene havner i banken, ikke i året.
    const [{ n }] = await hent<{ n: number }>(
      "SELECT COUNT(*) AS n FROM skolear_fag",
    );
    expect(n).toBe(0);
  });

  it("tar med rubrikkmalene, uten id-er, og legger dem inn hos mottakeren", async () => {
    await kilde();
    const m = await import("./muntlig");
    const r = m.tomRubrikk();
    r.kriterier[0].tekst = "Drøfter";
    r.kriterier[0].celler[r.nivaer[2].id] = "Veier sidene opp";
    await m.lagreRubrikkmal("Muntlig drøfting", r);
    const ut = await lagOppsett({ skole: null, deler: ALT });
    expect(ut.rubrikker).toEqual([
      {
        navn: "Muntlig drøfting",
        nivaer: ["Lav", "Middels", "Høy"],
        kriterier: [{ tekst: "Drøfter", celler: ["", "", "Veier sidene opp"] }],
      },
    ]);
    expect(JSON.stringify(ut.rubrikker)).not.toContain(r.nivaer[0].id);
    base.nullstill();
    const lest = lesOppsett(JSON.stringify(ut));
    if (!lest.ok) throw new Error(lest.feil.join("\n"));
    const plan = await planleggImport(lest.oppsett);
    expect(plantekst(plan)).toContain(
      "1 rubrikk legges til: Muntlig drøfting.",
    );
    await importerOppsett(plan);
    const [mal] = await m.hentRubrikkmaler();
    expect(mal.rubrikk.kriterier[0].celler[mal.rubrikk.nivaer[2].id]).toBe(
      "Veier sidene opp",
    );
    // Andre gang finnes den fra før.
    expect((await planleggImport(lest.oppsett)).rubrikkerNye).toEqual([]);
  });

  it("gjør ingenting andre gang", async () => {
    const o = await fil();
    await importerOppsett(await planleggImport(o));
    const andre = await planleggImport(o);
    expect(plantekst(andre)).toEqual([
      "Skoleåret 2026/27 finnes fra før.",
      "2 fridager finnes fra før.",
      "2 fag finnes fra før: ENG1, SAM3045.",
      "Skalaene Lav til høy finnes fra før.",
    ]);
    await importerOppsett(andre);
    expect(await hentSkolear()).toHaveLength(1);
    expect(await hentFagbank()).toHaveLength(2);
  });

  it("endrer ikke datoene på et skoleår som finnes, men sier fra", async () => {
    const o = await fil();
    const ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    await settInnstilling("standard_varighet_min", "60");
    // Har læreren begynt med økter, beholdes øktlengden.
    const f = await leggFagIAr(ar, "X1", "X", null);
    await opprettOkt(f, "X1", "2026-09-01", null, 60);
    const plan = await planleggImport(o);
    expect(plantekst(plan)[0]).toContain("andre datoer");
    expect(plan.settOktlengde).toBe(false);
    await importerOppsett(plan);
    const [lagret] = await hentSkolear();
    expect(lagret.start).toBe("2026-08-17");
  });

  it("hopper over fag med samme kode, også med andre store og små bokstaver", async () => {
    const o = await fil();
    const ar = await opprettSkolear("2025/26", "2025-08-19", "2026-06-18");
    await leggFagIAr(ar, "eng1", "Engelsk", null);
    const plan = await planleggImport(o);
    expect(plan.fagFinnes.map((f) => f.kode)).toEqual(["ENG1"]);
    expect(plan.fagNye.map((f) => f.kode)).toEqual(["SAM3045"]);
  });

  it("en mislykket import rører ikke valgt skoleår, øktlengde eller skalaer (#4)", async () => {
    const o = await fil();
    const eldre = await opprettSkolear("2025/26", "2025-08-19", "2026-06-18");
    await opprettSkolear("2026/27", "2026-08-19", "2027-06-18");
    await settInnstilling("aktivt_skolear", eldre);
    await settInnstilling("standard_varighet_min", "60");

    const plan = await planleggImport(o);
    expect(plan.skolear?.status).toBe("finnes");
    expect(plan.settOktlengde).toBe(true);
    // Andre verdi i skalaen mangler rang: importen feiler etter at den
    // første verdien og øktlengden er skrevet.
    (plan.skalaerNye[0].verdier[1] as { rang: unknown }).rang = null;

    await expect(importerOppsett(plan)).rejects.toThrow();

    expect(await hentInnstilling("aktivt_skolear")).toBe(eldre);
    expect(await hentInnstilling("standard_varighet_min")).toBe("60");
    const [{ n }] = await hent<{ n: number }>(
      `SELECT COUNT(*) AS n FROM skalaverdi v
       JOIN skala s ON s.id = v.skala_id WHERE s.navn = 'Lav til høy'`,
    );
    expect(n).toBe(0);
    expect(await hentFagbank()).toHaveLength(0);
  });
});
