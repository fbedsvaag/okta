import { describe, expect, it } from "vitest";
import { byggArk, filnavn, isoUke, regnskapstekst, ukedag } from "./arsplanark";
import { somCsv, somMarkdown } from "./arsplaneksport";
import type { FagIAr } from "./fag";
import type { Okt, OktVurdering } from "./okter";
import type { Periode } from "./perioder";

const skolear = {
  id: "ar",
  navn: "2026/27",
  start: "2026-08-17",
  slutt: "2027-06-20",
} as Parameters<typeof byggArk>[0]["skolear"];

const fag: FagIAr = {
  id: "sf1",
  fagId: "f1",
  kode: "MFL1",
  navn: "Markedsføring og ledelse 1",
  farge: null,
  arstimetall: 140,
  grepKode: null,
  standardVarighetMin: 180,
  rom: "R204",
  laerer: null,
  kompetansemal: null,
  arknotat: null,
};

let n = 0;
function okt(over: Partial<Okt> = {}): Okt {
  n += 1;
  return {
    id: `o${n}`,
    kode: null,
    skolearFagId: "sf1",
    fagKode: "MFL1",
    fagNavn: "Markedsføring og ledelse 1",
    farge: null,
    periodeId: null,
    dato: "2026-09-01",
    klokkeslett: "09:15",
    varighetMin: 180,
    tema: "Markedsanalyse",
    sted: null,
    agenda: null,
    lekse: null,
    endret: "2026-08-07T00:00:00",
    plan: "HEMMELIG PLAN",
    logg: "HEMMELIG LOGG",
    skaret: 0,
    elever: 0,
    gronn: 0,
    gul: 0,
    rod: 0,
    ...over,
  };
}

function periode(over: Partial<Periode>): Periode {
  return {
    id: "p1",
    skolearFagId: "sf1",
    navn: "Markedsanalyse",
    rekkefolge: 1,
    start: "2026-08-17",
    slutt: "2026-10-01",
    kompetansemal: null,
    notat: null,
    ...over,
  };
}

function ark(over: Partial<Parameters<typeof byggArk>[0]> = {}) {
  return byggArk({
    skolear,
    fag,
    okter: [],
    vurderinger: new Map(),
    perioder: [],
    medPerioder: false,
    laererNavn: "Fredrik Bedsvaag",
    kompetansemal: [],
    samtaletimer: 0,
    ...over,
  });
}

describe("byggArk", () => {
  it("tar bare med øktene i faget, i datorekkefølge", () => {
    const a = ark({
      okter: [
        okt({ dato: "2026-10-01" }),
        okt({ dato: "2026-09-01", skolearFagId: "annet" }),
        okt({ dato: "2026-08-20" }),
      ],
    });
    expect(a.bolker[0].rader.map((r) => r.dato)).toEqual([
      "2026-08-20",
      "2026-10-01",
    ]);
  });

  it("bruker lærernavnet fra innstillingene når faget ikke har sin egen", () => {
    expect(ark().laerer).toBe("Fredrik Bedsvaag");
    expect(ark({ fag: { ...fag, laerer: "Kollega" } }).laerer).toBe("Kollega");
  });

  it("teller bare økter innenfor skoleåret i regnskapet, men viser alle", () => {
    const a = ark({
      okter: [okt({ dato: "2026-08-10" }), okt({ dato: "2026-09-01" })],
    });
    expect(a.regnskap.antallOkter).toBe(1);
    expect(a.regnskap.timer).toBe(3);
    expect(a.bolker[0].rader).toHaveLength(2);
    expect(a.bolker[0].rader[0].utenfor).toBe(true);
  });

  it("henter vurderingen som hører til økta", () => {
    const o = okt();
    const v = new Map<string, OktVurdering[]>([
      [
        o.id,
        [
          {
            id: "v",
            tittel: "Fagartikkel",
            frist: null,
            oktId: o.id,
            skolearFagId: "sf1",
          },
        ],
      ],
    ]);
    const a = ark({ okter: [o], vurderinger: v });
    expect(a.bolker[0].rader[0].vurderinger).toEqual(["Fagartikkel"]);
    expect(a.harVurdering).toBe(true);
  });

  it("utelater lekse- og vurderingskolonnen når de er tomme", () => {
    const a = ark({ okter: [okt({ lekse: "  " })] });
    expect(a.harLekse).toBe(false);
    expect(a.harVurdering).toBe(false);
  });

  it("grupperer på periode, med uplasserte økter sist", () => {
    const a = ark({
      medPerioder: true,
      perioder: [periode({})],
      okter: [okt({ dato: "2026-11-01" }), okt({ dato: "2026-09-01" })],
    });
    expect(a.bolker.map((b) => b.navn)).toEqual([
      "Markedsanalyse",
      "Uten periode",
    ]);
  });

  it("navngir ikke bolken når ingen økter har periode", () => {
    const a = ark({ medPerioder: true, okter: [okt()] });
    expect(a.bolker).toHaveLength(1);
    expect(a.bolker[0].navn).toBeNull();
  });

  it("lar Udir-målene gå foran fritekstfeltet", () => {
    const medFritekst = { ...fag, kompetansemal: "Egne mål" };
    expect(ark({ fag: medFritekst }).kompetansemalFritekst).toBe("Egne mål");
    const a = ark({
      fag: medFritekst,
      kompetansemal: [{ kode: "KM1", tekst: "analysere et marked" }],
    });
    expect(a.kompetansemalFritekst).toBeNull();
    expect(a.kompetansemal).toHaveLength(1);
  });
});

describe("format", () => {
  it("regner ISO-uker, også over nyttår", () => {
    expect(isoUke("2026-08-17")).toBe(34);
    expect(isoUke("2027-01-01")).toBe(53);
    expect(isoUke("2027-01-04")).toBe(1);
  });

  it("gir norsk ukedag", () => {
    expect(ukedag("2026-08-17")).toBe("man");
  });

  it("skriver regnskapet med årstimetall og samtaledager", () => {
    expect(
      regnskapstekst({
        antallOkter: 42,
        timer: 126,
        arstimetall: 140,
        samtaletimer: 6.5,
      }),
    ).toBe("42 økter · 126 av 140 timer, pluss 6,5 til muntlig vurdering");
    expect(
      regnskapstekst({
        antallOkter: 1,
        timer: 1.5,
        arstimetall: null,
        samtaletimer: 0,
      }),
    ).toBe("1 økt · 1,5 timer");
  });

  it("lager et filnavn uten skråstrek", () => {
    expect(filnavn([ark()], "md")).toBe("Årsplan MFL1 2026-27.md");
    expect(filnavn([ark(), ark()], "csv")).toBe("Årsplan 2026-27.csv");
  });
});

describe("somMarkdown", () => {
  const a = ark({
    fag: { ...fag, arknotat: "Vurderingsordning: standpunkt." },
    kompetansemal: [{ kode: "KM1", tekst: "analysere et marked" }],
    okter: [okt({ tema: "Salg | kjøp", lekse: "Les kap. 3" })],
  });
  const md = somMarkdown(a);

  it("har hode med faglærer, rom og regnskap", () => {
    expect(md).toContain("# MFL1 — Markedsføring og ledelse 1");
    expect(md).toContain(
      "Årsplan 2026/27 · Faglærer: Fredrik Bedsvaag · Rom: R204",
    );
    expect(md).toContain("1 økt · 3 av 140 timer");
    expect(md).toContain("Vurderingsordning: standpunkt.");
    expect(md).toContain("- analysere et marked");
  });

  it("escaper pipe i cellene og tar med lekse", () => {
    expect(md).toContain("| Uke | Dato | Tema | Lekse |");
    expect(md).toContain("| 36 | tir 01.09.26 | Salg \\| kjøp | Les kap. 3 |");
  });

  it("slipper aldri ut plan eller logg", () => {
    expect(md).not.toContain("HEMMELIG");
  });
});

describe("somCsv", () => {
  it("bruker semikolon, BOM og sitater der det trengs", () => {
    const csv = somCsv([ark({ okter: [okt({ tema: 'Salg; "kjøp"' })] })]);
    expect(csv.startsWith("﻿Fag;Uke;Dato;Ukedag;")).toBe(true);
    expect(csv).toContain("\r\nMFL1;36;2026-09-01;tir;");
    expect(csv).toContain('"Salg; ""kjøp"""');
    expect(csv).not.toContain("HEMMELIG");
  });
});

describe("lagDocx", () => {
  it("lager en gyldig Word-fil med innholdet og uten arbeidsnotater", async () => {
    const { Packer } = await import("docx");
    const { lagDocx } = await import("./arsplandocx");
    const a = ark({
      kompetansemal: [{ kode: "KM1", tekst: "analysere et marked" }],
      okter: [okt({ lekse: "Les kap. 3" })],
    });
    const buffer = await Packer.toBuffer(lagDocx([a]));
    // En .docx er en zip-fil; den begynner med «PK».
    expect(buffer.subarray(0, 2).toString()).toBe("PK");

    // jszip følger med docx, så testen trenger ingen egen avhengighet.
    const JSZip = (await import("jszip")).default;
    const xml = await (
      await JSZip.loadAsync(buffer)
    )
      .file("word/document.xml")!
      .async("string");
    expect(xml).toContain("MFL1 — Markedsføring og ledelse 1");
    expect(xml).toContain("analysere et marked");
    expect(xml).toContain("Les kap. 3");
    expect(xml).not.toContain("HEMMELIG");
  });
});
