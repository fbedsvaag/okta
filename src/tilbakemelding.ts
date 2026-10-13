/**
 * «Gi tilbakemelding» nederst i sidemenyen (ARBEIDSLISTE 13.1).
 *
 * Klikk kopierer én linje til utklippstavla, `Økta 0.3.0 · macOS 15.1 ·
 * Skjerm: Elevkort`, og åpner skjemaet i standardnettleseren. Appen gjør
 * ingen nettverkskall selv; det er nettleseren som åpner lenka.
 *
 * Linja sier bare hvilken skjerm man står på, aldri en elev, et fag, et
 * tema eller annet innhold.
 */

/** Lenka til skjemaet. Tom: raden skjules. */
export const SKJEMA_URL = "https://forms.cloud.microsoft/e/HAvnL8PZtu";

/** Skjermnavnene i linja. Faste ord, så ingenting fra databasen lekker ut. */
const SKJERMER: Record<string, string> = {
  idag: "I dag",
  skoleruta: "Skoleruta",
  kalender: "Kalender",
  fag: "Fag",
  fagside: "Fagside",
  elever: "Elever",
  elev: "Elevkort",
  okter: "Økter",
  oversikt: "Fagoversikt",
  vurderinger: "Vurderinger",
  samtaler: "Samtaler",
  innstillinger: "Innstillinger",
  liminn: "Lim inn liste",
  klassekart: "Klassekart",
};

export function skjermnavn(visning: string): string {
  return SKJERMER[visning] ?? "Ukjent";
}

/** `Økta 0.3.0 · macOS 15.1 · Skjerm: Elevkort` */
export function tilbakemeldingslinje(
  versjon: string,
  system: string,
  visning: string,
): string {
  return `Økta ${versjon} · ${system} · Skjerm: ${skjermnavn(visning)}`;
}
