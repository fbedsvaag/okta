import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { flyttDato, finnFjoraret, lagMalplan, brukMal } = await import("./mal");
const { leggFagIAr, hentFagIAr } = await import("./fag");
const { opprettOkt, hentOkter, endreOkt } = await import("./okter");
const { opprettSkolear } = await import("./skolear");
const { opprettPeriode, hentPerioder, settPeriodemal, hentPeriodemal } =
  await import("./perioder");
const {
  opprettVurdering,
  knyttOkt,
  hentVurderingsskalaer,
  hentVurderinger,
  bekreftUtkast,
} = await import("./vurderinger");
const { hentKommendeVurderinger } = await import("./dashbord");

describe("datoene i fjor og i år", () => {
  it("samme uke og ukedag regnet fra skoleårets første uke", () => {
    // 2025/26 starter man 18.8, 2026/27 man 17.8.
    expect(flyttDato("2025-08-18", "2025-08-18", "2026-08-17")).toBe(
      "2026-08-17",
    );
    expect(flyttDato("2025-09-25", "2025-08-18", "2026-08-17")).toBe(
      "2026-09-24",
    );
  });
});

describe("fjoråret som mal", () => {
  let fjor = "";
  let iar = "";
  beforeEach(async () => {
    base.nullstill();
    fjor = await opprettSkolear("2025/26", "2025-08-18", "2026-06-19");
    iar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-18");
  });

  it("legger periodene på de samme ukene, med tema og vurdering, og kan angres", async () => {
    const sfFjor = await leggFagIAr(fjor, "HIS3", "Historie", null);
    const sfIar = await leggFagIAr(iar, "HIS3", "Historie", null);
    // To mandager i fjor, med tema og periode.
    const a = await opprettOkt(sfFjor, "HIS3", "2025-08-18", null, 90);
    const b = await opprettOkt(sfFjor, "HIS3", "2025-08-25", null, 90);
    await endreOkt(a, { tema: "Oppstart" });
    await endreOkt(b, { tema: "Kilder" });
    const p = await opprettPeriode(sfFjor, "Revolusjoner", null, null, 1);
    const { fargelegg } = await import("./perioder");
    await fargelegg([a, b], p);
    await settPeriodemal(p, "KM1", true);
    const [skala] = await hentVurderingsskalaer();
    const v = await opprettVurdering(
      sfFjor,
      skala.id,
      "Prøve",
      "skriftlig",
      null,
    );
    await knyttOkt(v, b);
    // Oppgavekort og rubrikk (28.2) følger med til i år.
    const m = await import("./muntlig");
    await m.nyttOppgavekort(v, 1, {
      tittel: "Kildekritikk",
      sporsmal: ["Hvem?"],
    });
    const r = m.tomRubrikk();
    r.kriterier[0].tekst = "Bruker kilder";
    await m.settMuntlig(v, { form: "rubrikk", rubrikk: r, samtaleMin: 15 });

    // I år: tre mandager, én med tema fra før.
    const x = await opprettOkt(sfIar, "HIS3", "2026-08-17", null, 90);
    const y = await opprettOkt(sfIar, "HIS3", "2026-08-24", null, 90);
    await opprettOkt(sfIar, "HIS3", "2026-08-31", null, 90);
    await endreOkt(y, { tema: "Mitt eget" });

    const fag = (await hentFagIAr(iar)).find((f) => f.id === sfIar)!;
    const f = await finnFjoraret({ id: iar, start: "2026-08-17" }, fag.fagId);
    expect(f?.navn).toBe("2025/26");
    const okter = (await hentOkter(iar)).filter(
      (o) => o.skolearFagId === sfIar,
    );
    const plan = lagMalplan(f!, { start: "2026-08-17" }, okter);
    expect(plan.perioder[0].okter.map((o) => o.id)).toEqual([x, y]);
    expect(plan.vurderinger[0].okt.id).toBe(y);

    const angre = await brukMal(plan, f!, sfIar, okter, [], {
      perioder: true,
      mal: true,
      tema: true,
      vurderinger: true,
      plan: false,
    });
    let etter = (await hentOkter(iar)).filter((o) => o.skolearFagId === sfIar);
    const [ny] = await hentPerioder(sfIar);
    expect(ny.navn).toBe("Revolusjoner");
    expect([ny.start, ny.slutt]).toEqual(["2026-08-17", "2026-08-24"]);
    expect(etter.map((o) => o.periodeId)).toEqual([ny.id, ny.id, null]);
    // Tema fylles bare der det var tomt.
    expect(etter.map((o) => o.tema)).toEqual(["Oppstart", "Mitt eget", null]);
    expect((await hentPeriodemal(sfIar)).get(ny.id)).toEqual(["KM1"]);

    // Vurderingen kommer som utkast (§24): ikke blant fristene før den er
    // bekreftet.
    const [kopi] = await hentVurderinger(iar);
    expect(kopi.utkast).toBe(1);
    const [kort] = await m.hentOppgavekort(kopi.id);
    expect(kort).toMatchObject({ tittel: "Kildekritikk", sporsmal: ["Hvem?"] });
    const oppsett = await m.hentMuntlig(kopi.id);
    expect(oppsett.form).toBe("rubrikk");
    expect(oppsett.rubrikk.kriterier[0].tekst).toBe("Bruker kilder");
    expect(oppsett.samtaleMin).toBe(15);
    expect(await hentKommendeVurderinger(iar, 10)).toEqual([]);
    await bekreftUtkast([kopi.id]);
    expect((await hentVurderinger(iar))[0].utkast).toBe(0);
    expect(
      (await hentKommendeVurderinger(iar, 10)).map((r) => r.vurderingId),
    ).toEqual([kopi.id]);

    await angre();
    etter = (await hentOkter(iar)).filter((o) => o.skolearFagId === sfIar);
    expect(etter.map((o) => [o.periodeId, o.tema])).toEqual([
      [null, null],
      [null, "Mitt eget"],
      [null, null],
    ]);
    expect(await hentPerioder(sfIar)).toEqual([]);
  });
});
