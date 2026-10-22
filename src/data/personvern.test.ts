import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lagTestbase } from "../db/testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

/**
 * Personvern for mentorsamtalene (briefen for §28–29): notatene fra
 * mentorsamtalene, målene, ønskene og relasjonene er bare for læreren. De
 * kommer aldri med i fag, eksport, utskrift, Teams, kalender eller
 * oppsettfil.
 *
 * To lag: det som faktisk bygges (arkivet, elevens fil, oppsettfila) med
 * hemmelige merker i basen, og en sjekk av kildekoden til hver utgang, så
 * en ny spørring mot de private tabellene ikke kan snike seg inn.
 */

const { opprettElev, koblePaFag } = await import("./elever");
const { opprettElevnotat } = await import("./elevnotat");
const { leggFagIAr } = await import("./fag");
const { opprettSkolear } = await import("./skolear");
const { opprettSamtaledag, lagreTrekning, hentSamtaler } =
  await import("./samtale");
const { opprettRunde, leggTilMal } = await import("./samtalerunde");
const { leggTilOnske } = await import("./onsker");
const { byggArkiv, elevfilFor } = await import("./arkiv");
const { lagOppsett } = await import("./oppsettfil");

const NOTAT = "HEMMELIG-NOTAT-FRA-MENTORSAMTALEN";
const MAL = "HEMMELIG-MÅL-TIL-NESTE-GANG";
const skolear = {
  id: "",
  navn: "2026/27",
  start: "2026-08-17",
  slutt: "2027-06-20",
};

beforeEach(async () => {
  base.nullstill();
  skolear.id = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  const fag = await leggFagIAr(skolear.id, "HIS3", "Historie", null);
  const tony = await opprettElev("Tony", "Soprano");
  const paulie = await opprettElev("Paulie", "Gualtieri");
  await koblePaFag(tony, fag);
  await koblePaFag(paulie, fag);

  // En mentorsamtale med notat, mål og ønske.
  const runde = await opprettRunde(skolear.id, "Mentorsamtaler høst");
  const dag = await opprettSamtaledag(skolear.id, {
    skolearFagId: null,
    samtalerundeId: runde,
    dato: "2026-10-27",
    fra: "12:15",
    til: "12:35",
    lunsjFra: null,
    lunsjMin: null,
  });
  await lagreTrekning(dag, [
    { elevId: tony, klokkeslett: "12:15", varighetMin: 20, tema: null },
  ]);
  const [samtale] = await hentSamtaler(dag);
  await opprettElevnotat(tony, skolear.id, {
    dato: "2026-10-27",
    tekst: NOTAT,
    samtaleId: samtale.id,
  });
  await leggTilMal(tony, samtale.id, MAL);
  await leggTilOnske(tony, paulie, "samtale", samtale.id);

  // Et vanlig notat i møteloggen, som skal være med.
  await opprettElevnotat(tony, skolear.id, {
    dato: "2026-10-01",
    tekst: "Vanlig notat fra møteloggen",
  });
});

const hemmelig = (tekst: string) =>
  tekst.includes(NOTAT) || tekst.includes(MAL);

describe("mentorsamtalene går aldri ut", () => {
  it("ikke i arkivet, men møteloggen er fortsatt der", async () => {
    const filer = await byggArkiv(skolear);
    expect(filer.some((f) => hemmelig(f.innhold))).toBe(false);
    expect(
      filer.some((f) => f.innhold.includes("Vanlig notat fra møteloggen")),
    ).toBe(true);
  });

  it("ikke i elevens fil (innsyn)", async () => {
    const md = await elevfilFor(skolear, "Tony", "Soprano");
    expect(md).not.toBeNull();
    expect(hemmelig(md!)).toBe(false);
  });

  it("ikke i oppsettfila", async () => {
    const o = await lagOppsett({
      skole: null,
      deler: { skolear: true, fag: true, oktlengde: true, skalaer: true },
    });
    const tekst = JSON.stringify(o);
    expect(hemmelig(tekst)).toBe(false);
    expect(tekst).not.toContain("Mentorsamtaler høst");
  });
});

describe("utgangene leser ikke de private tabellene", () => {
  const rot = join(import.meta.dirname, "..");
  const les = (fil: string) => readFileSync(join(rot, fil), "utf8");
  // Eksport, arkiv, oppsettfil, kalender, Teams og utskrift.
  const utganger = [
    "data/oppsettfil.ts",
    "data/caldav.ts",
    "data/ical.ts",
    "data/gruppebilde.ts",
    "skjermer/muntlig/eksport.ts",
    "skjermer/muntlig/Resultater.tsx",
    "skjermer/foring/ForingArk.tsx",
  ];
  const privat =
    /\b(samtalemal|elevonske|neste_sammen|samtalerunde|hentOnsker|hentAvtaler|hentMal|hentKlassen|hentSamtalensNotat|guide_stilt|med_foresatt)\b/;

  for (const fil of utganger)
    it(`${fil} rører ikke ønsker, mål, relasjoner eller samtalenotater`, () => {
      const kilde = les(fil);
      expect(kilde).not.toMatch(privat);
      expect(kilde).not.toMatch(/\bFROM elevnotat\b/);
    });

  it("arkivet leser elevnotater bare med mentornotatene filtrert bort", () => {
    const kilde = les("data/arkiv.ts");
    expect(kilde).not.toMatch(privat);
    const notatspørringer = kilde.match(/FROM elevnotat n[\s\S]*?`/g) ?? [];
    expect(notatspørringer.length).toBeGreaterThan(0);
    // Delspørringen som bare spør om eleven har notater, avslører ingen tekst.
    for (const q of notatspørringer.filter((q) => q.includes("n.tekst")))
      expect(q).toContain("IKKE_MENTORNOTAT");
  });

  it("kalenderen får bare fornavn og klokkeslett for en mentorsamtale", async () => {
    const { lagSamtaleHendelse } = await import("./ical");
    const ics = lagSamtaleHendelse({
      id: "s1",
      fornavn: "Tony",
      dato: "2026-10-27",
      klokkeslett: "12:15",
      varighetMin: 20,
    });
    expect(ics).toContain("SUMMARY:Mentorsamtale med Tony");
    expect(ics).not.toMatch(/DESCRIPTION|LOCATION|Soprano/);
  });
});
