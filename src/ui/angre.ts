import {
  angreSkriving,
  gjorOmSkriving,
  sisteOmigjen,
  leggTilEgenAngring,
  lyttSkrivinger,
  sisteSkriving,
  tomSkrivelogg,
  type Skriving,
} from "../db";
import {
  varsle,
  varsleElever,
  varsleKlassekart,
  varsleVurderinger,
} from "../data/endringer";

/**
 * Angre med ⌘Z, knappen i verktøylinja og «Angre» i toasten (21.10).
 *
 * Universell: databaselaget (src/db) husker hvordan hver rad var før den
 * ble skrevet, så alt som lagres kan angres — også en endret tittel eller
 * et feilklikk. Handlinger som har et godt navn («Byttet 12.10 og 14.10»),
 * gir det til den siste skrivingen med `leggTilAngring`; ellers får den et
 * navn etter hva som ble endret. Loggen lever bare mens appen er åpen.
 */

export type Angring = { tekst: string; angre: () => Promise<void> | void };

/** Hva som ble endret, sagt med vanlige ord. */
const HVA: Record<string, string> = {
  okt: "økta",
  oktnotat: "notatet",
  okt_kompetansemal: "kompetansemålene",
  periode: "perioden",
  periode_kompetansemal: "kompetansemålene",
  vurdering: "vurderingen",
  vurdering_okt: "vurderingen",
  vurderingsresultat: "resultatet",
  skaring: "skåringen",
  elev: "eleven",
  elev_fag: "eleven",
  elev_klasse: "eleven",
  elevnotat: "notatet",
  elevbilde: "bildet",
  samtale: "samtalen",
  samtaledag: "samtalene",
  klassekart: "klassekartet",
  plassering: "klassekartet",
  oppsett: "gruppene",
  kart_plassfarge: "pultfargene",
  elevregel: "klassekartet",
  rom: "rommet",
  fag: "faget",
  skolear_fag: "faget",
  skolear: "skoleåret",
  fridag: "skoleruta",
  gjoremal: "gjøremålet",
  skala: "skalaen",
  skalaverdi: "skalaen",
  klasse: "klassen",
};

/** Navnet på en handling i loggen. */
function navn(s: Skriving): string {
  if (s.tekst) return s.tekst;
  const ord = [...new Set([...s.tabeller].map((t) => HVA[t] ?? "en endring"))];
  return `endringen i ${ord.slice(0, 2).join(" og ")}`;
}

/**
 * Gir den siste handlingen et navn. Skjedde det ikke noe i basen nettopp
 * (en test, eller noe utenfor basen), legges den inn med sin egen angring.
 */
export function leggTilAngring(a: Angring): void {
  const s = sisteSkriving();
  if (s && !s.egen && !s.tekst && Date.now() - s.tid < 3000) {
    s.tekst = a.tekst;
    return;
  }
  leggTilEgenAngring(a.tekst, a.angre);
}

/** Den siste angringen, eller null. */
export function sisteAngring(): Angring | null {
  const s = sisteSkriving();
  return s ? { tekst: navn(s), angre: () => void angreSiste() } : null;
}

/** Kjører og fjerner den siste. Gir teksten tilbake, så den kan vises. */
export async function angreSiste(): Promise<string | null> {
  const s = await angreSkriving();
  if (!s) return null;
  // Alle skjermer leser på nytt: angringen kan ha rørt hva som helst.
  varsle();
  varsleElever();
  varsleVurderinger();
  varsleKlassekart();
  return navn(s);
}

/** Det som kan gjøres om (⇧⌘Z), eller null. */
export function sisteGjorOm(): { tekst: string } | null {
  const s = sisteOmigjen();
  return s ? { tekst: navn(s) } : null;
}

/** Gjør om det som sist ble angret. Gir teksten tilbake. */
export async function gjorOmSiste(): Promise<string | null> {
  const s = await gjorOmSkriving();
  if (!s) return null;
  varsle();
  varsleElever();
  varsleVurderinger();
  varsleKlassekart();
  return navn(s);
}

/** «Angre» i toasten: den siste handlingen. */
export async function angre(_a: Angring): Promise<void> {
  await angreSiste();
}

export function lyttAngring(f: () => void): () => void {
  return lyttSkrivinger(f);
}

/** Bare til testene. */
export function tomAngring(): void {
  tomSkrivelogg();
}
