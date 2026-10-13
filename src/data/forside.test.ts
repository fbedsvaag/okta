import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { opprettElev, koblePaFag, slettElevHelt } = await import("./elever");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettVurdering, settResultat } = await import("./vurderinger");
const { hentKommendeVurderinger } = await import("./dashbord");
const { hent } = await import("../db");

const KARAKTER = "5ca1a000-0000-4000-8000-000000000004";

let skolearId = "";
let fagId = "";
let elever: string[] = [];

beforeEach(async () => {
  base.nullstill();
  skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fagId = await leggFagIAr(skolearId, "NOR3", "Norsk", null);
  elever = [];
  for (const n of ["Tony", "Carmela", "Meadow"]) {
    const e = await opprettElev(n, "Soprano");
    await koblePaFag(e, fagId);
    elever.push(e);
  }
});

async function forAlle(vurderingId: string, ider = elevene()) {
  const [fire] = await hent<{ id: string; rang: number }>(
    "SELECT * FROM skalaverdi WHERE skala_id = $1 AND kode = '4'",
    [KARAKTER],
  );
  for (const e of ider) await settResultat(vurderingId, e, fire as never);
}
const elevene = () => elever;

describe("vurderingsfrister på forsiden (#1, #7)", () => {
  it("lar en ferdig ført vurdering falle ut, også når fristen har passert", async () => {
    const ferdig = await opprettVurdering(
      fagId,
      KARAKTER,
      "Ferdig",
      null,
      "2026-09-25",
    );
    const halv = await opprettVurdering(
      fagId,
      KARAKTER,
      "Halvveis",
      null,
      "2026-09-30",
    );
    const ny = await opprettVurdering(
      fagId,
      KARAKTER,
      "Kommer",
      null,
      "2026-11-20",
    );
    await forAlle(ferdig);
    await forAlle(halv, elever.slice(0, 2));

    const liste = await hentKommendeVurderinger(skolearId);
    expect(liste.map((v) => v.vurderingId)).toEqual([halv, ny]);
    expect(liste[0]).toMatchObject({ fort: 2, elever: 3 });
  });

  it("teller ikke slettede elever", async () => {
    const v = await opprettVurdering(
      fagId,
      KARAKTER,
      "Essay",
      null,
      "2026-11-20",
    );
    await forAlle(v, elever.slice(0, 2));
    await slettElevHelt(elever[2]);
    // To av to gjenværende er ført: ferdig, og ute av lista.
    expect(await hentKommendeVurderinger(skolearId)).toEqual([]);
  });
});
