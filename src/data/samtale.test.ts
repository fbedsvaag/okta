import { describe, expect, it } from "vitest";
import {
  dagenssetning,
  delPaDager,
  finnLunsj,
  flyttInnenDagen,
  flyttMellomDager,
  delIGrupper,
  antallEnheter,
  enhetId,
  medlemmerAv,
  flyttTilEnhet,
  fordelPaDager,
  grupperTrekninger,
  medLunsj,
  somMarkdown,
  somTeamsHtml,
  kapasitet,
  leggUtDagen,
  merknad,
  plassering,
  stokk,
  tildelTema,
  tilKlokke,
  tilMin,
  trekkOmRekkefolge,
  trekkOmTema,
  timerPaDagen,
  trekkRekkefolge,
  vektetRekkefolge,
  tiderITrekning,
  utenDobbelteElever,
  type Dagoppsett,
  type Eksportdag,
  type Plassering,
  type Samtaledag,
} from "./samtale";

/** Tilfeldighet som ikke er tilfeldig, så trekningen kan prøves. */
function fast(tall: number[]): () => number {
  let i = 0;
  return () => tall[i++ % tall.length];
}

const heldag: Dagoppsett = {
  fra: "08:30",
  til: "15:00",
  lunsjFra: null,
  lunsjMin: null,
};

const lunsjdag: Dagoppsett = {
  fra: "08:30",
  til: "15:00",
  lunsjFra: "11:45",
  lunsjMin: 30,
};

describe("tid", () => {
  it("regner begge veier", () => {
    expect(tilMin("08:30")).toBe(510);
    expect(tilKlokke(510)).toBe("08:30");
    expect(tilKlokke(tilMin("14:05"))).toBe("14:05");
  });
});

describe("kapasitet", () => {
  it("regner en dag uten lunsj", () => {
    // 08:30–15:00 er 390 min. 20 + 5 per elev, uten pause etter den siste:
    // 15 samtaler tar 15*20 + 14*5 = 370. En til ville krevd 395.
    expect(kapasitet(heldag, 20, 5)).toBe(15);
  });

  it("gir plass til færre når lunsjen ligger midt i", () => {
    expect(kapasitet(lunsjdag, 20, 5)).toBeLessThan(kapasitet(heldag, 20, 5));
  });

  it("trekker ikke fra lunsj på en dag som aldri når den", () => {
    // Dagen er over før 11:45, så lunsjen skal ikke spise av kapasiteten.
    // HTML-verktøyet trakk den fra uansett og regnet for lavt.
    const kort: Dagoppsett = { ...lunsjdag, til: "10:30" };
    const utenLunsj: Dagoppsett = { ...kort, lunsjFra: null, lunsjMin: null };
    expect(kapasitet(kort, 20, 5)).toBe(kapasitet(utenLunsj, 20, 5));
  });

  it("gir null når dagen er for kort til én samtale", () => {
    expect(kapasitet({ ...heldag, til: "08:40" }, 20, 5)).toBe(0);
  });

  it("gir null på et ugyldig spenn", () => {
    expect(kapasitet({ ...heldag, til: "07:00" }, 20, 5)).toBe(0);
  });
});

describe("leggUtDagen", () => {
  it("legger samtalene etter hverandre med pause imellom", () => {
    const slots = leggUtDagen(heldag, 3, 20, 5);
    expect(slots.map((s) => [tilKlokke(s.fra), tilKlokke(s.til)])).toEqual([
      ["08:30", "08:50"],
      ["08:55", "09:15"],
      ["09:20", "09:40"],
    ]);
  });

  it("legger lunsjen ved første samtalegrense etter tidspunktet", () => {
    // En samtale deles aldri i to, så pausen kan begynne senere enn satt.
    const slots = leggUtDagen(lunsjdag, 20, 20, 5);
    const lunsj = slots.find((s) => s.type === "lunsj")!;
    expect(lunsj).toBeDefined();
    expect(tilMin(tilKlokke(lunsj.fra))).toBeGreaterThanOrEqual(
      tilMin("11:45"),
    );
  });

  it("gir ingen elev et tidspunkt inne i lunsjen", () => {
    const slots = leggUtDagen(lunsjdag, 20, 20, 5);
    const lunsj = slots.find((s) => s.type === "lunsj")!;
    const kolliderer = slots.filter(
      (s) => s.type === "samtale" && s.fra < lunsj.til && s.til > lunsj.fra,
    );
    expect(kolliderer).toEqual([]);
  });

  it("fortsetter samtalene etter lunsjen", () => {
    const slots = leggUtDagen(lunsjdag, 20, 20, 5);
    const lunsj = slots.findIndex((s) => s.type === "lunsj");
    expect(slots.slice(lunsj + 1).some((s) => s.type === "samtale")).toBe(true);
  });

  it("legger ingen lunsj når dagen tar slutt før den", () => {
    // «En pause etter siste samtale er ikke en pause» (§4.10).
    const slots = leggUtDagen({ ...lunsjdag, til: "10:30" }, 20, 20, 5);
    expect(slots.some((s) => s.type === "lunsj")).toBe(false);
  });

  it("legger ingen lunsj når det ikke er plass til en samtale etter den", () => {
    const slots = leggUtDagen({ ...lunsjdag, til: "12:05" }, 20, 20, 5);
    expect(slots.some((s) => s.type === "lunsj")).toBe(false);
  });

  it("stopper når dagen er full, uansett hvor mange som ble bedt om", () => {
    const slots = leggUtDagen(heldag, 99, 20, 5);
    expect(slots.filter((s) => s.type === "samtale")).toHaveLength(15);
  });

  it("tåler null elever og ugyldig samtaletid", () => {
    expect(leggUtDagen(heldag, 0, 20, 5)).toEqual([]);
    expect(leggUtDagen(heldag, 5, 0, 5)).toEqual([]);
  });
});

describe("timerPaDagen", () => {
  it("regner spennet minus lunsjen", () => {
    // Eksempelet fra §4.2: 08:30–15:30 med 30 minutters lunsj = 6,5 timer.
    expect(
      timerPaDagen({
        fra: "08:30",
        til: "15:30",
        lunsjFra: "11:45",
        lunsjMin: 30,
      }),
    ).toBe(6.5);
  });

  it("trekker ikke fra en lunsj som ligger utenfor dagen", () => {
    expect(
      timerPaDagen({
        fra: "08:30",
        til: "10:30",
        lunsjFra: "11:45",
        lunsjMin: 30,
      }),
    ).toBe(2);
  });

  it("gir null på et spenn som ikke går opp", () => {
    expect(
      timerPaDagen({
        fra: "15:00",
        til: "08:00",
        lunsjFra: null,
        lunsjMin: null,
      }),
    ).toBe(0);
  });
});

describe("fordelPaDager", () => {
  it("fyller dagene i rekkefølge", () => {
    expect(fordelPaDager(24, [15, 15])).toEqual([15, 9]);
  });

  it("lar de siste dagene stå tomme når alle får plass tidlig", () => {
    expect(fordelPaDager(5, [15, 15])).toEqual([5, 0]);
  });

  it("plasserer ikke flere enn det er plass til", () => {
    expect(fordelPaDager(40, [15, 15])).toEqual([15, 15]);
  });
});

describe("trekningen", () => {
  const elever = ["a", "b", "c", "d", "e"];

  it("tar med alle elevene, og ingen to ganger", () => {
    const dager = trekkRekkefolge(
      elever,
      [3, 3],
      fast([0.1, 0.7, 0.3, 0.9, 0.5]),
    );
    const alle = dager.flat();
    expect(alle).toHaveLength(elever.length);
    expect(new Set(alle).size).toBe(elever.length);
  });

  it("respekterer kapasiteten per dag", () => {
    const dager = trekkRekkefolge(elever, [2, 2, 2], fast([0.4]));
    expect(dager.map((d) => d.length)).toEqual([2, 2, 1]);
  });

  it("lar elever bli uplassert når kapasiteten ikke rekker", () => {
    const dager = trekkRekkefolge(elever, [2], fast([0.4]));
    expect(dager.flat()).toHaveLength(2);
  });

  it("gir samme resultat for samme tilfeldighet", () => {
    const en = trekkRekkefolge(elever, [3, 3], fast([0.2, 0.8, 0.5]));
    const to = trekkRekkefolge(elever, [3, 3], fast([0.2, 0.8, 0.5]));
    expect(en).toEqual(to);
  });
});

describe("tildelTema", () => {
  it("fordeler temaene jevnt", () => {
    const kart = tildelTema(["a", "b", "c", "d"], ["T1", "T2"], fast([0.1]));
    const antall = new Map<string, number>();
    for (const t of kart.values()) antall.set(t, (antall.get(t) ?? 0) + 1);
    expect([...antall.values()].sort()).toEqual([2, 2]);
  });

  it("gir hver elev et tema", () => {
    const kart = tildelTema(["a", "b", "c"], ["T1", "T2", "T3"], fast([0.5]));
    expect(kart.size).toBe(3);
  });

  it("tåler at det ikke finnes temaer — mentorsamtalen har ingen", () => {
    expect(tildelTema(["a", "b"], [], fast([0.5])).size).toBe(0);
  });

  it("har ingen øvre grense på antall temaer", () => {
    const mange = Array.from({ length: 20 }, (_, i) => `T${i + 1}`);
    const kart = tildelTema(["a", "b"], mange, fast([0.3]));
    expect(kart.size).toBe(2);
  });
});

describe("plassering", () => {
  it("deler dagen i tredjedeler", () => {
    const seks = [0, 1, 2, 3, 4, 5].map((i) => plassering(i, 6));
    expect(seks).toEqual(["tidlig", "tidlig", "midt", "midt", "sent", "sent"]);
  });

  it("virker på en dag med tolv", () => {
    expect(plassering(0, 12)).toBe("tidlig");
    expect(plassering(5, 12)).toBe("midt");
    expect(plassering(11, 12)).toBe("sent");
  });

  it("markerer ikke dager med under tre elever", () => {
    expect(plassering(0, 2)).toBeNull();
    expect(plassering(0, 1)).toBeNull();
  });

  it("gir null utenfor rekka", () => {
    expect(plassering(5, 3)).toBeNull();
    expect(plassering(-1, 5)).toBeNull();
  });
});

describe("merknad", () => {
  it("sier fra om én gang", () => {
    expect(merknad(["tidlig"])).toBe("tidlig sist");
  });

  it("teller gjentakelser på rad", () => {
    expect(merknad(["sent", "sent"])).toBe("sent 2× på rad");
    expect(merknad(["tidlig", "tidlig", "tidlig"])).toBe("tidlig 3× på rad");
  });

  it("teller bare de sammenhengende fra nyeste", () => {
    expect(merknad(["tidlig", "sent", "tidlig"])).toBe("tidlig sist");
  });

  it("er stille når siste gang var midt på dagen", () => {
    expect(merknad(["midt", "tidlig", "tidlig"])).toBeNull();
  });

  it("er stille uten historikk", () => {
    expect(merknad([])).toBeNull();
  });
});

describe("vektetRekkefolge", () => {
  it("tar med alle, og ingen to ganger", () => {
    const h = new Map<string, Plassering[]>();
    const ut = vektetRekkefolge(["a", "b", "c"], h, fast([0.1, 0.5, 0.9]));
    expect(new Set(ut)).toEqual(new Set(["a", "b", "c"]));
  });

  it("skyver den som hadde tidlig sist bakover", () => {
    // Med lik tilfeldighet er det historikken som skiller.
    const h = new Map<string, Plassering[]>([
      ["tidligsist", ["tidlig", "tidlig", "tidlig"]],
      ["sentsist", ["sent", "sent", "sent"]],
    ]);
    const ut = vektetRekkefolge(["tidligsist", "sentsist"], h, fast([0.5]));
    expect(ut).toEqual(["sentsist", "tidligsist"]);
  });

  it("den som var tidlig sist, havner aldri tidlig igjen", () => {
    // 12 elever, fire av dem tidlig sist. De står bak alle de andre,
    // uansett tilfeldighet; innenfor hver gruppe er rekkefølgen tilfeldig.
    const tidlig = ["t1", "t2", "t3", "t4"];
    const andre = ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"];
    const h = new Map<string, Plassering[]>(
      tidlig.map((id) => [id, ["tidlig"]] as [string, Plassering[]]),
    );
    const forste = new Set<string>();
    for (let n = 0; n < 500; n++) {
      const ut = vektetRekkefolge([...tidlig, ...andre], h);
      expect(ut.slice(0, 8).some((id) => tidlig.includes(id))).toBe(false);
      forste.add(ut[0]);
    }
    expect(forste.size).toBeGreaterThan(1);
  });

  it("den som var sent sist, havner aldri sent igjen", () => {
    const sent = ["s1", "s2", "s3", "s4"];
    const andre = ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"];
    const h = new Map<string, Plassering[]>(
      sent.map((id) => [id, ["sent"]] as [string, Plassering[]]),
    );
    for (let n = 0; n < 500; n++) {
      const ut = vektetRekkefolge([...andre, ...sent], h);
      expect(ut.slice(4).some((id) => sent.includes(id))).toBe(false);
    }
  });

  it("veier en gruppe som snittet av medlemmene", () => {
    const h = new Map<string, Plassering[]>([
      ["a", ["tidlig"]],
      ["b", ["tidlig"]],
    ]);
    const ut = vektetRekkefolge(["g:a+b", "c"], h, fast([0.0, 0.99]));
    expect(ut).toEqual(["c", "g:a+b"]);
  });
});

describe("trekkOmRekkefolge med vekting", () => {
  it("vekter innenfor dagen og lar låste stå", () => {
    const h = new Map<string, Plassering[]>([
      ["a", ["tidlig"]],
      ["d", ["sent"]],
    ]);
    for (let n = 0; n < 200; n++) {
      const [dag] = trekkOmRekkefolge(
        [["a", "b", "c", "d"]],
        new Set(["c"]),
        Math.random,
        h,
      );
      expect(dag[2]).toBe("c"); // låst
      expect(dag.indexOf("a")).toBeGreaterThan(dag.indexOf("d"));
      expect(dag.indexOf("a")).toBeGreaterThan(dag.indexOf("b"));
    }
  });
});

describe("stokk", () => {
  it("beholder alle elementene", () => {
    const ut = stokk([1, 2, 3, 4, 5], fast([0.3, 0.7, 0.1, 0.9]));
    expect(ut.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("rører ikke lista den fikk", () => {
    const inn = [1, 2, 3];
    stokk(inn, fast([0.5]));
    expect(inn).toEqual([1, 2, 3]);
  });
});

describe("delPaDager", () => {
  it("beholder rekkefølgen den fikk", () => {
    // Vektet rekkefølge skal ikke stokkes om igjen av delingen.
    expect(delPaDager(["a", "b", "c", "d"], [2, 2])).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("lar de som ikke får plass bli utenfor", () => {
    expect(delPaDager(["a", "b", "c"], [2])).toEqual([["a", "b"]]);
  });

  it("gir tomme dager når elevene tar slutt", () => {
    expect(delPaDager(["a"], [2, 2])).toEqual([["a"], []]);
  });
});

describe("trekk på nytt", () => {
  it("lar en låst elev bli i sin plass", () => {
    const perDag = [["a", "b", "c", "d"]];
    const ut = trekkOmRekkefolge(perDag, new Set(["b"]), fast([0.1, 0.8, 0.4]));
    expect(ut[0][1]).toBe("b");
  });

  it("stokker de andre rundt den låste", () => {
    const perDag = [["a", "b", "c", "d"]];
    const ut = trekkOmRekkefolge(perDag, new Set(["b"]), fast([0.9, 0.1, 0.5]));
    expect(new Set(ut[0])).toEqual(new Set(["a", "b", "c", "d"]));
    expect(ut[0]).toHaveLength(4);
  });

  it("flytter ingen mellom dager", () => {
    // Dagene har hver sin kapasitet — en omtrekning skal ikke stille
    // spørsmål om hvem som må ut.
    const perDag = [
      ["a", "b"],
      ["c", "d"],
    ];
    const ut = trekkOmRekkefolge(perDag, new Set(), fast([0.7, 0.2]));
    expect(new Set(ut[0])).toEqual(new Set(["a", "b"]));
    expect(new Set(ut[1])).toEqual(new Set(["c", "d"]));
  });

  it("lar alt stå når alle er låst", () => {
    const perDag = [["a", "b", "c"]];
    const ut = trekkOmRekkefolge(perDag, new Set(["a", "b", "c"]), fast([0.5]));
    expect(ut).toEqual(perDag);
  });

  it("holder låste elever på temaet sitt", () => {
    const na = new Map([
      ["a", "T1"],
      ["b", "T2"],
    ]);
    const ut = trekkOmTema(
      ["a", "b"],
      na,
      new Set(["a"]),
      ["T1", "T2"],
      fast([0.9]),
    );
    expect(ut.get("a")).toBe("T1");
  });

  it("gir alle et tema, også etter omtrekning", () => {
    const na = new Map([["a", "T1"]]);
    const ut = trekkOmTema(
      ["a", "b", "c"],
      na,
      new Set(["a"]),
      ["T1", "T2"],
      fast([0.3]),
    );
    expect(ut.size).toBe(3);
  });

  it("gir ingen temaer i mentormodus", () => {
    const ut = trekkOmTema(["a"], new Map(), new Set(), [], fast([0.5]));
    expect(ut.size).toBe(0);
  });
});

describe("flyttInnenDagen", () => {
  it("skyver de mellomliggende én vei, ikke bytter parvis", () => {
    // Drar man den første til tredjeplass, skal de to andre rykke opp —
    // ikke at to elever bytter plass med hverandre.
    expect(flyttInnenDagen(["a", "b", "c", "d"], 0, 2)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
  });

  it("virker bakover også", () => {
    expect(flyttInnenDagen(["a", "b", "c", "d"], 3, 1)).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });

  it("lar lista stå når den slippes der den var", () => {
    const inn = ["a", "b", "c"];
    expect(flyttInnenDagen(inn, 1, 1)).toEqual(inn);
  });

  it("tåler plasser utenfor lista", () => {
    const inn = ["a", "b"];
    expect(flyttInnenDagen(inn, 0, 9)).toEqual(inn);
    expect(flyttInnenDagen(inn, -1, 1)).toEqual(inn);
  });

  it("mister ingen", () => {
    const ut = flyttInnenDagen(["a", "b", "c", "d", "e"], 4, 0);
    expect(new Set(ut)).toEqual(new Set(["a", "b", "c", "d", "e"]));
  });
});

describe("finnLunsj", () => {
  const dag: Dagoppsett = {
    fra: "08:30",
    til: "15:00",
    lunsjFra: "11:45",
    lunsjMin: 30,
  };

  it("finner pausen i hullet mellom to samtaler", () => {
    const rader = [
      { fra: "11:25", til: "11:45" },
      { fra: "12:15", til: "12:35" },
    ];
    expect(finnLunsj(rader, dag)).toEqual({ fra: "11:45", til: "12:15" });
  });

  it("gir null når dagen ikke har lunsj", () => {
    const rader = [{ fra: "09:00", til: "09:20" }];
    expect(
      finnLunsj(rader, { ...dag, lunsjFra: null, lunsjMin: null }),
    ).toBeNull();
  });

  it("gir null når det ikke finnes noe hull", () => {
    const rader = [
      { fra: "09:00", til: "09:20" },
      { fra: "09:25", til: "09:45" },
    ];
    expect(finnLunsj(rader, dag)).toBeNull();
  });
});

describe("eksport", () => {
  const dag: Eksportdag = {
    dato: "2026-11-24",
    lunsj: { fra: "11:45", til: "12:15" },
    rader: [
      {
        navn: "Tony Soprano",
        tema: "Oppgave 4",
        fra: "11:25",
        til: "11:45",
        motte: true,
      },
      {
        navn: "Carmela Soprano",
        tema: "Oppgave 1",
        fra: "12:15",
        til: "12:35",
        motte: true,
      },
    ],
  };

  it("setter lunsjen inn på sin plass", () => {
    const rader = medLunsj(dag);
    expect(rader.map((r) => r.type)).toEqual(["samtale", "lunsj", "samtale"]);
  });

  it("skriver markdown med oppgavekolonne i fagsamtale", () => {
    const md = somMarkdown([dag], true);
    expect(md).toContain("| # | Navn | Oppgave | Tid |");
    expect(md).toContain("Oppgave 4");
    expect(md).toContain("*Lunsj*");
  });

  it("utelater oppgavekolonnen i mentorsamtale", () => {
    // HTML-verktøyet skrev den ut uansett modus. Det var en inkonsekvens.
    const md = somMarkdown([dag], false);
    expect(md).toContain("| # | Navn | Tid |");
    expect(md).not.toContain("Oppgave");
  });

  it("nummererer bare samtalene, ikke lunsjen", () => {
    const md = somMarkdown([dag], false);
    expect(md).toContain("| 1 | Tony Soprano");
    expect(md).toContain("| 2 | Carmela Soprano");
  });

  it("merker den som ikke møtte", () => {
    const med = { ...dag, rader: [{ ...dag.rader[0], motte: false }] };
    expect(somMarkdown([med], false)).toContain("Tony Soprano (møtte ikke)");
  });

  it("skriver Teams-tabell som følger modus", () => {
    expect(somTeamsHtml([dag], true)).toContain("<th>Oppgave</th>");
    expect(somTeamsHtml([dag], false)).not.toContain("<th>Oppgave</th>");
  });

  it("rømmer tegn som ellers ville brutt tabellen", () => {
    const med = {
      ...dag,
      rader: [{ ...dag.rader[0], navn: "Tony <b>Soprano</b>" }],
    };
    expect(somTeamsHtml([med], false)).toContain("&lt;b&gt;");
  });
});

describe("grupperTrekninger", () => {
  const dag = (over: Partial<Samtaledag>): Samtaledag => ({
    id: Math.random().toString(36).slice(2),
    skolearId: "ar",
    skolearFagId: null,
    fagKode: null,
    vurderingId: null,
    oktId: null,
    dato: "2026-11-24",
    fra: "08:30",
    til: "15:00",
    lunsjFra: null,
    lunsjMin: null,
    antall: 0,
    ...over,
  });

  it("samler dagene som deler fag til én trekning", () => {
    const ut = grupperTrekninger([
      dag({
        skolearFagId: "sf1",
        fagKode: "MFL1",
        dato: "2026-12-02",
        antall: 12,
      }),
      dag({
        skolearFagId: "sf1",
        fagKode: "MFL1",
        dato: "2026-12-03",
        antall: 12,
      }),
    ]);
    expect(ut).toHaveLength(1);
    expect(ut[0].antall).toBe(24);
    expect(ut[0].forste).toBe("2026-12-02");
    expect(ut[0].siste).toBe("2026-12-03");
  });

  it("holder mentorsamtalen for seg — den har ikke noe fag", () => {
    const ut = grupperTrekninger([
      dag({ skolearFagId: "sf1", fagKode: "MFL1" }),
      dag({ skolearFagId: null }),
    ]);
    expect(ut).toHaveLength(2);
    expect(ut.some((t) => t.skolearFagId === null)).toBe(true);
  });

  it("setter nyeste trekning først", () => {
    const ut = grupperTrekninger([
      dag({ skolearFagId: "a", dato: "2026-09-01" }),
      dag({ skolearFagId: "b", dato: "2026-12-01" }),
    ]);
    expect(ut[0].skolearFagId).toBe("b");
  });

  it("tåler dager uten dato", () => {
    // En dag som nettopp er lagt til har ingen dato ennå.
    const ut = grupperTrekninger([dag({ dato: "" })]);
    expect(ut[0].forste).toBe("");
    expect(ut[0].dager).toHaveLength(1);
  });

  it("gir ingenting for en tom liste", () => {
    expect(grupperTrekninger([])).toEqual([]);
  });
});

describe("dagenssetning", () => {
  const s = (fornavn: string, klokkeslett: string) => ({
    fornavn,
    klokkeslett,
    varighetMin: 20,
  });

  it("sier hvem du begynner med, og hvor mange som står igjen", () => {
    const ut = dagenssetning(
      [s("Tony", "12:30"), s("Carmela", "12:55"), s("Adriana", "13:20")],
      "08:00",
      true,
    );
    expect(ut).toBe(
      "Mentorsamtaler i dag. Du begynner med Tony kl. 12:30, før du har 2 elever fram til kl. 13:40.",
    );
  });

  it("teller fra den neste når dagen har begynt", () => {
    // Den første kan være unnagjort for to timer siden.
    const ut = dagenssetning(
      [s("Tony", "12:30"), s("Carmela", "12:55"), s("Adriana", "13:20")],
      "13:00",
      true,
    );
    expect(ut).toContain("fortsetter med Adriana kl. 13:20");
    expect(ut).toContain("den siste");
  });

  it("sier fra når alle er unnagjort", () => {
    const ut = dagenssetning([s("Tony", "12:30")], "15:00", true);
    expect(ut).toBe("Mentorsamtaler i dag. Alle 1 er unnagjort.");
  });

  it("bøyer entall riktig", () => {
    const ut = dagenssetning(
      [s("Tony", "12:30"), s("Carmela", "12:55")],
      "08:00",
      true,
    );
    expect(ut).toContain("1 elev fram til");
  });

  it("kaller fagsamtaler noe annet enn mentorsamtaler", () => {
    expect(dagenssetning([s("Tony", "09:00")], "08:00", false)).toContain(
      "Samtaler i dag",
    );
    expect(dagenssetning([s("Tony", "09:00")], "08:00", true)).toContain(
      "Mentorsamtaler i dag",
    );
  });

  it("gir null når det ikke er samtaler", () => {
    expect(dagenssetning([], "08:00", true)).toBeNull();
  });
});

describe("flyttMellomDager", () => {
  const dager = () => [
    ["Tony", "Carmela", "Adriana"],
    ["Silvio", "Paulie"],
  ];

  it("setter eleven sist på en dag med ledig plass", () => {
    // Tony var tidlig sist; han dras til bunnen av dag 2.
    const { perDag, byttet } = flyttMellomDager(
      dager(),
      [3, 3],
      { dag: 0, rad: 0 },
      { dag: 1, rad: 1, etter: true },
    );
    expect(perDag).toEqual([
      ["Carmela", "Adriana"],
      ["Silvio", "Paulie", "Tony"],
    ]);
    expect(byttet).toBeNull();
  });

  it("setter inn foran raden når den slippes på øvre halvdel", () => {
    const { perDag } = flyttMellomDager(
      dager(),
      [3, 3],
      { dag: 0, rad: 2 },
      { dag: 1, rad: 0, etter: false },
    );
    expect(perDag[1]).toEqual(["Adriana", "Silvio", "Paulie"]);
  });

  it("bytter plass når måldagen er full", () => {
    const { perDag, byttet } = flyttMellomDager(
      dager(),
      [3, 2],
      { dag: 0, rad: 0 },
      { dag: 1, rad: 1, etter: true },
    );
    expect(perDag).toEqual([
      ["Paulie", "Carmela", "Adriana"],
      ["Silvio", "Tony"],
    ]);
    expect(byttet).toBe("Paulie");
  });

  it("rører ikke originalen", () => {
    const inn = dager();
    flyttMellomDager(
      inn,
      [3, 3],
      { dag: 0, rad: 0 },
      { dag: 1, rad: 0, etter: false },
    );
    expect(inn).toEqual(dager());
  });
});

describe("gruppesamtaler", () => {
  const elever = (n: number) =>
    Array.from({ length: n }, (_, i) => `e${i + 1}`);

  it("deler i par, og gjør den siste til en trio når det ikke går opp", () => {
    const g = delIGrupper(elever(25), 2);
    expect(g).toHaveLength(12);
    expect(g.slice(0, 11).every((x) => x.length === 2)).toBe(true);
    expect(g[11]).toHaveLength(3);
    expect(g.flat()).toEqual(elever(25));
  });

  it("legger resten én og én på de siste gruppene", () => {
    // 22 i firere: fem grupper, to til overs → to femmere, ikke én sekser.
    expect(delIGrupper(elever(22), 4).map((x) => x.length)).toEqual([
      4, 4, 4, 5, 5,
    ]);
  });

  it("samler alle i én gruppe når de er færre enn gruppestørrelsen", () => {
    expect(delIGrupper(elever(2), 3)).toEqual([["e1", "e2"]]);
  });

  it("gir hver elev sin egen enhet med størrelse 1", () => {
    expect(delIGrupper(elever(3), 1)).toEqual([["e1"], ["e2"], ["e3"]]);
  });

  it("teller plassene som trengs", () => {
    expect(antallEnheter(25, 2)).toBe(12);
    expect(antallEnheter(25, 1)).toBe(25);
    expect(antallEnheter(2, 3)).toBe(1);
    expect(antallEnheter(0, 2)).toBe(0);
  });

  it("pakker en gruppe inn og ut igjen", () => {
    const id = enhetId(["a", "b"]);
    expect(medlemmerAv(id)).toEqual(["a", "b"]);
    expect(enhetId(["a"])).toBe("a");
    expect(medlemmerAv("a")).toEqual(["a"]);
  });

  it("flytter en elev til en annen gruppe, og sier hvilke id-er som ble nye", () => {
    const ab = enhetId(["a", "b"]);
    const cd = enhetId(["c", "d"]);
    const { perDag, nyId } = flyttTilEnhet([[ab], [cd]], "b", {
      dag: 1,
      rad: 0,
    });
    expect(perDag).toEqual([["a"], [enhetId(["c", "d", "b"])]]);
    expect(nyId.get(ab)).toBe("a");
    expect(nyId.get(cd)).toBe(enhetId(["c", "d", "b"]));
  });

  it("fjerner en gruppe som blir tom", () => {
    const { perDag } = flyttTilEnhet([["a", enhetId(["b", "c"])]], "a", {
      dag: 0,
      rad: 1,
    });
    expect(perDag).toEqual([[enhetId(["b", "c", "a"])]]);
  });
});

describe("tiderITrekning", () => {
  it("leser samtaletid og pause av klokkeslettene, uten lunsjen", () => {
    expect(
      tiderITrekning([
        [
          { fra: "08:30", til: "08:40" },
          { fra: "08:45", til: "08:55" },
          { fra: "09:00", til: "09:10" },
          // lunsj 09:10–12:00 er ikke en pause
          { fra: "12:00", til: "12:10" },
        ],
      ]),
    ).toEqual({ minutter: 10, pause: 5 });
  });

  it("tåler samtaler uten pause, og flere dager", () => {
    expect(
      tiderITrekning([
        [],
        [
          { fra: "09:00", til: "09:20" },
          { fra: "09:20", til: "09:40" },
        ],
      ]),
    ).toEqual({ minutter: 20, pause: 0 });
  });

  it("gir null uten samtaler", () => {
    expect(tiderITrekning([[], []])).toBeNull();
  });
});

describe("utenDobbelteElever", () => {
  const dag = (...ider: string[]) => ({
    rader: ider.map((elevId) => ({ elevId })),
  });
  const ider = (d: { rader: { elevId: string }[] }[]) =>
    d.map((x) => x.rader.map((r) => r.elevId));

  it("lar hver elev stå én gang, på den første plassen", () => {
    expect(
      ider(utenDobbelteElever([dag("a", "b", "a"), dag("b", "c")])),
    ).toEqual([["a", "b"], ["c"]]);
  });

  it("tar bort en gruppe der et medlem alt har plass", () => {
    expect(ider(utenDobbelteElever([dag("a"), dag("g:a+b", "c")]))).toEqual([
      ["a"],
      ["c"],
    ]);
  });

  it("rører ikke en trekning uten dobbelte", () => {
    expect(ider(utenDobbelteElever([dag("a", "b"), dag("c")]))).toEqual([
      ["a", "b"],
      ["c"],
    ]);
  });
});
