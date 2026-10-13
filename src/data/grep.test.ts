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

/**
 * Formen på grep-fag.json mot `GrepFag` (#16). Fila lages av
 * scripts/hent_grep.py utenfor TypeScript, så typen er en påstand; denne
 * testen er det som holder de to i takt.
 */
it("hver rad i grep-fag.json har formen GrepFag sier", async () => {
  const fil = (await import("../assets/grep-fag.json")).default as unknown as {
    hentet: unknown;
    kilde: unknown;
    antall_fag: unknown;
    fag: Record<string, unknown>[];
  };
  expect(typeof fil.hentet).toBe("string");
  expect(typeof fil.kilde).toBe("string");
  expect(fil.antall_fag).toBe(fil.fag.length);

  const tekstEllerNull = (v: unknown) => v === null || typeof v === "string";
  const bolker = (v: unknown) =>
    Array.isArray(v) &&
    v.every(
      (b) => typeof b?.tittel === "string" && tekstEllerNull(b?.beskrivelse),
    );
  const feil = fil.fag.filter(
    (f) =>
      !(
        tekstEllerNull(f.fagkode) &&
        typeof f.opplaeringsfag === "string" &&
        typeof f.navn === "string" &&
        typeof f.laereplan === "string" &&
        typeof f.laereplannavn === "string" &&
        tekstEllerNull(f.beskrivelse) &&
        (f.timer === null || typeof f.timer === "number") &&
        Array.isArray(f.kjerneelementer) &&
        (f.kjerneelementer as unknown[]).every((k) => typeof k === "string") &&
        bolker(f.tverrfaglige) &&
        bolker(f.ferdigheter) &&
        Array.isArray(f.kompetansemaal) &&
        (f.kompetansemaal as { kode?: unknown; tekst?: unknown }[]).every(
          (k) => typeof k.kode === "string" && typeof k.tekst === "string",
        )
      ),
  );
  expect(feil.map((f) => f.opplaeringsfag)).toEqual([]);
});
