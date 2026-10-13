import { describe, expect, it } from "vitest";
import { lagSisteSvar } from "./sisteSvar";

/** Et løfte vi selv bestemmer når blir ferdig. */
function utsatt<T>() {
  let ferdig!: (v: T) => void;
  const lofte = new Promise<T>((r) => (ferdig = r));
  return { lofte, ferdig };
}

describe("lagSisteSvar (#5)", () => {
  it("bare det nyeste kallet er gjeldende", () => {
    const vakt = lagSisteSvar();
    const a = vakt();
    expect(a()).toBe(true);
    const b = vakt();
    expect(a()).toBe(false);
    expect(b()).toBe(true);
  });

  it("et tregt svar for elev A skriver ikke over elev B", async () => {
    const vakt = lagSisteSvar();
    let vist: string | null = null;
    async function last(hent: Promise<string>) {
      const gjeldende = vakt();
      const svar = await hent;
      if (gjeldende()) vist = svar;
    }

    const a = utsatt<string>();
    const b = utsatt<string>();
    const lastA = last(a.lofte); // blar til A
    const lastB = last(b.lofte); // blar videre til B før A er ferdig
    b.ferdig("bilde av B");
    await lastB;
    a.ferdig("bilde av A"); // A kommer sist
    await lastA;

    expect(vist).toBe("bilde av B");
  });
});
