import { hentInnstilling, settInnstilling } from "../data/skolear";

/**
 * Glass på eller av (DESIGN.md §7).
 *
 * Som temaet: valget lagres i `innstilling`, en kopi ligger i localStorage
 * og leses før første tegning, og selve utseendet står i index.css — her
 * settes bare data-glass på <html>.
 *
 * «Reduser gjennomsiktighet» i macOS (`prefers-reduced-transparency`)
 * overstyrer valget. Det skjer i CSS-en, ikke her, så det følger systemet
 * også mens appen står åpen.
 */

export type Glass = "pa" | "av";

export const GLASS = "glass";
const KOPI = "okta-glass";

export function settGlass(glass: Glass): void {
  document.documentElement.dataset.glass = glass;
  try {
    localStorage.setItem(KOPI, glass);
  } catch {
    // Uten localStorage blinker det bare litt ved oppstart.
  }
}

/** Før første tegning: kopien i localStorage, uten å vente på basen. */
export function glassFraKopi(): void {
  let glass: Glass = "pa";
  try {
    if (localStorage.getItem(KOPI) === "av") glass = "av";
  } catch {
    // Standard: på.
  }
  settGlass(glass);
}

/** Ved oppstart, når basen er lastet: valget som faktisk er lagret. */
export async function brukGlass(): Promise<Glass> {
  const glass: Glass = (await hentInnstilling(GLASS)) === "av" ? "av" : "pa";
  settGlass(glass);
  return glass;
}

export async function lagreGlass(glass: Glass): Promise<void> {
  settGlass(glass);
  await settInnstilling(GLASS, glass);
}
