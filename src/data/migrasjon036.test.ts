import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Migrasjon 036 (mentorsamtaler i runder) på en base med mentordager og
 * faglige dager fra før: mentordagene samles i én runde per skoleår, de
 * faglige blir stående uten.
 */
const MAPPE = join(import.meta.dirname, "..", "..", "src-tauri", "migrations");
const filer = readdirSync(MAPPE)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const les = (f: string) => readFileSync(join(MAPPE, f), "utf8");
const T = "2026-10-01T12:00:00";

describe("migrasjon 036", () => {
  it("samler mentordagene i én runde per skoleår", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    for (const f of filer.filter((f) => f < "036")) db.exec(les(f));
    db.exec(`
      INSERT INTO skolear (id, navn, start, slutt, opprettet, endret) VALUES
        ('a1', '2025/26', '2025-08-18', '2026-06-19', '${T}', '${T}'),
        ('a2', '2026/27', '2026-08-17', '2027-06-20', '${T}', '${T}');
      INSERT INTO fag (id, kode, navn, opprettet, endret)
        VALUES ('f', 'HIS3', 'Historie', '${T}', '${T}');
      INSERT INTO skolear_fag (id, skolear_id, fag_id, opprettet, endret)
        VALUES ('sf', 'a2', 'f', '${T}', '${T}');
      INSERT INTO samtaledag (id, skolear_id, skolear_fag_id, dato, fra, til, opprettet, endret) VALUES
        ('m1', 'a1', NULL, '2025-10-01', '08:30', '15:00', '${T}', '${T}'),
        ('m2', 'a2', NULL, '2026-10-27', '08:30', '15:00', '${T}', '${T}'),
        ('m3', 'a2', NULL, '2026-10-28', '08:30', '15:00', '${T}', '${T}'),
        ('f1', 'a2', 'sf', '2026-11-02', '08:30', '15:00', '${T}', '${T}');
    `);
    db.exec(les(filer.find((f) => f.startsWith("036"))!));

    const runder = db
      .prepare(
        "SELECT id, skolear_id, navn FROM samtalerunde ORDER BY skolear_id",
      )
      .all() as { id: string; skolear_id: string; navn: string }[];
    expect(runder.map((r) => [r.skolear_id, r.navn])).toEqual([
      ["a1", "Mentorsamtaler"],
      ["a2", "Mentorsamtaler"],
    ]);
    expect(runder[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const dag = (id: string) =>
      (
        db
          .prepare("SELECT samtalerunde_id AS r FROM samtaledag WHERE id = ?")
          .get(id) as { r: string | null }
      ).r;
    expect(dag("m2")).toBe(dag("m3"));
    expect(dag("m2")).toBe(runder[1].id);
    expect(dag("m1")).toBe(runder[0].id);
    expect(dag("f1")).toBeNull();
  });
});
