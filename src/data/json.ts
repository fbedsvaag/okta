/**
 * Leser en lagret JSON-verdi. Er den ødelagt, blir det standardverdien og
 * en melding i konsollen, ikke en ubehandlet feil som lar skjermen stå
 * uten data (issue #6).
 */
export function lesJson<T>(
  tekst: string | null | undefined,
  standard: T,
  hva = "lagret verdi",
): T {
  if (!tekst) return standard;
  try {
    return JSON.parse(tekst) as T;
  } catch {
    console.warn(`Kunne ikke lese ${hva}; bruker standardverdien.`);
    return standard;
  }
}
