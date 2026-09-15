import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseListe } from "./parser";
import {
  avstand,
  vurderImport,
  type EksisterendeElev,
  type Importoppsett,
} from "./duplikat";

const MFL1 = "sfag-mfl1";
const ENG1 = "sfag-eng1";

const linje = (navn: string, klasse: string | null = null) =>
  parseListe(klasse ? `${navn};${klasse}` : navn).elever[0];

const elev = (
  id: string,
  fornavn: string,
  etternavn: string,
  klasse: string | null,
  skolearFagIder: string[],
): EksisterendeElev => ({ id, fornavn, etternavn, klasse, fag: [], skolearFagIder });

const tilEng1: Importoppsett = { skolearFagId: ENG1, valgtKlasse: "1STC" };

describe("tabellen i SPEC §7.1", () => {
  const tony = elev("t", "Tony", "Soprano", "1STC", [MFL1]);

  it("samme navn, samme klasse, annet fag → samme elev, forhåndsvalgt", () => {
    const [v] = vurderImport([linje("Tony Soprano")], [tony], tilEng1);
    expect(v.status).toBe("samme");
    expect(v.valgt).toBe("t");
  });

  it("samme navn, klasse mangler på én av dem → samme elev", () => {
    const utenKlasse = elev("t", "Tony", "Soprano", null, [MFL1]);
    const [v] = vurderImport([linje("Tony Soprano")], [utenKlasse], tilEng1);
    expect(v.status).toBe("samme");
    expect(v.valgt).toBe("t");
  });

  it("samme navn, samme klasse, samme fag → allerede importert, hoppes over", () => {
    const [v] = vurderImport([linje("Tony Soprano")], [tony], {
      skolearFagId: MFL1,
      valgtKlasse: "1STC",
    });
    expect(v.status).toBe("allerede");
  });

  it("samme navn, ulik klasse → spør, og forhåndsvalget er ny elev", () => {
    const [v] = vurderImport([linje("Tony Soprano", "3STB")], [tony], tilEng1);
    expect(v.status).toBe("spor");
    expect(v.grunn).toBe("ulik-klasse");
    expect(v.valgt).toBe("ny");
    expect(v.klassekonflikt).toEqual({ finnesI: "1STC", importenSier: "3STB" });
  });

  it("nær match → spør, forhåndsvalg ny elev", () => {
    const chris = elev("c", "Christopher", "Moltisanti", "1STC", [MFL1]);
    const [v] = vurderImport([linje("Cristopher Moltisanti")], [chris], tilEng1);
    expect(v.status).toBe("spor");
    expect(v.grunn).toBe("naer-match");
    expect(v.valgt).toBe("ny");
    expect(v.kandidater.map((k) => k.id)).toEqual(["c"]);
  });

  it("flere som matcher → liste, ingenting forhåndsvalgt", () => {
    const to = [
      elev("a", "Tony", "Soprano", "1STC", [MFL1]),
      elev("b", "Tony", "Soprano", "1STC", [MFL1]),
    ];
    const [v] = vurderImport([linje("Tony Soprano")], to, tilEng1);
    expect(v.status).toBe("spor");
    expect(v.grunn).toBe("flere-treff");
    expect(v.valgt).toBe("ny");
    expect(v.kandidater).toHaveLength(2);
  });

  it("ingen match → ny elev", () => {
    const [v] = vurderImport([linje("Jason Parisi")], [tony], tilEng1);
    expect(v.status).toBe("ny");
    expect(v.kandidater).toHaveLength(0);
  });
});

describe("klassesignalet slår fagsignalet", () => {
  it("samme navn i annet fag, men ulik klasse, blir ikke slått sammen", () => {
    const phil = elev("p", "Phil", "Harris", "1STC", [MFL1]);
    const [v] = vurderImport([linje("Phil Harris", "3STB")], [phil], {
      skolearFagId: ENG1,
      valgtKlasse: "3STB",
    });
    expect(v.valgt).toBe("ny");
    expect(v.klassekonflikt?.finnesI).toBe("1STC");
  });

  it("linjas egen klasse vinner over den valgte i forhåndsvisningen", () => {
    const tony = elev("t", "Tony", "Soprano", "1STC", [MFL1]);
    const [v] = vurderImport([linje("Tony Soprano", "1STC")], [tony], {
      skolearFagId: ENG1,
      valgtKlasse: "3STB",
    });
    expect(v.status).toBe("samme");
  });
});

describe("elever som deler etternavn", () => {
  it("blandes ikke sammen, men flagges som nære", () => {
    const carmela = elev("c", "Carmela", "Soprano", "1STC", [MFL1]);
    const [v] = vurderImport([linje("Tony Soprano")], [carmela], tilEng1);
    expect(v.status).toBe("ny");
  });

  it("samme forbokstav og likt etternavn gir spørsmål, ikke sammenslåing", () => {
    const carmela = elev("c", "Carmela", "Soprano", "1STC", [MFL1]);
    const [v] = vurderImport([linje("Corrado Soprano")], [carmela], tilEng1);
    expect(v.status).toBe("spor");
    expect(v.valgt).toBe("ny");
  });
});

describe("duplikattesten fra dummydata/README.md", () => {
  const fil = readFileSync(
    new URL("../../dummydata/1STC-MFL1.md", import.meta.url),
    "utf8",
  );

  it("lim 1STC inn i MFL1, så de fem første inn i ENG1 → kobles, ikke dupliseres", () => {
    const alle = parseListe(fil).elever;

    // Første import: alle er nye.
    const første = vurderImport(alle, [], {
      skolearFagId: MFL1,
      valgtKlasse: "1STC",
    });
    expect(første.every((v) => v.status === "ny")).toBe(true);

    // De havner i basen med 1STC og MFL1.
    const iBasen = alle.map((l, i) =>
      elev(`e${i}`, l.fornavn, l.etternavn, "1STC", [MFL1]),
    );

    // Andre import: de fem første navnene inn i ENG1.
    const andre = vurderImport(alle.slice(0, 5), iBasen, tilEng1);
    expect(andre.map((v) => v.status)).toEqual(Array(5).fill("samme"));
    expect(andre.every((v) => v.valgt !== "ny")).toBe(true);
  });

  it("samme liste inn i samme fag to ganger dupliserer ingenting", () => {
    const alle = parseListe(fil).elever;
    const iBasen = alle.map((l, i) =>
      elev(`e${i}`, l.fornavn, l.etternavn, "1STC", [MFL1]),
    );

    const igjen = vurderImport(alle, iBasen, {
      skolearFagId: MFL1,
      valgtKlasse: "1STC",
    });
    expect(igjen.every((v) => v.status === "allerede")).toBe(true);
  });
});

describe("avstand", () => {
  it("teller redigeringer", () => {
    expect(avstand("tony soprano", "tony soprano")).toBe(0);
    expect(avstand("cristopher", "christopher")).toBe(1);
    expect(avstand("silvio dante", "silvio dantè")).toBe(1);
    expect(avstand("tony", "carmela")).toBeGreaterThan(2);
  });

  it("gir opp så snart taket er passert", () => {
    expect(avstand("abc", "xyzxyzxyz", 2)).toBeGreaterThan(2);
  });
});

describe("import uten fag", () => {
  const tony = elev("t", "Tony", "Soprano", "1STC", [MFL1]);
  const utenFag: Importoppsett = { skolearFagId: null, valgtKlasse: null };

  it("gjenkjenner en elev som finnes fra før, uten å lage en fagkobling", () => {
    // Mentorgruppa limes inn uten fag. Da finnes det ingen «allerede i faget»
    // å skille på — eleven finnes, og det er hele svaret.
    const [v] = vurderImport([linje("Tony Soprano", "1STC")], [tony], utenFag);
    expect(v.status).toBe("allerede");
    expect(v.valgt).toBe("t");
  });

  it("foreslår ny elev for et navn som ikke finnes", () => {
    const [v] = vurderImport([linje("Jennifer Melfi", "1STC")], [tony], utenFag);
    expect(v.status).toBe("ny");
    expect(v.valgt).toBe("ny");
  });

  it("lar klassesignalet gjelde også uten fag", () => {
    // Ulik klasse er fortsatt det sterkeste signalet om to personer (§7.1).
    const [v] = vurderImport([linje("Tony Soprano", "3STB")], [tony], utenFag);
    expect(v.status).toBe("spor");
    expect(v.valgt).toBe("ny");
  });
});
