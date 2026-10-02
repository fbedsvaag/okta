import { getCurrentWindow } from "@tauri-apps/api/window";
import { hentInnstilling, settInnstilling } from "../data/skolear";

/**
 * Lys eller mørk modus (DESIGN.md §4).
 *
 * Valget — System, Lys eller Mørk — lagres i `innstilling`, så det følger
 * basen. En kopi ligger i localStorage, og den leses før appen tegnes
 * (main.tsx): ellers ville appen blinke lyst i det den åpnes i mørk modus,
 * mens databasen lastes.
 *
 * Fargene selv står i index.css; her settes bare data-tema på <html>.
 */

export type Tema = "system" | "lys" | "mork";

export const TEMA = "tema";
const KOPI = "okta-tema";

const morkMedie = () => window.matchMedia("(prefers-color-scheme: dark)");

let lytter: (() => void) | null = null;

/** Setter modusen på dokumentet, og følger macOS når valget er System. */
export function settTema(tema: Tema): void {
  const bruk = () => {
    const mork = tema === "mork" || (tema === "system" && morkMedie().matches);
    document.documentElement.dataset.tema = mork ? "mork" : "lys";
  };
  bruk();

  if (lytter) morkMedie().removeEventListener("change", lytter);
  lytter = tema === "system" ? bruk : null;
  if (lytter) morkMedie().addEventListener("change", lytter);

  try {
    localStorage.setItem(KOPI, tema);
  } catch {
    // Uten localStorage blinker det bare litt ved oppstart.
  }

  // Tittellinja til vinduet er macOS sin. null = følg systemet. Utenfor
  // Tauri (testsider i nettleser) finnes ikke vinduet, og da hoppes det over.
  try {
    void getCurrentWindow()
      .setTheme(tema === "system" ? null : tema === "mork" ? "dark" : "light")
      .catch(() => {});
  } catch {
    // ikke i Tauri
  }
}

/** Før første tegning: kopien i localStorage, uten å vente på basen. */
export function temaFraKopi(): void {
  let tema: Tema = "system";
  try {
    const v = localStorage.getItem(KOPI);
    if (v === "lys" || v === "mork" || v === "system") tema = v;
  } catch {
    // Standard: følg systemet.
  }
  settTema(tema);
}

/** Ved oppstart, når basen er lastet: valget som faktisk er lagret. */
export async function brukTema(): Promise<Tema> {
  const v = await hentInnstilling(TEMA);
  const tema: Tema = v === "lys" || v === "mork" ? v : "system";
  settTema(tema);
  return tema;
}

export async function lagreTema(tema: Tema): Promise<void> {
  settTema(tema);
  await settInnstilling(TEMA, tema);
}
