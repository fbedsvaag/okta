import { beforeEach, describe, expect, it, vi } from "vitest";
import { lagTestbase } from "../db/testbase";

// Datalaget laster tilkoblingen én gang og holder på den. Testbasen settes
// derfor inn i stedet for plugin-en, før skolear.ts importeres.
const base = lagTestbase();
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => base },
}));

const {
  hentAktivtSkolear,
  hentAktivtSkolearId,
  hentSkolear,
  opprettSkolear,
  settAktivtSkolear,
  slettSkolear,
} = await import("./skolear");

/** Pekeren slik den faktisk står i basen, uten liveness-sjekken oppå. */
async function lagretPeker(): Promise<string | null> {
  const rader = await base.select<{ verdi: string }[]>(
    "SELECT verdi FROM innstilling WHERE nokkel = $1",
    ["aktivt_skolear"],
  );
  return rader[0]?.verdi ?? null;
}

beforeEach(() => base.nullstill());

describe("aktivt skoleår ved sletting", () => {
  it("flytter pekeren til nyeste gjenværende år", async () => {
    const gammelt = await opprettSkolear("2025/26", "2025-08-18", "2026-06-19");
    const nytt = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    await settAktivtSkolear(nytt);

    await slettSkolear(nytt);

    expect(await lagretPeker()).toBe(gammelt);
    expect((await hentAktivtSkolear())?.navn).toBe("2025/26");
  });

  it("rydder pekeren bort når det siste året slettes", async () => {
    const eneste = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");

    await slettSkolear(eneste);

    // Ingen død peker skal bli liggende igjen i basen.
    expect(await lagretPeker()).toBeNull();
    expect(await hentAktivtSkolear()).toBeNull();
  });

  it("lar pekeren stå når et annet år enn det aktive slettes", async () => {
    const aktivt = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    const annet = await opprettSkolear("2025/26", "2025-08-18", "2026-06-19");
    await settAktivtSkolear(aktivt);

    await slettSkolear(annet);

    expect(await lagretPeker()).toBe(aktivt);
  });
});

describe("oppstart med en peker som ikke holder", () => {
  it("faller tilbake på nyeste gjenværende år og retter opp pekeren", async () => {
    const eldre = await opprettSkolear("2024/25", "2024-08-19", "2025-06-20");
    const nyere = await opprettSkolear("2025/26", "2025-08-18", "2026-06-19");
    await settAktivtSkolear("finnes-ikke-lenger");

    const ar = await hentAktivtSkolear();

    expect(ar?.id).toBe(nyere);
    expect(ar?.navn).toBe("2025/26");
    expect(await lagretPeker()).toBe(nyere);
    expect(eldre).not.toBe(nyere);
  });

  it("gir veiviseren når det ikke finnes noen år å falle tilbake på", async () => {
    await settAktivtSkolear("finnes-ikke-lenger");

    expect(await hentAktivtSkolear()).toBeNull();
    expect(await lagretPeker()).toBeNull();
  });

  it("leser en død peker som ingen peker", async () => {
    const ar = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    await slettSkolear(ar);
    await settAktivtSkolear(ar); // død igjen, som før reparasjonen

    expect(await hentAktivtSkolearId()).toBeNull();
  });
});

describe("veiviseren etter at siste år er slettet", () => {
  // Dette var selve hengingen: pekeren sto på et slettet år, veiviseren
  // opprettet et nytt, men `opprettSkolear` så en peker som ikke var null og
  // lot være å gjøre året aktivt. Da var man tilbake i veiviseren igjen, og
  // kom aldri videre uansett hvor mange år man opprettet.
  it("gjør det nye året aktivt, så man kommer inn i appen", async () => {
    const eneste = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    await slettSkolear(eneste);

    const nytt = await opprettSkolear("2027/28", "2027-08-16", "2028-06-19");

    expect(await hentAktivtSkolearId()).toBe(nytt);
    expect((await hentAktivtSkolear())?.navn).toBe("2027/28");
  });

  it("lar seg ikke lure av en død peker gang på gang", async () => {
    const forste = await opprettSkolear("2026/27", "2026-08-17", "2027-06-20");
    await slettSkolear(forste);

    const andre = await opprettSkolear("2027/28", "2027-08-16", "2028-06-19");
    await slettSkolear(andre);

    const tredje = await opprettSkolear("2028/29", "2028-08-20", "2029-06-19");

    expect(await hentAktivtSkolearId()).toBe(tredje);
    expect(await hentSkolear()).toHaveLength(1);
  });
});
