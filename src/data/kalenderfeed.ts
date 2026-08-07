import { invoke } from "@tauri-apps/api/core";
import { lagIcal } from "./ical";
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

  const ics = lagIcal(okter, perOkt, `Årsplan ${skolear.navn}`);
  await invoke("sett_kalenderfeed", { ics });
  return ics;
}

/**
 * Starter lytteren og fyller den. Kalles ved oppstart bare hvis brukeren
 * har slått strømmen på — ingenting lytter ellers.
 */
export async function start(skolear: Skolear): Promise<string> {
  await oppdater(skolear);
  return invoke<string>("start_kalenderfeed");
}

export async function skrivTilFil(sti: string): Promise<void> {
  await invoke("skriv_kalenderfil", { sti });
}
