import { expect, it } from "vitest";
import { sokFag, finnFag } from "./grep";

it("finner fag på navn, kode og delstreng", async () => {
  const treff = await sokFag("markedsføring");
  expect(treff.length).toBeGreaterThan(0);
  const mfl1 = treff.find((f) => f.fagkode === "SAM3045");
  expect(mfl1?.navn).toBe("Markedsføring og ledelse 1");
  expect(mfl1?.kompetansemaal).toHaveLength(14);

  expect((await sokFag("SAM3045"))[0]?.fagkode).toBe("SAM3045");
  expect((await sokFag("kroppsøv")).length).toBeGreaterThan(0);
});

it("rangerer treff på starten av navnet først", async () => {
  const treff = await sokFag("norsk");
  expect(treff[0].navn.toLowerCase().startsWith("norsk")).toBe(true);
});

it("slår opp igjen et lagret fag", async () => {
  expect((await finnFag("SAM3045"))?.navn).toBe("Markedsføring og ledelse 1");
  expect(await finnFag(null)).toBeNull();
});

it("krever minst to tegn, så hele lista ikke returneres", async () => {
  expect(await sokFag("m")).toEqual([]);
});
