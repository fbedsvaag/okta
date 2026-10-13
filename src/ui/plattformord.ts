import { erMac } from "./taster";

/**
 * Ord som er forskjellige på Mac og Windows (ARBEIDSLISTE 14.3 og 14.5).
 * Samlet her, så de kan testes uten en Windows-maskin.
 */

/** Der passordet til kalenderen lagres: «nøkkelringen» på Mac. */
export function nokkelringen(mac: boolean = erMac): string {
  return mac ? "nøkkelringen" : "Windows legitimasjonsbehandling";
}
