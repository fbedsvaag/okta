/**
 * Angre med ⌘Z (ARBEIDSLISTE 16.3, 16.4). Handlinger som endrer mange
 * ting på en gang — periode på flere økter, bytte to økter, slette — legger
 * igjen en angre-funksjon her. ⌘Z utenfor et tekstfelt kjører den siste.
 * Toasten (ui/Toast.tsx) viser det samme som knapp.
 *
 * Stakken lever bare så lenge appen er åpen; det er en angre-knapp, ikke en
 * historikk.
 */

export type Angring = { tekst: string; angre: () => Promise<void> | void };

const stakk: Angring[] = [];
const lyttere = new Set<() => void>();

export function leggTilAngring(a: Angring): void {
  stakk.push(a);
  if (stakk.length > 50) stakk.shift();
  lyttere.forEach((f) => f());
}

/** Den siste angringen, eller null. */
export function sisteAngring(): Angring | null {
  return stakk[stakk.length - 1] ?? null;
}

/** Kjører og fjerner den siste. Gir teksten tilbake, så den kan vises. */
export async function angreSiste(): Promise<string | null> {
  const a = stakk.pop();
  lyttere.forEach((f) => f());
  if (!a) return null;
  await a.angre();
  return a.tekst;
}

/** Fjerner en bestemt angring (toasten gjorde den). */
export async function angre(a: Angring): Promise<void> {
  const i = stakk.lastIndexOf(a);
  if (i < 0) return;
  stakk.splice(i, 1);
  lyttere.forEach((f) => f());
  await a.angre();
}

export function lyttAngring(f: () => void): () => void {
  lyttere.add(f);
  return () => lyttere.delete(f);
}

/** Bare til testene. */
export function tomAngring(): void {
  stakk.length = 0;
}
