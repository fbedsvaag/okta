/**
 * Beskjed om at øktene er endret.
 *
 * Ligger her framfor at hvert kallsted i grensesnittet skal huske det:
 * `opprettOkt`, `endreOkt` og `slettOkt` er de eneste veiene inn, så én
 * beskjed derfra dekker alt. Da kan ikke en ny knapp et sted glemme å si fra.
 *
 * Bevisst uvitende om hvem som lytter — datalaget skal ikke kjenne til
 * publisering.
 */

type Lytter = () => void;

const lyttere = new Set<Lytter>();

export function lytt(fn: Lytter): () => void {
  lyttere.add(fn);
  return () => lyttere.delete(fn);
}

export function varsle(): void {
  for (const fn of lyttere) {
    try {
      fn();
    } catch (e) {
      // En lytter som feiler skal ikke velte lagringen som utløste den.
      console.error("endringslytter:", e);
    }
  }
}

// ----------------------------------------------------------------- elever

/**
 * Beskjed om at en elev er endret — fag, mentor, klasse eller sletting.
 *
 * Elevkortet kan ligge over elevlista eller fagpanelet. Endrer man faget
 * til en elev i kortet, skal lista bak vise det med en gang; ellers ser det
 * ut som ingenting skjedde.
 */
const elevlyttere = new Set<Lytter>();

export function lyttElever(fn: Lytter): () => void {
  elevlyttere.add(fn);
  return () => elevlyttere.delete(fn);
}

export function varsleElever(): void {
  for (const fn of elevlyttere) {
    try {
      fn();
    } catch (e) {
      console.error("elevlytter:", e);
    }
  }
}
