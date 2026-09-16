import { describe, expect, it } from "vitest";
import {
  delPaDager,
  fordelPaDager,
  kapasitet,
  leggUtDagen,
  merknad,
  plassering,
  stokk,
  tildelTema,
  tilKlokke,
  tilMin,
  timerPaDagen,
  trekkRekkefolge,
  vektetRekkefolge,
  type Dagoppsett,
  type Plassering,
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

const medLunsj: Dagoppsett = {
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
    expect(kapasitet(medLunsj, 20, 5)).toBeLessThan(kapasitet(heldag, 20, 5));
  });

  it("trekker ikke fra lunsj på en dag som aldri når den", () => {
    // Dagen er over før 11:45, så lunsjen skal ikke spise av kapasiteten.
    // HTML-verktøyet trakk den fra uansett og regnet for lavt.
    const kort: Dagoppsett = { ...medLunsj, til: "10:30" };
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
    const slots = leggUtDagen(medLunsj, 20, 20, 5);
    const lunsj = slots.find((s) => s.type === "lunsj")!;
    expect(lunsj).toBeDefined();
    expect(tilMin(tilKlokke(lunsj.fra))).toBeGreaterThanOrEqual(tilMin("11:45"));
  });

  it("gir ingen elev et tidspunkt inne i lunsjen", () => {
    const slots = leggUtDagen(medLunsj, 20, 20, 5);
    const lunsj = slots.find((s) => s.type === "lunsj")!;
    const kolliderer = slots.filter(
      (s) => s.type === "samtale" && s.fra < lunsj.til && s.til > lunsj.fra,
    );
    expect(kolliderer).toEqual([]);
  });

  it("fortsetter samtalene etter lunsjen", () => {
    const slots = leggUtDagen(medLunsj, 20, 20, 5);
    const lunsj = slots.findIndex((s) => s.type === "lunsj");
    expect(slots.slice(lunsj + 1).some((s) => s.type === "samtale")).toBe(true);
  });

  it("legger ingen lunsj når dagen tar slutt før den", () => {
    // «En pause etter siste samtale er ikke en pause» (§4.10).
    const slots = leggUtDagen({ ...medLunsj, til: "10:30" }, 20, 20, 5);
    expect(slots.some((s) => s.type === "lunsj")).toBe(false);
  });

  it("legger ingen lunsj når det ikke er plass til en samtale etter den", () => {
    const slots = leggUtDagen({ ...medLunsj, til: "12:05" }, 20, 20, 5);
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
      timerPaDagen({ fra: "08:30", til: "15:30", lunsjFra: "11:45", lunsjMin: 30 }),
    ).toBe(6.5);
  });

  it("trekker ikke fra en lunsj som ligger utenfor dagen", () => {
    expect(
      timerPaDagen({ fra: "08:30", til: "10:30", lunsjFra: "11:45", lunsjMin: 30 }),
    ).toBe(2);
  });

  it("gir null på et spenn som ikke går opp", () => {
    expect(timerPaDagen({ fra: "15:00", til: "08:00", lunsjFra: null, lunsjMin: null })).toBe(0);
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
    const dager = trekkRekkefolge(elever, [3, 3], fast([0.1, 0.7, 0.3, 0.9, 0.5]));
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

  it("lar tilfeldigheten dominere, så køen ikke blir en fast rotasjon", () => {
    // Én «tidlig» veier 1,0, mens tilfeldigheten spenner over 2,0. Da kan en
    // elev med tidlig-historikk fortsatt havne først.
    const h = new Map<string, Plassering[]>([["a", ["tidlig"]]]);
    const ut = vektetRekkefolge(["a", "b"], h, fast([0.0, 0.9]));
    expect(ut[0]).toBe("a");
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
