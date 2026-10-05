import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";
import type { Elevnotat, Oktnotat } from "./elevnotat";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const {
  erForfalt,
  hentElevnotater,
  hentForfalte,
  opprettElevnotat,
  settLukket,
  hentNotatPerElev,
  sorterNotater,
  flettTidslinje,
  hentOktnotater,
} = await import("./elevnotat");
const { opprettOkt, settSkaring, settSkaringsnotat, slettOkt } =
  await import("./okter");
const { leggFagIAr } = await import("./fag");
const { opprettSamtaledag, lagreTrekning, hentSamtaler } =
  await import("./samtale");
const { opprettElev } = await import("./elever");
const { opprettSkolear } = await import("./skolear");

// ------------------------------------------------------- rene funksjoner

function notat(over: Partial<Elevnotat>): Elevnotat {
  return {
    id: Math.random().toString(36).slice(2),
    elevId: "e",
    skolearId: "a",
    skolearFagId: null,
    fagKode: null,
    dato: "2026-09-01",
    tekst: "…",
    skalFolgesOpp: false,
    frist: null,
    lukket: null,
    samtaleId: null,
    ...over,
  };
}

describe("sorterNotater", () => {
  it("løfter åpne oppfølgingspunkter øverst, uansett dato", () => {
    const gammelt = notat({ dato: "2026-08-01", skalFolgesOpp: true });
    const nytt = notat({ dato: "2026-12-01" });

    expect(sorterNotater([nytt, gammelt])[0]).toBe(gammelt);
  });

  it("lar et lukket punkt synke ned i kronologien igjen", () => {
    const lukket = notat({
      dato: "2026-08-01",
      skalFolgesOpp: true,
      lukket: "2026-09-15",
    });
    const nytt = notat({ dato: "2026-12-01" });

    expect(sorterNotater([lukket, nytt])[0]).toBe(nytt);
  });

  it("setter tidligste frist først blant de åpne", () => {
    const sent = notat({ skalFolgesOpp: true, frist: "2026-12-01" });
    const tidlig = notat({ skalFolgesOpp: true, frist: "2026-10-01" });

    expect(sorterNotater([sent, tidlig])[0]).toBe(tidlig);
  });

  it("lar punkter uten frist stå etter dem med frist, men fortsatt øverst", () => {
    // «Skal følges opp» uten frist er lov: mye oppfølging har ingen dato, den
    // er bare der til den er gjort.
    const utenFrist = notat({ skalFolgesOpp: true, frist: null });
    const medFrist = notat({ skalFolgesOpp: true, frist: "2026-10-01" });
    const vanlig = notat({ dato: "2027-01-01" });

    const sortert = sorterNotater([vanlig, utenFrist, medFrist]);
    expect(sortert.map((n) => n.id)).toEqual([
      medFrist.id,
      utenFrist.id,
      vanlig.id,
    ]);
  });

  it("sorterer vanlige notater nyeste først", () => {
    const eldst = notat({ dato: "2026-08-01" });
    const nyest = notat({ dato: "2026-12-01" });

    expect(sorterNotater([eldst, nyest])[0]).toBe(nyest);
  });
});

describe("erForfalt", () => {
  it("er forfalt når fristen er passert og punktet er åpent", () => {
    const n = notat({ skalFolgesOpp: true, frist: "2026-09-01" });
    expect(erForfalt(n, "2026-09-02")).toBe(true);
  });

  it("er ikke forfalt uten frist", () => {
    // Uten frist finnes det ingenting å sammenlikne mot (§4.7).
    const n = notat({ skalFolgesOpp: true, frist: null });
    expect(erForfalt(n, "2030-01-01")).toBe(false);
  });

  it("er ikke forfalt når punktet er lukket", () => {
    const n = notat({
      skalFolgesOpp: true,
      frist: "2026-09-01",
      lukket: "2026-09-01",
    });
    expect(erForfalt(n, "2026-12-01")).toBe(false);
  });

  it("er ikke forfalt på selve fristdagen", () => {
    const n = notat({ skalFolgesOpp: true, frist: "2026-09-01" });
    expect(erForfalt(n, "2026-09-01")).toBe(false);
  });
});

// ------------------------------------------------------------ mot basen

describe("møteloggen i basen", () => {
  let elevId = "";
  let skolearId = "";

  beforeEach(async () => {
    base.nullstill();
    skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    elevId = await opprettElev("Tony", "Soprano");
  });

  it("lagrer et notat uten fag — mentorsamtalen har ikke noe", async () => {
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-09-15",
      tekst: "Kontaktmøte. Går bedre i matte.",
    });

    const [n] = await hentElevnotater(elevId);
    expect(n.skolearFagId).toBeNull();
    expect(n.tekst).toBe("Kontaktmøte. Går bedre i matte.");
    expect(n.skalFolgesOpp).toBe(false);
  });

  it("holder flere møter fra hverandre, nyeste først", async () => {
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-09-01",
      tekst: "Første",
    });
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-11-01",
      tekst: "Andre",
    });

    const notater = await hentElevnotater(elevId);
    expect(notater.map((n) => n.tekst)).toEqual(["Andre", "Første"]);
  });

  it("lar et punkt lukkes og åpnes igjen", async () => {
    const id = await opprettElevnotat(elevId, skolearId, {
      dato: "2026-09-15",
      tekst: "Følg opp fravær",
      skalFolgesOpp: true,
    });

    await settLukket(id, true);
    expect((await hentElevnotater(elevId))[0].lukket).not.toBeNull();

    await settLukket(id, false);
    expect((await hentElevnotater(elevId))[0].lukket).toBeNull();
  });

  it("finner elever med forfalt frist, men ikke dem uten frist", async () => {
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-09-01",
      tekst: "Uten frist",
      skalFolgesOpp: true,
    });
    expect(await hentForfalte(skolearId)).toEqual(new Set());

    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-09-01",
      tekst: "Med passert frist",
      skalFolgesOpp: true,
      frist: "2020-01-01",
    });
    expect(await hentForfalte(skolearId)).toEqual(new Set([elevId]));
  });
});

describe("notat fra en samtale", () => {
  let elevId = "";
  let skolearId = "";
  let samtaleId = "";

  beforeEach(async () => {
    base.nullstill();
    skolearId = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    elevId = await opprettElev("Tony", "Soprano");

    const dagId = await opprettSamtaledag(skolearId, {
      skolearFagId: null,
      dato: "2026-11-24",
      fra: "08:30",
      til: "15:00",
      lunsjFra: null,
      lunsjMin: null,
    });
    await lagreTrekning(dagId, [
      { elevId, klokkeslett: "10:20", varighetMin: 20, tema: null },
    ]);
    samtaleId = (await hentSamtaler(dagId))[0].id;
  });

  it("havner i møteloggen på elevsiden", async () => {
    // Det er hele poenget: notatet skrives i timeplanen, men bor hos eleven.
    const id = await opprettElevnotat(elevId, skolearId, {
      dato: "2026-11-24",
      tekst: "Vil bytte fra MFL2 til EBU1.",
      samtaleId,
    });

    const [n] = await hentElevnotater(elevId);
    expect(n.id).toBe(id);
    expect(n.samtaleId).toBe(samtaleId);
    expect(n.tekst).toBe("Vil bytte fra MFL2 til EBU1.");
  });

  it("står uten fag når det kom fra en mentorsamtale", async () => {
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-11-24",
      tekst: "Kontaktmøte.",
      samtaleId,
      skolearFagId: null,
    });
    const [n] = await hentElevnotater(elevId);
    expect(n.skolearFagId).toBeNull();
  });

  it("blir stående når samtalen trekkes om", async () => {
    // Lenken er svak med vilje. Notatet er om eleven, ikke om timeplanraden.
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-11-24",
      tekst: "Noe viktig.",
      samtaleId,
    });
    await base.execute("UPDATE samtale SET slettet = $1 WHERE id = $2", [
      "2026-11-25T00:00:00",
      samtaleId,
    ]);

    const [n] = await hentElevnotater(elevId);
    expect(n.tekst).toBe("Noe viktig.");
  });

  it("slås opp på elev og dato, til timeplanen", async () => {
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-11-24",
      tekst: "Skrevet i timeplanen.",
      samtaleId,
    });

    const kart = await hentNotatPerElev([elevId], "2026-11-24");
    expect(kart.get(elevId)?.tekst).toBe("Skrevet i timeplanen.");
  });

  it("finner også notatet du skrev på elevsiden samme dag", async () => {
    // Notatet skal kunne ses begge steder, uansett hvor det ble skrevet.
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-11-24",
      tekst: "Skrevet på elevsiden.",
    });

    const kart = await hentNotatPerElev([elevId], "2026-11-24");
    expect(kart.get(elevId)?.tekst).toBe("Skrevet på elevsiden.");
  });

  it("lar notatet fra samtalen vinne når eleven har to samme dag", async () => {
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-11-24",
      tekst: "Løst notat.",
    });
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-11-24",
      tekst: "Fra samtalen.",
      samtaleId,
    });

    const kart = await hentNotatPerElev([elevId], "2026-11-24");
    expect(kart.get(elevId)?.tekst).toBe("Fra samtalen.");
  });

  it("ser bort fra notater på andre datoer", async () => {
    await opprettElevnotat(elevId, skolearId, {
      dato: "2026-10-01",
      tekst: "En annen dag.",
    });
    expect((await hentNotatPerElev([elevId], "2026-11-24")).size).toBe(0);
  });

  it("gir et tomt oppslag uten elever eller dato", async () => {
    expect((await hentNotatPerElev([], "2026-11-24")).size).toBe(0);
    expect((await hentNotatPerElev([elevId], "")).size).toBe(0);
  });
});

describe("flettTidslinje", () => {
  const notat = (id: string, dato: string, apen = false) =>
    ({
      id,
      elevId: "e",
      skolearId: "ar",
      skolearFagId: null,
      fagKode: null,
      dato,
      tekst: id,
      skalFolgesOpp: apen,
      frist: null,
      lukket: null,
      samtaleId: null,
    }) as Elevnotat;
  const okt = (id: string, dato: string) =>
    ({
      id,
      oktId: `o-${id}`,
      dato,
      fagKode: "MFL1",
      tema: null,
      tekst: id,
      farge: "gul",
      verdi: "Gul",
    }) as Oktnotat;

  it("fletter møtelogg og øktnotater etter dato, åpne punkter øverst", () => {
    const t = flettTidslinje(
      [notat("gammel", "2026-09-01"), notat("apen", "2026-08-20", true)],
      [okt("okt", "2026-09-10")],
    );
    expect(t.map((p) => p.notat.id)).toEqual(["apen", "okt", "gammel"]);
  });

  it("filtrerer på møtelogg eller øktnotater", () => {
    const n = [notat("m", "2026-09-01", true)];
    const o = [okt("o", "2026-09-02")];
    expect(flettTidslinje(n, o, "motelogg").map((p) => p.slag)).toEqual([
      "notat",
    ]);
    expect(flettTidslinje(n, o, "okt").map((p) => p.slag)).toEqual(["okt"]);
  });
});

describe("hentOktnotater", () => {
  it("gir notatene fra skåringen, men ikke tomme eller fra slettede økter", async () => {
    base.nullstill();
    const ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    const fag = await leggFagIAr(ar, "MFL1", "Markedsføring", null);
    const elev = await opprettElev("Tony", "Soprano");
    const GUL = "5ca1ade1-0001-4000-8000-000000000003";
    const a = await opprettOkt(fag, "MFL1", "2026-09-01", "08:15", 90);
    const b = await opprettOkt(fag, "MFL1", "2026-09-08", "08:15", 90);
    const c = await opprettOkt(fag, "MFL1", "2026-09-15", "08:15", 90);
    const d = await opprettOkt(fag, "MFL1", "2026-09-22", "08:15", 90);
    for (const o of [a, b, c]) await settSkaring(elev, o, GUL);
    await settSkaringsnotat(elev, a, "Sov i timen");
    await settSkaringsnotat(elev, b, "   ");
    await settSkaringsnotat(elev, c, "Borte etter pause");
    await slettOkt(c);
    // Ikke skåret: notatet skal likevel lagres og stå i tidslinja.
    await settSkaringsnotat(elev, d, "Kom for sent");

    const n = await hentOktnotater(elev);
    expect(n.map((x) => [x.oktId, x.tekst, x.farge])).toEqual([
      [d, "Kom for sent", null],
      [a, "Sov i timen", "gul"],
    ]);
  });
});

describe("øktnotatet uten skåring", () => {
  it("lagres, byttes ut og fjernes med tom tekst — og overlever at skåringen fjernes", async () => {
    base.nullstill();
    const { fjernSkaring, hentOktElever } = await import("./okter");
    const ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    const fag = await leggFagIAr(ar, "MFL1", "Markedsføring", null);
    const { koblePaFag } = await import("./elever");
    const elev = await opprettElev("Tony", "Soprano");
    await koblePaFag(elev, fag);
    const o = await opprettOkt(fag, "MFL1", "2026-09-01", "08:15", 90);

    await settSkaringsnotat(elev, o, "Første");
    await settSkaringsnotat(elev, o, "Andre");
    expect((await hentOktElever(o, fag))[0].notat).toBe("Andre");

    await settSkaring(elev, o, "5ca1ade1-0001-4000-8000-000000000004");
    await fjernSkaring(elev, o);
    expect((await hentOktElever(o, fag))[0].notat).toBe("Andre");

    await settSkaringsnotat(elev, o, "  ");
    expect((await hentOktElever(o, fag))[0].notat).toBeNull();
  });

  it("gir siste notat fra en tidligere økt i faget, ikke fra senere eller slettede", async () => {
    base.nullstill();
    const { hentOktElever } = await import("./okter");
    const { koblePaFag } = await import("./elever");
    const ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    const fag = await leggFagIAr(ar, "MFL1", "Markedsføring", null);
    const elev = await opprettElev("Tony", "Soprano");
    await koblePaFag(elev, fag);
    const a = await opprettOkt(fag, "MFL1", "2026-09-01", "08:15", 90);
    const b = await opprettOkt(fag, "MFL1", "2026-09-08", "08:15", 90);
    const c = await opprettOkt(fag, "MFL1", "2026-09-15", "08:15", 90);
    const d = await opprettOkt(fag, "MFL1", "2026-09-22", "08:15", 90);

    await settSkaringsnotat(elev, a, "Sov i timen");
    await settSkaringsnotat(elev, b, "Kom for sent");
    await slettOkt(b);
    await settSkaringsnotat(elev, d, "Senere");

    expect((await hentOktElever(c, fag))[0].forrigeNotat).toBe("Sov i timen");
    expect((await hentOktElever(a, fag))[0].forrigeNotat).toBeNull();
  });
});
