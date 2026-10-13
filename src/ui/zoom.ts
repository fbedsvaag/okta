import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { Submenu as Undermeny } from "@tauri-apps/api/menu";
import { hentInnstilling, settInnstilling } from "../data/skolear";
import { erMac } from "./taster";

/**
 * Zoom (ARBEIDSLISTE 10.6): ⌘+ og ⌘− gjør alt større og mindre i faste
 * trinn, ⌘0 tilbake til 100 %. Hele vinduet skaleres (webview.setZoom),
 * ikke bare teksten — det er noe annet enn Tekststørrelse i Innstillinger.
 *
 * Som temaet: valget lagres i `innstilling`, og en kopi i localStorage
 * brukes før basen er lastet, så appen ikke åpner i 100 % og hopper.
 */

export const ZOOMTRINN = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const;

export const ZOOM = "zoom";
const KOPI = "okta-zoom";

let naa = 1;

function gyldig(v: string | null): number {
  const n = Number(v);
  return ZOOMTRINN.includes(n as (typeof ZOOMTRINN)[number]) ? n : 1;
}

/** Neste trinn opp (1) eller ned (−1) fra der man står. */
export function nesteTrinn(fra: number, retning: 1 | -1): number {
  // Står man mellom to trinn, er «neste» det nærmeste i den retningen.
  const her = ZOOMTRINN.findIndex((t) => Math.abs(t - fra) < 1e-9);
  if (her >= 0) {
    const i = Math.max(0, Math.min(ZOOMTRINN.length - 1, her + retning));
    return ZOOMTRINN[i];
  }
  const kandidater =
    retning > 0
      ? ZOOMTRINN.filter((t) => t > fra)
      : ZOOMTRINN.filter((t) => t < fra);
  if (kandidater.length === 0) return retning > 0 ? 1.5 : 0.8;
  return retning > 0 ? kandidater[0] : kandidater[kandidater.length - 1];
}

function brukPaVinduet(faktor: number): void {
  naa = faktor;
  // Utenfor Tauri (tester, nettleser) finnes ikke webviewen.
  try {
    void getCurrentWebview()
      .setZoom(faktor)
      .catch(() => {});
  } catch {
    // ikke i Tauri
  }
}

/** Før første tegning: kopien i localStorage. */
export function zoomFraKopi(): void {
  let v: string | null = null;
  try {
    v = localStorage.getItem(KOPI);
  } catch {
    // Standard: 100 %.
  }
  brukPaVinduet(gyldig(v));
}

/** Ved oppstart, når basen er lastet: valget som faktisk er lagret. */
export async function brukZoom(): Promise<void> {
  brukPaVinduet(gyldig(await hentInnstilling(ZOOM)));
}

export async function settZoom(faktor: number): Promise<void> {
  const f = gyldig(String(faktor));
  brukPaVinduet(f);
  try {
    localStorage.setItem(KOPI, String(f));
  } catch {
    // Kopien er bare for første tegning.
  }
  await settInnstilling(ZOOM, String(f));
}

export const zoomInn = () => settZoom(nesteTrinn(naa, 1));
export const zoomUt = () => settZoom(nesteTrinn(naa, -1));
export const zoomNull = () => settZoom(1);

/**
 * Zoom i View-menyen øverst på skjermen (macOS-menylinja). Standardmenyen
 * fra Tauri beholdes — Rediger med kopier og lim inn trengs — og zoom
 * legges til nederst i View. Tastene fanges av menyen når de passer;
 * ellers tar tastelytteren i App dem (⌘+ på norsk tastatur er ikke ⌘=).
 *
 * Bare på Mac. På Windows ville standardmenyen blitt en menylinje inne i
 * vinduet (Fil, Rediger, Vis …); der tar tastelytteren Ctrl+ og Ctrl−.
 */
export async function leggZoomIMenyen(mac: boolean = erMac): Promise<void> {
  if (!mac) return;
  const { Menu, MenuItem, PredefinedMenuItem, Submenu } =
    await import("@tauri-apps/api/menu");
  const meny = await Menu.default();
  let vis: Undermeny | null = null;
  for (const p of await meny.items())
    if (p instanceof Submenu && ["View", "Vis"].includes(await p.text()))
      vis = p;
  if (!vis) {
    vis = await Submenu.new({ text: "Vis" });
    await meny.append(vis);
  }
  const punkt = async (
    text: string,
    accelerator: string,
    action: () => void,
  ) => {
    try {
      return await MenuItem.new({ text, accelerator, action });
    } catch {
      // En tast menyen ikke forstår: punktet uten snarvei, tastelytteren tar den.
      return await MenuItem.new({ text, action });
    }
  };
  await vis.append([
    await PredefinedMenuItem.new({ item: "Separator" }),
    await punkt("Større", "CmdOrCtrl+Plus", () => void zoomInn()),
    await punkt("Mindre", "CmdOrCtrl+-", () => void zoomUt()),
    await punkt("Faktisk størrelse", "CmdOrCtrl+0", () => void zoomNull()),
  ]);
  await meny.setAsAppMenu();
}
