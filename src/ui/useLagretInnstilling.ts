import { useEffect, useRef, useState } from "react";
import { hentInnstilling, settInnstilling } from "../data/skolear";
import { useSisteSvar } from "./sisteSvar";

/**
 * En innstilling som hører til en nøkkel som kan skifte, f.eks. temaene
 * for faget som er valgt (#6, #14).
 *
 * - Leses på nytt når nøkkelen skifter; et tregt svar for forrige nøkkel
 *   skriver ikke over (useSisteSvar).
 * - Verdien huskes sammen med nøkkelen den ble lest fra. `lagre` skriver
 *   bare når de stemmer, så en endring gjort mens den nye nøkkelen lastes,
 *   aldri havner under feil nøkkel.
 * - `nokkel` null: ingenting leses eller lagres, verdien er `standard`.
 */
export function useLagretInnstilling<T>(
  nokkel: string | null,
  standard: T,
  les: (lagret: string | null) => T,
  skriv: (verdi: T) => string,
): [T, (ny: T) => void] {
  const [verdi, setVerdi] = useState<T>(standard);
  const lestFor = useRef<string | null>(null);
  const vakt = useSisteSvar();
  const fra = useRef({ standard, les });
  fra.current = { standard, les };

  useEffect(() => {
    lestFor.current = null;
    setVerdi(fra.current.standard);
    if (!nokkel) return;
    const gjeldende = vakt();
    void hentInnstilling(nokkel).then((v) => {
      if (!gjeldende()) return;
      lestFor.current = nokkel;
      setVerdi(fra.current.les(v));
    });
  }, [nokkel]);

  function lagre(ny: T) {
    if (!nokkel || lestFor.current !== nokkel) return;
    setVerdi(ny);
    void settInnstilling(nokkel, skriv(ny));
  }

  return [verdi, lagre];
}
