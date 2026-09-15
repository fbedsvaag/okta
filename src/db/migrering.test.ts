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
