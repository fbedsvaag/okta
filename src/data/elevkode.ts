/**
 * Kort, lesbar id på eleven: forbokstav i fornavn + forbokstav i etternavn +
 * fem sifre. "TS48213".
 *
 * UUID-en (elev.id) er fortsatt den ekte nøkkelen og grunnlaget for synk.
 * Denne koden er til for mennesker og for hypertekst — den kan stå i en
 * filtittel, en overskrift eller en lenke, og den følger eleven gjennom hele
 * videregående.
 */

const SIFRE = 5;

/** Bokstaver vi godtar i initialene. Æ, Ø og Å er like lesbare som resten. */
const BOKSTAV = /\p{Letter}/u;

function forbokstav(navn: string, reserve: string): string {
  for (const tegn of navn) {
    if (BOKSTAV.test(tegn)) return tegn.toLocaleUpperCase("nb-NO");
  }
  return reserve;
}

function femSifre(): string {
  const tall = new Uint32Array(1);
  crypto.getRandomValues(tall);
  return String(tall[0] % 10 ** SIFRE).padStart(SIFRE, "0");
}

/**
 * Lager en kode som ikke finnes i `opptatt` fra før.
 *
 * Med 100 000 kombinasjoner per initialpar er kollisjon usannsynlig, men den
 * er ikke umulig, og en kollisjon ville betydd at to elever delte handle.
 * Derfor sjekkes det, i stedet for å håpe.
 */
export function lagElevkode(
  fornavn: string,
  etternavn: string,
  opptatt: ReadonlySet<string>,
): string {
  const initialer = forbokstav(fornavn, "X") + forbokstav(etternavn, "X");

  for (let forsok = 0; forsok < 50; forsok++) {
    const kode = initialer + femSifre();
    if (!opptatt.has(kode)) return kode;
  }

  throw new Error(
    `Klarte ikke lage en ledig elevkode for ${initialer}. Det betyr at det ` +
      `finnes urimelig mange elever med de initialene, og at noe er galt.`,
  );
}
