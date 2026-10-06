import { useEffect, useState } from "react";
import { hentInnstilling, settInnstilling } from "../data/skolear";

/**
 * Bevegelse, SPEC §13 og merkevareguiden.
 *
 * Appen skal nesten ikke bevege seg. Det som beveger seg, gjør det med
 * kurvene og varighetene som ligger som tokens i index.css: 180 ms inn,
 * 130 ms ut, 90 ms for markøren.
 */

/**
 * Holder et sidepanel i live mens det glir ut.
 *
 * Uten dette forsvinner panelet momentant: React river det ut av treet i
 * samme render som valget blir `null`, og da rekker ingen CSS-overgang å
 * kjøre. Her beholdes den siste verdien til utgangen er ferdig, slik at
 * panelet har noe å vise mens det animeres bort.
 *
 * `apen` sier hvor panelet skal, `vist` hva det skal vise mens det er der.
 */
export function useGlidende<T>(
  verdi: T | null,
  msUt = 130,
): { vist: T | null; apen: boolean } {
  const [vist, setVist] = useState<T | null>(verdi);

  useEffect(() => {
    if (verdi !== null) {
      setVist(verdi);
      return;
    }
    const t = setTimeout(() => setVist(null), msUt);
    return () => clearTimeout(t);
  }, [verdi, msUt]);

  return { vist, apen: verdi !== null };
}

// ------------------------------------------------------- innstillingen

/**
 * Bevegelse på, dempet eller av (DESIGN.md §8), valgt i Innstillinger ›
 * Utseende. «Som macOS» følger «Reduser bevegelse» i systemet. Som temaet:
 * valget lagres i `innstilling`, en kopi i localStorage til første tegning,
 * og selve virkningen står i index.css under `:root[data-bevegelse]`.
 */
export type Bevegelse = "system" | "pa" | "dempet" | "av";

export const BEVEGELSE = "bevegelse";
const KOPI = "okta-bevegelse";

function gyldig(v: string | null): Bevegelse {
  return v === "pa" || v === "dempet" || v === "av" ? v : "system";
}

export function settBevegelse(b: Bevegelse): void {
  document.documentElement.dataset.bevegelse = b;
  try {
    localStorage.setItem(KOPI, b);
  } catch {
    // Uten localStorage gjelder systemvalget til basen er lest.
  }
}

export function bevegelseFraKopi(): void {
  let v: string | null = null;
  try {
    v = localStorage.getItem(KOPI);
  } catch {
    // Standard: som macOS.
  }
  settBevegelse(gyldig(v));
}

export async function brukBevegelse(): Promise<Bevegelse> {
  const b = gyldig(await hentInnstilling(BEVEGELSE));
  settBevegelse(b);
  return b;
}

export async function lagreBevegelse(b: Bevegelse): Promise<void> {
  settBevegelse(b);
  await settInnstilling(BEVEGELSE, b);
}
