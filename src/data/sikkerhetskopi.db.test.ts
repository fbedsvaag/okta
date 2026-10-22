import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Sikkerhetskopien med hele skjemaet (briefen for §28–29: «ta
 * sikkerhetskopi-testen på nytt»). Alle migrasjonene kjøres, hver ny tabell
 * får en rad, og kopien «Ta kopi nå» lager (VACUUM INTO) leses tilbake: hel,
 * med de samme radene.
 */
const MAPPE = join(import.meta.dirname, "..", "..", "src-tauri", "migrations");
const T = "2026-10-22T12:00:00";

describe("sikkerhetskopi med migrasjon 034–039", () => {
  it("tar med alle de nye tabellene, og kopien er hel", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    for (const f of readdirSync(MAPPE)
      .filter((f) => f.endsWith(".sql"))
      .sort())
      db.exec(readFileSync(join(MAPPE, f), "utf8"));
    const skala = (
      db
        .prepare("SELECT id FROM skala WHERE bruksomrade = 'vurdering' LIMIT 1")
        .get() as { id: string }
    ).id;
    db.exec(`
      INSERT INTO skolear (id, navn, start, slutt, opprettet, endret)
        VALUES ('ar', '2026/27', '2026-08-17', '2027-06-20', '${T}', '${T}');
      INSERT INTO fag (id, kode, navn, opprettet, endret)
        VALUES ('f', 'HIS3', 'Historie', '${T}', '${T}');
      INSERT INTO skolear_fag (id, skolear_id, fag_id, ukedager, arkivert, opprettet, endret)
        VALUES ('sf', 'ar', 'f', '1,4', NULL, '${T}', '${T}');
      INSERT INTO elev (id, fornavn, etternavn, opprettet, endret)
        VALUES ('e', 'Tony', 'Soprano', '${T}', '${T}');
      INSERT INTO vurdering (id, skolear_fag_id, skala_id, tittel, type, vekt, fraser, opprettet, endret)
        VALUES ('v', 'sf', '${skala}', 'Muntlig', 'muntlig', 2, '["Godt"]', '${T}', '${T}');
      INSERT INTO vurderingsresultat (id, vurdering_id, elev_id, leveranse, rubrikkvalg, opprettet, endret)
        VALUES ('r', 'v', 'e', 'levert', '{}', '${T}', '${T}');
      INSERT INTO oppgavekort (id, vurdering_id, nr, tittel, opprettet, endret)
        VALUES ('o', 'v', 1, 'Kildekritikk', '${T}', '${T}');
      INSERT INTO rubrikkmal (id, navn, innhold, opprettet, endret)
        VALUES ('m', 'Drøfting', '{}', '${T}', '${T}');
      INSERT INTO samtalerunde (id, skolear_id, navn, opprettet, endret)
        VALUES ('ru', 'ar', 'Mentorsamtaler høst', '${T}', '${T}');
      INSERT INTO samtalemal (id, elev_id, tekst, opprettet, endret)
        VALUES ('sm', 'e', 'Spørre om hjelp', '${T}', '${T}');
      INSERT INTO halvarskarakter (id, elev_id, skolear_fag_id, termin, karakter, opprettet, endret)
        VALUES ('h', 'e', 'sf', 'host', '5', '${T}', '${T}');
      INSERT INTO fulgt_opp (id, elev_id, nokkel, dato, opprettet, endret)
        VALUES ('fo', 'e', 'rod:o1', '2026-10-22', '${T}', '${T}');
    `);

    const mappe = mkdtempSync(join(tmpdir(), "okta-kopi-"));
    try {
      const sti = join(mappe, "elevtracking-2026-10-22.sqlite");
      db.exec(`VACUUM INTO '${sti}'`);
      const kopi = new DatabaseSync(sti);
      expect(kopi.prepare("PRAGMA integrity_check").get()).toEqual({
        integrity_check: "ok",
      });
      expect(kopi.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      for (const tabell of [
        "oppgavekort",
        "rubrikkmal",
        "samtalerunde",
        "samtalemal",
        "halvarskarakter",
        "fulgt_opp",
      ])
        expect(
          (
            kopi.prepare(`SELECT COUNT(*) AS n FROM ${tabell}`).get() as {
              n: number;
            }
          ).n,
        ).toBe(1);
      expect(
        kopi.prepare("SELECT vekt, fraser FROM vurdering WHERE id = 'v'").get(),
      ).toEqual({ vekt: 2, fraser: '["Godt"]' });
      expect(
        kopi.prepare("SELECT ukedager FROM skolear_fag WHERE id = 'sf'").get(),
      ).toEqual({ ukedager: "1,4" });
      kopi.close();
    } finally {
      rmSync(mappe, { recursive: true, force: true });
    }
  });
});
