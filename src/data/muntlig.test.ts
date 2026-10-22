import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const m = await import("./muntlig");
const t = await import("./tidsplan");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettVurdering } = await import("./vurderinger");
const { opprettElev } = await import("./elever");

let teller = 0;
const lagId = () => `id${++teller}`;

describe("rubrikk", () => {
  const r: import("./muntlig").Rubrikk = {
    nivaer: [
      { id: "lav", navn: "Lav" },
      { id: "mid", navn: "Middels" },
      { id: "hoy", navn: "Høy" },
    ],
    kriterier: [
      { id: "a", tekst: "Begreper", celler: { lav: "Få" } },
      { id: "b", tekst: "Drøfting", celler: {} },
      { id: "c", tekst: "", celler: {} },
    ],
  };

  it("peker mot en karakter først når alle kriteriene med tekst er vurdert", () => {
    expect(m.karakterforslag(r, { a: "hoy" })).toBeNull();
    expect(m.karakterforslag(r, { a: "hoy", b: "hoy" })).toBe(6);
    expect(m.karakterforslag(r, { a: "lav", b: "lav" })).toBe(2);
    expect(m.karakterforslag(r, { a: "mid", b: "hoy" })).toBe(5);
    expect(m.antallVurdert(r, { a: "mid", b: true })).toBe(1);
  });

  it("kopieres med nye id-er, og cellene følger nivåene", () => {
    teller = 0;
    const k = m.kopierRubrikk(r, lagId);
    expect(k.nivaer.map((n) => n.navn)).toEqual(["Lav", "Middels", "Høy"]);
    expect(k.nivaer[0].id).not.toBe("lav");
    expect(k.kriterier[0].celler[k.nivaer[0].id]).toBe("Få");
  });

  it("trekker oppgaver uten å gjenta når det ikke er lov", () => {
    const titler = ["A", "B", "C"];
    expect(m.trekkOppgave(titler, ["A", "B"], false, null, () => 0)).toBe("C");
    // Alle er trukket: da gjentas de likevel.
    expect(m.trekkOppgave(titler, ["A", "B", "C"], false, null, () => 0)).toBe(
      "A",
    );
    // «Trekk ny» gir aldri den samme.
    expect(m.trekkOppgave(titler, [], true, "A", () => 0)).toBe("B");
  });
});

describe("tidsplanen", () => {
  const dag = (id: string, fra = "08:30") => ({
    id,
    dato: "2026-10-15",
    fra,
    lunsjFra: "10:00",
    lunsjMin: 30,
  });

  it("fordeler jevnt og legger lunsjen der den faller", () => {
    expect(t.fordelJevnt(7, 2)).toEqual([4, 3]);
    const ut = t.leggUtTidsplan(
      ["a", "b", "c", "d", "e", "f", "g"],
      [dag("1"), dag("2", "12:00")],
      20,
      5,
    );
    expect(ut[0].rader.map((r) => r.fra)).toEqual([
      "08:30",
      "08:55",
      "09:20",
      "09:45",
    ]);
    expect(ut[0].lunsj).toBeNull();
    expect(ut[1].rader.map((r) => r.elevId)).toEqual(["e", "f", "g"]);
    expect(t.oppsummering(ut)).toBe("7 elever · ferdig 13:10");
  });

  it("flytter og regner tidene på nytt", () => {
    const rekke = t.flytt(["a", "b", "c"], 2, 0);
    expect(rekke).toEqual(["c", "a", "b"]);
    const [d] = t.leggUtTidsplan(rekke, [dag("1")], 12, 3);
    expect(d.rader[0]).toEqual({ elevId: "c", fra: "08:30", til: "08:42" });
  });
});

describe("i basen (migrasjon 034)", () => {
  let vurdering = "";
  let elev = "";
  beforeEach(async () => {
    base.nullstill();
    const ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    const fag = await leggFagIAr(ar, "HIS3", "Historie", null);
    const [s] = await base.select<{ id: string }[]>(
      "SELECT id FROM skala WHERE bruksomrade = 'vurdering' LIMIT 1",
    );
    vurdering = await opprettVurdering(fag, s.id, "Muntlig", "muntlig", null);
    elev = await opprettElev("Tony", "Soprano");
  });

  it("lagrer oppsettet, rubrikken og standardverdiene", async () => {
    const tom = await m.hentMuntlig(vurdering);
    expect(tom).toMatchObject({
      form: "kriterier",
      samtaleMin: m.STANDARD_MIN,
      trekkFlere: true,
      trekkNa: true,
      egneTider: false,
    });
    const r = m.tomRubrikk();
    r.kriterier[0].tekst = "Begreper";
    await m.settMuntlig(vurdering, {
      form: "rubrikk",
      rubrikk: r,
      samtaleMin: 15,
      trekkNa: false,
    });
    const lest = await m.hentMuntlig(vurdering);
    expect(lest.form).toBe("rubrikk");
    expect(lest.rubrikk.kriterier[0].tekst).toBe("Begreper");
    expect(lest.samtaleMin).toBe(15);
    expect(lest.trekkNa).toBe(false);
    expect(lest.egneTider).toBe(true);
  });

  it("har oppgavekort med spørsmål, og soft delete", async () => {
    const id = await m.nyttOppgavekort(vurdering, 1, {
      tittel: "Kiwi mot Meny",
      sporsmal: ["Hvem er målgruppen?"],
    });
    await m.endreOppgavekort(id, {
      sporsmal: ["Hvem er målgruppen?", "Hvorfor?"],
    });
    expect((await m.hentOppgavekort(vurdering))[0].sporsmal).toHaveLength(2);
    await m.slettOppgavekort(id);
    expect(await m.hentOppgavekort(vurdering)).toHaveLength(0);
    const [rad] = await base.select<{ slettet: string | null }[]>(
      "SELECT slettet FROM oppgavekort WHERE id = $1",
      [id],
    );
    expect(rad.slettet).not.toBeNull();
  });

  it("lagrer rubrikker som maler, og en mal gir en kopi", async () => {
    const r = m.tomRubrikk();
    r.kriterier[0].tekst = "Drøfting";
    await m.lagreRubrikkmal("Muntlig drøfting", r);
    const [mal] = await m.hentRubrikkmaler();
    expect(mal.navn).toBe("Muntlig drøfting");
    expect(mal.rubrikk.kriterier[0].tekst).toBe("Drøfting");
    expect(mal.rubrikk.kriterier[0].id).not.toBe(r.kriterier[0].id);
  });

  it("skriver rubrikkvalg, spørsmål og notat på resultatet uten karakter", async () => {
    await m.oppdaterResultat(vurdering, elev, {
      rubrikkvalg: { a: "hoy" },
      stilte: [0, 2],
      kommentar: "God drøfting",
    });
    const r = (await m.hentMuntligResultater(vurdering)).get(elev)!;
    expect(r).toMatchObject({
      skalaverdiId: null,
      rubrikkvalg: { a: "hoy" },
      stilte: [0, 2],
      kommentar: "God drøfting",
    });
  });
});

describe("mål fra samtale til samtale (29.6)", () => {
  it("deler målene i fra forrige og til neste", async () => {
    const { delMal } = await import("./samtalerunde");
    const m = (id: string, samtaleId: string | null) => ({
      id,
      elevId: "e",
      samtaleId,
      tekst: id,
      nadd: null,
      dato: null,
    });
    const { fraForrige, tilNeste } = delMal(
      [m("gammelt", "s1"), m("nytt", "s2"), m("uten", null)],
      "s2",
    );
    expect(tilNeste.map((x) => x.id)).toEqual(["nytt"]);
    expect(fraForrige.map((x) => x.id)).toEqual(["gammelt", "uten"]);
  });
});

describe("tidsplan i økter", () => {
  const okt = (id: string, fra: string, til: string) => ({
    id,
    dato: "2026-11-05",
    fra,
    til,
    oktId: `o-${id}`,
    lunsjFra: null,
    lunsjMin: null,
  });
  const egen = (id: string) => ({
    id,
    dato: "2026-11-06",
    fra: "08:30",
    lunsjFra: null,
    lunsjMin: null,
  });

  it("en økt tar ikke flere enn det er plass til; resten går til egne dager", () => {
    // 08:30–09:30 med 12 + 3 min har plass til 4.
    expect(
      t.fordelPaTidsplan(10, [okt("a", "08:30", "09:30"), egen("b")], 12, 3),
    ).toEqual([4, 6]);
  });

  it("bare økter: fyller i rekkefølge, og sier fra om de som går over", () => {
    const dager = [okt("a", "08:30", "09:30"), okt("b", "10:00", "11:00")];
    expect(t.fordelPaTidsplan(9, dager, 12, 3)).toEqual([4, 5]);
    const ut = t.leggUtTidsplan(
      ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
      dager,
      12,
      3,
    );
    expect(ut[1].forMange).toBe(1);
    expect(ut[0].forMange).toBe(0);
  });
});
