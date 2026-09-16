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
    expect((d.prepare("SELECT COUNT(*) c FROM samtaledag").get() as any).c).toBe(0);
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
    const n = d.prepare("SELECT COUNT(*) c FROM samtaledag WHERE vurdering_id = 'v1'").get() as any;
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
    const n = d.prepare("SELECT COUNT(*) c FROM samtale WHERE elev_id = 'e1'").get() as any;
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
