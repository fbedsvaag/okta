import { useEffect, useLayoutEffect, useState } from "react";
import { hentInnstilling, settInnstilling } from "../data/skolear";

/**
 * Bevegelse, SPEC §13 og merkevareguiden (docs/arkiv/merkevareguide.html).
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

/**
 * Inngangen til et ark, ⌘K eller en meny (ARBEIDSLISTE 10.1).
 *
 * Elementet monteres i starttilstanden (`data-inne="false"`), én frame får
 * tegnes, og så går det over til sluttilstanden med en vanlig CSS-overgang.
 * Før spilte en keyframe-animasjon fra en tilstand elementet aldri hadde
 * vært i, med sprett, og det så ut som det hoppet.
 *
 * To bilder, ikke ett: effekten kan kjøre før første tegning, og da ville
 * én requestAnimationFrame slå over til sluttilstanden før starttilstanden
 * noen gang var vist.
 *
 * Selve bevegelsen står i index.css under `[data-inngang]`. Glass tones
 * aldri med `opacity`: WebKit tegner ikke uskarpheten mens et element —
 * eller noe over det — har opacity under 1, og da blinker det. Bakgrunnen
 * og innholdet tones i stedet, så uskarpheten er på fra første bilde.
 */
export function useInngang(): boolean {
  const [inne, setInne] = useState(false);
  useLayoutEffect(() => {
    let andre = 0;
    const forste = requestAnimationFrame(() => {
      andre = requestAnimationFrame(() => setInne(true));
    });
    return () => {
      cancelAnimationFrame(forste);
      cancelAnimationFrame(andre);
    };
  }, []);
  return inne;
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

/**
 * S-kurven (DESIGN.md §8, lerretet «Bevegelse»): et lite overskudd, aldri
 * mer. Brukes overalt der noe flytter seg. Samme verdi som `--ease-sprett`
 * i index.css — der CSS-en kan bruke tokenet, gjør den det.
 */
export const EASE_SPRETT = "cubic-bezier(.34, 1.32, .5, 1)";
