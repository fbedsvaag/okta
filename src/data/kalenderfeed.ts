import { invoke } from "@tauri-apps/api/core";
import { lagIcal } from "./ical";
import { lytt } from "./endringer";
import { hentOkter } from "./okter";
import { hentAllePerioder, periodeFor, type Periode } from "./perioder";
import { hentInnstilling, settInnstilling, type Skolear } from "./skolear";

/**
 * Kalenderstrømmen, sett fra frontend.
 *
 * Innholdet lages her, ikke i Rust, av samme grunn som resten av logikken
 * ligger her (§2). Det betyr også at avgjørelsen om hva som slipper ut tas
 * ett sted — i `ical.ts` — og ikke er spredt over to språk.
 */

const PA = "kalenderfeed_pa";

export async function erPa(): Promise<boolean> {
  return (await hentInnstilling(PA)) === "1";
}

export async function settPa(pa: boolean): Promise<void> {
  await settInnstilling(PA, pa ? "1" : "0");
}

export async function hentUrl(): Promise<string> {
  return invoke<string>("kalenderfeed_url");
}

export async function kjorer(): Promise<boolean> {
  return invoke<boolean>("kalenderfeed_kjorer");
}

/** Bygger strømmen fra basen og skyver den inn til serveren. */
export async function oppdater(skolear: Skolear): Promise<string> {
  const okter = await hentOkter(skolear.id);
  const alle = await hentAllePerioder(skolear.id);

  const perOkt = new Map<string, Periode>();
  for (const o of okter) {
    const p = periodeFor(
      o,
      alle.filter((x) => x.skolearFagId === o.skolearFagId),
    );
    if (p) perOkt.set(o.id, p);
  }

  const ics = lagIcal(okter, `Årsplan ${skolear.navn}`);
  await invoke("sett_kalenderfeed", { ics });
  return ics;
}

/** Ventetiden etter en endring før strømmen bygges på nytt. */
export const VENT_MS = 2000;
let avLytt: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Starter lytteren og fyller den. Kalles ved oppstart bare hvis brukeren
 * har slått strømmen på — ingenting lytter ellers.
 *
 * Strømmen bygges på nytt når øktene endres, litt etter siste endring. Før
 * ble den bare bygget ved oppstart, og en flyttet økt nådde ikke kalenderen
 * før appen ble startet på nytt.
 */
export async function start(skolear: Skolear): Promise<string> {
  await oppdater(skolear);
  avLytt?.();
  avLytt = lytt(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void oppdater(skolear).catch((e) => console.error("kalenderstrøm:", e));
    }, VENT_MS);
  });
  return invoke<string>("start_kalenderfeed");
}
