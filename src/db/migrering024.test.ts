import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Migrasjon 024 (klassekart og kjønn) skal kjøres på ekte baser med elever.
 * Den får bare legge til: nye kolonner og nye tabeller, ingen DROP og ingen
 * endring av det som finnes. Testen bygger en base fram til 023, fyller den
 * med elever, klasser, fag og skåringer, og kjører 024 oppå.
 */
const MAPPE = join(import.meta.dirname, "..", "..", "src-tauri", "migrations");
const NAVN = "024_klassekart.sql";

function migrasjoner() {
  return readdirSync(MAPPE)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((navn) => ({ navn, sql: readFileSync(join(MAPPE, navn), "utf8") }));
}

function basenFor(navn: string): DatabaseSync {
  const d = new DatabaseSync(":memory:");
  d.exec("PRAGMA foreign_keys = ON");
  for (const m of migrasjoner()) {
    if (m.navn === navn) break;
    d.exec(m.sql);
  }
  return d;
}

const T = "2026-09-01T08:00:00";

function medElever(d: DatabaseSync) {
  d.exec(`
    INSERT INTO skolear (id, navn, start, slutt, opprettet, endret)
    VALUES ('ar', '2026/27', '2026-08-17', '2027-06-20', '${T}', '${T}');
    INSERT INTO klasse (id, navn, skolear_id, opprettet, endret)
    VALUES ('k1', '2STA', 'ar', '${T}', '${T}');
    INSERT INTO elev (id, fornavn, etternavn, opprettet, endret) VALUES
      ('e1', 'Tony', 'Soprano', '${T}', '${T}'),
      ('e2', 'Meadow', 'Soprano', '${T}', '${T}'),
      ('e3', 'Paulie', 'Gualtieri', '${T}', '${T}');
    INSERT INTO elev_klasse (id, elev_id, klasse_id, skolear_id, opprettet, endret, mentor)
    VALUES ('ek1', 'e1', 'k1', 'ar', '${T}', '${T}', 1),
           ('ek2', 'e2', 'k1', 'ar', '${T}', '${T}', 0);
  `);
}

const SQL = readFileSync(join(MAPPE, NAVN), "utf8");
const UTEN_KOMMENTARER = SQL.replace(/--.*$/gm, "");

describe("migrasjon 024 — klassekart", () => {
  it("bare legger til: ingen DROP, ingen RENAME, ingen UPDATE eller DELETE", () => {
    expect(UTEN_KOMMENTARER).not.toMatch(/\bDROP\b/i);
    expect(UTEN_KOMMENTARER).not.toMatch(/\bRENAME\b/i);
    expect(UTEN_KOMMENTARER).not.toMatch(/\bUPDATE\b/i);
    expect(UTEN_KOMMENTARER).not.toMatch(/\bDELETE\b/i);
    for (const alter of UTEN_KOMMENTARER.match(/ALTER TABLE[^;]*/gi) ?? [])
      expect(alter).toMatch(/ADD COLUMN/i);
  });

  it("kjører på en base med elever, og elevene står urørt", () => {
    const d = basenFor(NAVN);
    medElever(d);
    const for_ = d
      .prepare(
        "SELECT id, fornavn, etternavn, opprettet, endret FROM elev ORDER BY id",
      )
      .all();
    d.exec(SQL);
    const etter = d
      .prepare(
        "SELECT id, fornavn, etternavn, opprettet, endret FROM elev ORDER BY id",
      )
      .all();
    expect(etter).toEqual(for_);
    const klasser = d.prepare("SELECT * FROM elev_klasse ORDER BY id").all();
    expect(klasser).toHaveLength(2);
  });

  it("gir eksisterende elever kjønn «ikke satt»", () => {
    const d = basenFor(NAVN);
    medElever(d);
    d.exec(SQL);
    const rader = d
      .prepare("SELECT kjonn, kjonn_kilde FROM elev")
      .all() as any[];
    expect(rader).toHaveLength(3);
    for (const r of rader) {
      expect(r.kjonn).toBeNull();
      expect(r.kjonn_kilde).toBeNull();
    }
  });

  it("lager tabellene, og de tar imot rader som peker på eksisterende elever", () => {
    const d = basenFor(NAVN);
    medElever(d);
    d.exec(SQL);
    d.exec(`
      INSERT INTO rom (id, navn, oppsett, opprettet, endret)
      VALUES ('r1', 'Rom 214', '[]', '${T}', '${T}');
      INSERT INTO klassekart (id, skolear_id, kilde_type, kilde_id, rom_id, opprettet, endret)
      VALUES ('kk', 'ar', 'klasse', 'k1', 'r1', '${T}', '${T}');
      INSERT INTO plassering (id, klassekart_id, oppsett_id, type, elev_id, plass, opprettet, endret)
      VALUES ('p1', 'kk', 'o1', 'plass', 'e1', 1, '${T}', '${T}');
      INSERT INTO elevregel (id, kilde_type, kilde_id, elev_a, elev_b, opprettet, endret)
      VALUES ('g1', 'klasse', 'k1', 'e1', 'e2', '${T}', '${T}');
    `);
    expect(d.prepare("SELECT COUNT(*) AS n FROM plassering").get()).toEqual({
      n: 1,
    });
  });

  it("nekter plasseringer for elever som ikke finnes (fremmednøkler på)", () => {
    const d = basenFor(NAVN);
    medElever(d);
    d.exec(SQL);
    d.exec(`
      INSERT INTO klassekart (id, skolear_id, kilde_type, kilde_id, opprettet, endret)
      VALUES ('kk', 'ar', 'klasse', 'k1', '${T}', '${T}');
    `);
    expect(() =>
      d.exec(`
        INSERT INTO plassering (id, klassekart_id, oppsett_id, type, elev_id, opprettet, endret)
        VALUES ('p1', 'kk', 'o1', 'plass', 'finnes-ikke', '${T}', '${T}');
      `),
    ).toThrow();
  });

  it("migrasjonene etter 024 kjører også oppå en base med data", () => {
    const d = basenFor(NAVN);
    medElever(d);
    let forbi = false;
    for (const m of migrasjoner()) {
      if (m.navn === NAVN) forbi = true;
      if (forbi) d.exec(m.sql);
    }
    expect(d.prepare("SELECT COUNT(*) AS n FROM elev").get()).toEqual({ n: 3 });
  });
});
