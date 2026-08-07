import { useEffect, useState } from "react";

/**
 * Bevegelse, SPEC §13 og merkevareguiden.
 *
 * Appen skal nesten ikke bevege seg. Det som beveger seg, gjør det med
 * kurvene og varighetene som ligger som tokens i index.css: 180 ms inn,
 * 130 ms ut, 90 ms for markøren.
 */

/**
 * Holder et sidepanel i live mens det glir ut.
 *
 * Uten dette forsvinner panelet momentant: React river det ut av treet i
 * samme render som valget blir `null`, og da rekker ingen CSS-overgang å
 * kjøre. Her beholdes den siste verdien til utgangen er ferdig, slik at
 * panelet har noe å vise mens det animeres bort.
 *
 * `apen` sier hvor panelet skal, `vist` hva det skal vise mens det er der.
 */
export function useGlidende<T>(
  verdi: T | null,
  msUt = 130,
): { vist: T | null; apen: boolean } {
  const [vist, setVist] = useState<T | null>(verdi);

  useEffect(() => {
    if (verdi !== null) {
      setVist(verdi);
      return;
    }
    const t = setTimeout(() => setVist(null), msUt);
    return () => clearTimeout(t);
  }, [verdi, msUt]);

  return { vist, apen: verdi !== null };
}
