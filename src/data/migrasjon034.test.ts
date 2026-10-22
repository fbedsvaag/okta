import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Migrasjon 034 (muntlig vurdering) på en base som har data fra før, og
 * sikkerhetskopien etterpå: `VACUUM INTO`, som «Ta kopi nå» bruker, skal
 * ta med de nye tabellene og feltene, og kopien skal være hel.
 */
const MAPPE = join(import.meta.dirname, "..", "..", "src-tauri", "migrations");
const filer = readdirSync(MAPPE)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const les = (f: string) => readFileSync(join(MAPPE, f), "utf8");
const NAA = "2026-10-22T12:00:00";

describe("migrasjon 034", () => {
  it("legger til feltene uten å røre det som finnes, og overlever sikkerhetskopien", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    for (const f of filer.filter((f) => f < "034")) db.exec(les(f));

    // En vurdering med resultat, slik en base fra 0.5 har det.
    const skala = db
      .prepare("SELECT id FROM skala WHERE bruksomrade = 'vurdering' LIMIT 1")
      .get() as { id: string };
    db.exec(`
      INSERT INTO skolear (id, navn, start, slutt, opprettet, endret)
        VALUES ('ar', '2026/27', '2026-08-17', '2027-06-20', '${NAA}', '${NAA}');
      INSERT INTO fag (id, kode, navn, opprettet, endret)
        VALUES ('f', 'HIS3', 'Historie', '${NAA}', '${NAA}');
      INSERT INTO skolear_fag (id, skolear_id, fag_id, opprettet, endret)
        VALUES ('sf', 'ar', 'f', '${NAA}', '${NAA}');
      INSERT INTO elev (id, fornavn, etternavn, opprettet, endret)
        VALUES ('e', 'Tony', 'Soprano', '${NAA}', '${NAA}');
      INSERT INTO vurdering (id, skolear_fag_id, skala_id, tittel, type, opprettet, endret)
        VALUES ('v', 'sf', '${skala.id}', 'Muntlig', 'muntlig', '${NAA}', '${NAA}');
      INSERT INTO vurderingsresultat (id, vurdering_id, elev_id, kommentar, opprettet, endret)
        VALUES ('r', 'v', 'e', 'God', '${NAA}', '${NAA}');
    `);

    db.exec(les(filer.find((f) => f.startsWith("034"))!));

    expect(
      db.prepare("SELECT * FROM vurdering WHERE id = 'v'").get(),
    ).toMatchObject({
      tittel: "Muntlig",
      vurderingsform: null,
      rubrikk: null,
      samtale_min: null,
      trekk_flere: 1,
      trekk_na: 1,
    });
    expect(
      db.prepare("SELECT * FROM vurderingsresultat WHERE id = 'r'").get(),
    ).toMatchObject({ kommentar: "God", rubrikkvalg: null, stilte: null });

    // Nye ting i de nye tabellene, med stempler og soft delete.
    db.exec(`
      UPDATE vurdering SET vurderingsform = 'rubrikk',
        rubrikk = '{"nivaer":[],"kriterier":[]}' WHERE id = 'v';
      INSERT INTO oppgavekort (id, vurdering_id, nr, tittel, sporsmal, opprettet, endret)
        VALUES ('o', 'v', 1, 'Kildekritikk', '["Hvem?"]', '${NAA}', '${NAA}');
      INSERT INTO rubrikkmal (id, navn, innhold, opprettet, endret)
        VALUES ('m', 'Drøfting', '{}', '${NAA}', '${NAA}');
    `);
    // Fremmednøkkelen holder: et kort til en vurdering som ikke finnes.
    expect(() =>
      db.exec(
        `INSERT INTO oppgavekort (id, vurdering_id, nr, opprettet, endret)
           VALUES ('x', 'finnes-ikke', 1, '${NAA}', '${NAA}')`,
      ),
    ).toThrow();

    const mappe = mkdtempSync(join(tmpdir(), "okta-kopi-"));
    try {
      const sti = join(mappe, "elevtracking-2026-10-22.sqlite");
      db.exec(`VACUUM INTO '${sti}'`);
      const kopi = new DatabaseSync(sti);
      expect(kopi.prepare("PRAGMA integrity_check").get()).toEqual({
        integrity_check: "ok",
      });
      expect(
        kopi.prepare("SELECT tittel, sporsmal FROM oppgavekort").all(),
      ).toEqual([{ tittel: "Kildekritikk", sporsmal: '["Hvem?"]' }]);
      expect(kopi.prepare("SELECT navn FROM rubrikkmal").all()).toEqual([
        { navn: "Drøfting" },
      ]);
      expect(
        kopi
          .prepare("SELECT vurderingsform FROM vurdering WHERE id = 'v'")
          .get(),
      ).toEqual({ vurderingsform: "rubrikk" });
      kopi.close();
    } finally {
      rmSync(mappe, { recursive: true, force: true });
    }
  });
});
