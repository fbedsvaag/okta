import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "./testbase";

const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const { angreSkriving, tomSkrivelogg, hent } = await import("./index");
const { opprettSkolear } = await import("../data/skolear");
const { leggFagIAr } = await import("../data/fag");
const { opprettOkt, endreOkt, settSkaring, slettOkt, byttOkter } =
  await import("../data/okter");
const { opprettElev, koblePaFag } = await import("../data/elever");

const GRONN = "5ca1ade1-0001-4000-8000-000000000004";
let fag = "";
let ar = "";

beforeEach(async () => {
  base.nullstill();
  ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
  fag = await leggFagIAr(ar, "HIS3", "Historie", null);
  tomSkrivelogg();
});

const okt = async (id: string) =>
  (
    await hent<{ tema: string | null; slettet: string | null }>(
      "SELECT tema, slettet FROM okt WHERE id = $1",
      [id],
    )
  )[0];

describe("universell angring (21.10)", () => {
  it("en endret tittel kommer tilbake", async () => {
    const id = await opprettOkt(fag, "HIS3", "2026-09-01", "08:30", 90);
    await endreOkt(id, { tema: "Revolusjonene" });
    tomSkrivelogg();
    await endreOkt(id, { tema: "Feilklikk" });
    expect((await okt(id)).tema).toBe("Feilklikk");
    await angreSkriving();
    expect((await okt(id)).tema).toBe("Revolusjonene");
  });

  it("en ny rad slettes mykt igjen, og en slettet kommer tilbake", async () => {
    const id = await opprettOkt(fag, "HIS3", "2026-09-01", "08:30", 90);
    await angreSkriving();
    expect((await okt(id)).slettet).not.toBeNull();

    const b = await opprettOkt(fag, "HIS3", "2026-09-02", "08:30", 90);
    tomSkrivelogg();
    await slettOkt(b);
    expect((await okt(b)).slettet).not.toBeNull();
    await angreSkriving();
    expect((await okt(b)).slettet).toBeNull();
  });

  it("en skåring angres, og et bytte angres helt", async () => {
    const a = await opprettOkt(fag, "HIS3", "2026-09-01", "08:30", 90);
    const b = await opprettOkt(fag, "HIS3", "2026-09-02", "08:30", 90);
    await endreOkt(a, { tema: "A" });
    await endreOkt(b, { tema: "B" });
    const tony = await opprettElev("Tony", "Soprano");
    await koblePaFag(tony, fag);
    tomSkrivelogg();

    await settSkaring(tony, a, GRONN);
    await angreSkriving();
    const s = await hent<{ slettet: string | null }>(
      "SELECT slettet FROM skaring WHERE elev_id = $1",
      [tony],
    );
    expect(s[0].slettet).not.toBeNull();

    tomSkrivelogg();
    await byttOkter(a, b);
    expect((await okt(a)).tema).toBe("B");
    await angreSkriving();
    expect((await okt(a)).tema).toBe("A");
    expect((await okt(b)).tema).toBe("B");
  });

  it("selve angringen havner ikke i loggen", async () => {
    const id = await opprettOkt(fag, "HIS3", "2026-09-01", "08:30", 90);
    tomSkrivelogg();
    await endreOkt(id, { tema: "x" });
    await angreSkriving();
    expect(await angreSkriving()).toBeNull();
  });
});
