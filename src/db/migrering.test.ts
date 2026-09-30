import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Migrasjon 011 flytter elev.notat inn i møteloggen (SPEC §4.7).
 *
 * Testen kjører migrasjonene i to omganger, med data skrevet imellom — slik
 * det faktisk skjer i en base som er i bruk. Kjører man alle på én gang mot
 * en tom base, har 011 ingenting å flytte, og da er den ikke testet.
 */
const MAPPE = join(import.meta.dirname, "..", "..", "src-tauri", "migrations");

function migrasjoner(): { navn: string; sql: string }[] {
  return readdirSync(MAPPE)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((navn) => ({ navn, sql: readFileSync(join(MAPPE, navn), "utf8") }));
}

/** Kjører migrasjonene til og med `stopp`, og gir basen tilbake. */
function basenFram(stopp: string): DatabaseSync {
  const d = new DatabaseSync(":memory:");
  d.exec("PRAGMA foreign_keys = ON");
  for (const m of migrasjoner()) {
    d.exec(m.sql);
    if (m.navn === stopp) break;
  }
  return d;
}

function kjor(d: DatabaseSync, navn: string) {
  d.exec(migrasjoner().find((m) => m.navn === navn)!.sql);
}

function medNotat(d: DatabaseSync, notat: string | null, endret: string) {
  d.exec(`
    INSERT INTO skolear (id, navn, start, slutt, opprettet, endret)
    VALUES ('ar', '2026/27', '2026-08-17', '2027-06-20', '${endret}', '${endret}');
    INSERT INTO innstilling (nokkel, verdi, endret)
    VALUES ('aktivt_skolear', 'ar', '${endret}');
    INSERT INTO elev (id, fornavn, etternavn, notat, opprettet, endret)
    VALUES ('e1', 'Tony', 'Soprano', ${notat === null ? "NULL" : `'${notat}'`},
            '${endret}', '${endret}');
  `);
}

describe("migrasjon 011 — elev.notat inn i møteloggen", () => {
  it("flytter notatet inn som første rad", () => {
    const d = basenFram("010_mentor.sql");
    medNotat(d, "Snakket med mor i oktober.", "2026-10-14T09:12:00");
    kjor(d, "011_motelogg.sql");

    const rader = d.prepare("SELECT * FROM elevnotat").all() as any[];
    expect(rader).toHaveLength(1);
    expect(rader[0].tekst).toBe("Snakket med mor i oktober.");
    expect(rader[0].elev_id).toBe("e1");
    expect(rader[0].skolear_id).toBe("ar");
    expect(rader[0].skal_folges_opp).toBe(0);
  });

  it("daterer notatet til da det ble skrevet, ikke til i dag", () => {
    const d = basenFram("010_mentor.sql");
    medNotat(d, "Skrevet i oktober.", "2026-10-14T09:12:00");
    kjor(d, "011_motelogg.sql");

    const [rad] = d.prepare("SELECT dato FROM elevnotat").all() as any[];
    expect(rad.dato).toBe("2026-10-14");
  });

  it("tømmer feltet den kopierte fra, så notatet ikke finnes to steder", () => {
    const d = basenFram("010_mentor.sql");
    medNotat(d, "Noe å huske.", "2026-10-14T09:12:00");
    kjor(d, "011_motelogg.sql");

    const [elev] = d.prepare("SELECT notat FROM elev").all() as any[];
    expect(elev.notat).toBeNull();
  });

  it("lager ingen rad av et tomt eller blankt felt", () => {
    const d = basenFram("010_mentor.sql");
    medNotat(d, "   ", "2026-10-14T09:12:00");
    kjor(d, "011_motelogg.sql");

    expect(d.prepare("SELECT * FROM elevnotat").all()).toHaveLength(0);
  });

  it("rører ingenting når eleven ikke har notat", () => {
    const d = basenFram("010_mentor.sql");
    medNotat(d, null, "2026-10-14T09:12:00");
    kjor(d, "011_motelogg.sql");

    expect(d.prepare("SELECT * FROM elevnotat").all()).toHaveLength(0);
  });

  it("lar notatet stå igjen når det ikke finnes noe aktivt skoleår", () => {
    // Uten et år å henge notatet på blir ingenting skrevet — og da skal
    // ingenting tømmes heller. Migreringen skriver før den sletter.
    const d = basenFram("010_mentor.sql");
    d.exec(`
      INSERT INTO elev (id, fornavn, etternavn, notat, opprettet, endret)
      VALUES ('e1', 'Tony', 'Soprano', 'Viktig notat',
              '2026-10-14T09:12:00', '2026-10-14T09:12:00');
    `);
    kjor(d, "011_motelogg.sql");

    expect(d.prepare("SELECT * FROM elevnotat").all()).toHaveLength(0);
    const [elev] = d.prepare("SELECT notat FROM elev").all() as any[];
    expect(elev.notat).toBe("Viktig notat");
  });

  it("gir hver rad en id på uuid-form", () => {
    const d = basenFram("010_mentor.sql");
    medNotat(d, "Noe.", "2026-10-14T09:12:00");
    kjor(d, "011_motelogg.sql");

    const [rad] = d.prepare("SELECT id FROM elevnotat").all() as any[];
    expect(rad.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("migrasjon 012 — samtaledager og samtaler", () => {
  /** Basen slik den ser ut etter 011, med et år, et fag, en elev og en økt. */
  function basenMedData(): DatabaseSync {
    const d = basenFram("011_motelogg.sql");
    d.exec(`
      INSERT INTO skolear (id, navn, start, slutt, opprettet, endret)
      VALUES ('ar', '2026/27', '2026-08-17', '2027-06-20', 'T', 'T');
      INSERT INTO fag (id, kode, navn, opprettet, endret)
      VALUES ('f', 'MFL1', 'Markedsføring', 'T', 'T');
      INSERT INTO skolear_fag (id, skolear_id, fag_id, opprettet, endret)
      VALUES ('sf', 'ar', 'f', 'T', 'T');
      INSERT INTO elev (id, fornavn, etternavn, opprettet, endret)
      VALUES ('e1', 'Tony', 'Soprano', 'T', 'T');
      INSERT INTO okt (id, skolear_fag_id, dato, varighet_min, opprettet, endret)
      VALUES ('o1', 'sf', '2026-09-01', 180, 'T', 'T');
      INSERT INTO vurdering (id, skolear_fag_id, skala_id, tittel, opprettet, endret)
      VALUES ('v1', 'sf', '5ca1a000-0000-4000-8000-000000000004', 'Muntlig', 'T', 'T');
    `);
    return d;
  }

  it("legges på en base som allerede er i bruk, uten å røre det som står der", () => {
    // Kjørt mot en tom base sier migrasjonen lite. Det den må tåle er en base
    // med data i, slik den faktisk møter den.
    const d = basenMedData();
    kjor(d, "012_samtale.sql");

    expect((d.prepare("SELECT COUNT(*) c FROM elev").get() as any).c).toBe(1);
    expect((d.prepare("SELECT COUNT(*) c FROM okt").get() as any).c).toBe(1);
    expect(
      (d.prepare("SELECT COUNT(*) c FROM samtaledag").get() as any).c,
    ).toBe(0);
  });

  it("lar en samtaledag stå uten fag — det er mentorsamtalen", () => {
    const d = basenMedData();
    kjor(d, "012_samtale.sql");
    d.exec(`
      INSERT INTO samtaledag (id, skolear_id, skolear_fag_id, dato, fra, til, opprettet, endret)
      VALUES ('d1', 'ar', NULL, '2026-11-24', '08:30', '15:00', 'T', 'T');
    `);
    const rad = d.prepare("SELECT skolear_fag_id FROM samtaledag").get() as any;
    expect(rad.skolear_fag_id).toBeNull();
  });

  it("lar flere dager peke på samme vurdering", () => {
    const d = basenMedData();
    kjor(d, "012_samtale.sql");
    d.exec(`
      INSERT INTO samtaledag (id, skolear_id, skolear_fag_id, vurdering_id, dato, fra, til, opprettet, endret)
      VALUES ('d1', 'ar', 'sf', 'v1', '2026-11-24', '08:30', '15:00', 'T', 'T'),
             ('d2', 'ar', 'sf', 'v1', '2026-11-25', '08:30', '15:00', 'T', 'T');
    `);
    const n = d
      .prepare("SELECT COUNT(*) c FROM samtaledag WHERE vurdering_id = 'v1'")
      .get() as any;
    expect(n.c).toBe(2);
  });

  it("slipper samme elev inn to ganger på en dag, på ulike klokkeslett", () => {
    // Eleven som ikke møtte 10:20 settes opp igjen 14:30 samme dag (§4.10).
    const d = basenMedData();
    kjor(d, "012_samtale.sql");
    d.exec(`
      INSERT INTO samtaledag (id, skolear_id, skolear_fag_id, dato, fra, til, opprettet, endret)
      VALUES ('d1', 'ar', 'sf', '2026-11-24', '08:30', '15:00', 'T', 'T');
      INSERT INTO samtale (id, samtaledag_id, elev_id, klokkeslett, varighet_min, motte, opprettet, endret)
      VALUES ('s1', 'd1', 'e1', '10:20', 20, 0, 'T', 'T'),
             ('s2', 'd1', 'e1', '14:30', 20, 1, 'T', 'T');
    `);
    const n = d
      .prepare("SELECT COUNT(*) c FROM samtale WHERE elev_id = 'e1'")
      .get() as any;
    expect(n.c).toBe(2);
  });

  it("stopper samme elev to ganger på samme klokkeslett", () => {
    const d = basenMedData();
    kjor(d, "012_samtale.sql");
    d.exec(`
      INSERT INTO samtaledag (id, skolear_id, skolear_fag_id, dato, fra, til, opprettet, endret)
      VALUES ('d1', 'ar', 'sf', '2026-11-24', '08:30', '15:00', 'T', 'T');
      INSERT INTO samtale (id, samtaledag_id, elev_id, klokkeslett, varighet_min, opprettet, endret)
      VALUES ('s1', 'd1', 'e1', '10:20', 20, 'T', 'T');
    `);
    expect(() =>
      d.exec(`
        INSERT INTO samtale (id, samtaledag_id, elev_id, klokkeslett, varighet_min, opprettet, endret)
        VALUES ('s2', 'd1', 'e1', '10:20', 20, 'T', 'T');
      `),
    ).toThrow();
  });

  it("holder fremmednøklene — en samtale kan ikke peke på en dag som ikke finnes", () => {
    const d = basenMedData();
    kjor(d, "012_samtale.sql");
    expect(() =>
      d.exec(`
        INSERT INTO samtale (id, samtaledag_id, elev_id, klokkeslett, varighet_min, opprettet, endret)
        VALUES ('s1', 'finnes-ikke', 'e1', '10:20', 20, 'T', 'T');
      `),
    ).toThrow();
  });

  it("gir motte = 1 som standard", () => {
    const d = basenMedData();
    kjor(d, "012_samtale.sql");
    d.exec(`
      INSERT INTO samtaledag (id, skolear_id, skolear_fag_id, dato, fra, til, opprettet, endret)
      VALUES ('d1', 'ar', 'sf', '2026-11-24', '08:30', '15:00', 'T', 'T');
      INSERT INTO samtale (id, samtaledag_id, elev_id, klokkeslett, varighet_min, opprettet, endret)
      VALUES ('s1', 'd1', 'e1', '10:20', 20, 'T', 'T');
    `);
    const rad = d.prepare("SELECT motte FROM samtale").get() as any;
    expect(rad.motte).toBe(1);
  });
});

describe("migrasjon 015 — vurderinger knyttes til økta på fristdagen", () => {
  const T = "2026-09-01T10:00:00";

  function medOkterOgVurdering(
    d: DatabaseSync,
    datoer: string[],
    frist: string | null,
  ) {
    d.exec(`
      INSERT INTO skolear (id, navn, start, slutt, opprettet, endret)
      VALUES ('ar', '2026/27', '2026-08-17', '2027-06-20', '${T}', '${T}');
      INSERT INTO fag (id, kode, navn, opprettet, endret)
      VALUES ('f', 'MFL1', 'Markedsføring', '${T}', '${T}');
      INSERT INTO skolear_fag (id, skolear_id, fag_id, opprettet, endret)
      VALUES ('sf', 'ar', 'f', '${T}', '${T}');
    `);
    datoer.forEach((dato, i) =>
      d.exec(`
        INSERT INTO okt (id, skolear_fag_id, dato, varighet_min, opprettet, endret)
        VALUES ('o${i}', 'sf', '${dato}', 180, '${T}', '${T}');
      `),
    );
    const skala = (
      d.prepare("SELECT id FROM skala LIMIT 1").get() as { id: string }
    ).id;
    d.exec(`
      INSERT INTO vurdering (id, skolear_fag_id, skala_id, tittel, frist, opprettet, endret)
      VALUES ('v', 'sf', '${skala}', 'Prøve', ${frist ? `'${frist}'` : "NULL"}, '${T}', '${T}');
    `);
  }

  const kobling = (d: DatabaseSync) =>
    d.prepare("SELECT okt_id, endret FROM vurdering WHERE id = 'v'").get() as {
      okt_id: string | null;
      endret: string;
    };

  it("knytter vurderingen til den ene økta på fristdagen", () => {
    const d = basenFram("014_arsplanark.sql");
    medOkterOgVurdering(d, ["2026-10-06", "2026-10-13"], "2026-10-13");
    kjor(d, "015_vurdering_okt.sql");
    expect(kobling(d).okt_id).toBe("o1");
    // endret stemples, så en senere synk ser at raden er rørt (§9).
    expect(kobling(d).endret).not.toBe(T);
  });

  it("lar den stå når det er to økter samme dag", () => {
    const d = basenFram("014_arsplanark.sql");
    medOkterOgVurdering(d, ["2026-10-06", "2026-10-06"], "2026-10-06");
    kjor(d, "015_vurdering_okt.sql");
    expect(kobling(d).okt_id).toBeNull();
    expect(kobling(d).endret).toBe(T);
  });

  it("rører ikke en vurdering uten frist", () => {
    const d = basenFram("014_arsplanark.sql");
    medOkterOgVurdering(d, ["2026-10-06"], null);
    kjor(d, "015_vurdering_okt.sql");
    expect(kobling(d).okt_id).toBeNull();
  });
});

describe("migrasjon 016 — én vurdering over flere økter", () => {
  const T = "2026-09-01T10:00:00";

  it("flytter koblingen fra vurdering.okt_id over i koblingstabellen", () => {
    const d = basenFram("015_vurdering_okt.sql");
    const skala = (
      d.prepare("SELECT id FROM skala LIMIT 1").get() as { id: string }
    ).id;
    d.exec(`
      INSERT INTO skolear (id, navn, start, slutt, opprettet, endret)
      VALUES ('ar', '2026/27', '2026-08-17', '2027-06-20', '${T}', '${T}');
      INSERT INTO fag (id, kode, navn, opprettet, endret)
      VALUES ('f', 'MFL1', 'Markedsføring', '${T}', '${T}');
      INSERT INTO skolear_fag (id, skolear_id, fag_id, opprettet, endret)
      VALUES ('sf', 'ar', 'f', '${T}', '${T}');
      INSERT INTO okt (id, skolear_fag_id, dato, varighet_min, opprettet, endret)
      VALUES ('o', 'sf', '2026-10-06', 180, '${T}', '${T}');
      INSERT INTO vurdering (id, skolear_fag_id, skala_id, tittel, okt_id, opprettet, endret)
      VALUES ('med', 'sf', '${skala}', 'Prøve', 'o', '${T}', '${T}'),
             ('uten', 'sf', '${skala}', 'Essay', NULL, '${T}', '${T}');
    `);
    kjor(d, "016_vurdering_flere_okter.sql");

    const rader = d.prepare("SELECT * FROM vurdering_okt").all() as {
      id: string;
      vurdering_id: string;
      okt_id: string;
    }[];
    expect(rader).toHaveLength(1);
    expect(rader[0]).toMatchObject({ vurdering_id: "med", okt_id: "o" });
    expect(rader[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("migrasjon 017 — perioden står på økta", () => {
  const T = "2026-09-01T10:00:00";

  it("skriver ned perioden datoene ga, og lar resten stå", () => {
    const d = basenFram("016_vurdering_flere_okter.sql");
    d.exec(`
      INSERT INTO skolear (id, navn, start, slutt, opprettet, endret)
      VALUES ('ar', '2026/27', '2026-08-17', '2027-06-20', '${T}', '${T}');
      INSERT INTO fag (id, kode, navn, opprettet, endret)
      VALUES ('f', 'MFL1', 'Markedsføring', '${T}', '${T}');
      INSERT INTO skolear_fag (id, skolear_id, fag_id, opprettet, endret)
      VALUES ('sf', 'ar', 'f', '${T}', '${T}');
      INSERT INTO periode (id, skolear_fag_id, navn, rekkefolge, start, slutt, opprettet, endret)
      VALUES ('host', 'sf', 'Høst', 1, '2026-08-17', '2026-10-31', '${T}', '${T}'),
             ('okt', 'sf', 'Oktober', 2, '2026-10-01', '2026-10-31', '${T}', '${T}');
      INSERT INTO okt (id, skolear_fag_id, periode_id, dato, varighet_min, opprettet, endret)
      VALUES ('i-host', 'sf', NULL, '2026-09-01', 180, '${T}', '${T}'),
             ('overlapp', 'sf', NULL, '2026-10-06', 180, '${T}', '${T}'),
             ('satt', 'sf', 'okt', '2026-09-08', 180, '${T}', '${T}'),
             ('utenfor', 'sf', NULL, '2027-03-01', 180, '${T}', '${T}');
    `);
    kjor(d, "017_periode_malt.sql");

    const periode = (id: string) =>
      (
        d.prepare("SELECT periode_id FROM okt WHERE id = ?").get(id) as {
          periode_id: string | null;
        }
      ).periode_id;
    expect(periode("i-host")).toBe("host");
    expect(periode("overlapp")).toBe("host"); // den som begynner først
    expect(periode("satt")).toBe("okt"); // uttrykkelig valg røres ikke
    expect(periode("utenfor")).toBeNull();
  });
});

describe("migrasjon 019 — rydd etter slettede elever", () => {
  const T = "2026-09-01T10:00:00";

  it("sletter det som henger igjen etter en slettet elev, og lar de andre være", () => {
    const d = basenFram("018_fag_alias.sql");
    const verdi = (
      d.prepare("SELECT id FROM skalaverdi LIMIT 1").get() as { id: string }
    ).id;
    d.exec(`
      INSERT INTO skolear (id, navn, start, slutt, opprettet, endret)
      VALUES ('ar', '2026/27', '2026-08-17', '2027-06-20', '${T}', '${T}');
      INSERT INTO fag (id, kode, navn, opprettet, endret) VALUES ('f', 'MFL1', 'M', '${T}', '${T}');
      INSERT INTO skolear_fag (id, skolear_id, fag_id, opprettet, endret) VALUES ('sf', 'ar', 'f', '${T}', '${T}');
      INSERT INTO okt (id, skolear_fag_id, dato, varighet_min, opprettet, endret)
      VALUES ('o', 'sf', '2026-10-06', 180, '${T}', '${T}');
      INSERT INTO elev (id, fornavn, etternavn, opprettet, endret, slettet)
      VALUES ('borte', 'Tony', 'S', '${T}', '${T}', '${T}'),
             ('her', 'Carmela', 'S', '${T}', '${T}', NULL);
      INSERT INTO skaring (id, elev_id, okt_id, skalaverdi_id, opprettet, endret)
      VALUES ('s1', 'borte', 'o', '${verdi}', '${T}', '${T}'),
             ('s2', 'her', 'o', '${verdi}', '${T}', '${T}');
      INSERT INTO elev_fag (id, elev_id, skolear_fag_id, opprettet, endret)
      VALUES ('ef1', 'borte', 'sf', '${T}', '${T}'), ('ef2', 'her', 'sf', '${T}', '${T}');
    `);
    kjor(d, "019_rydd_slettede_elever.sql");
    const levende = (tabell: string) =>
      (
        d
          .prepare(`SELECT id FROM ${tabell} WHERE slettet IS NULL ORDER BY id`)
          .all() as { id: string }[]
      ).map((r) => r.id);
    expect(levende("skaring")).toEqual(["s2"]);
    expect(levende("elev_fag")).toEqual(["ef2"]);
  });
});
