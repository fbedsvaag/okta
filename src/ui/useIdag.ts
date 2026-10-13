import { useEffect, useState } from "react";
import { idag } from "../db";

/**
 * Dagens dato, som skifter når klokka passerer midnatt (#4, #5).
 *
 * Appen står gjerne åpen i dagevis. Uten denne viste I dag gårsdagen etter
 * midnatt, og den daglige sikkerhetskopien ble bare tatt ved oppstart.
 * Sjekker hvert minutt; endrer seg bare når datoen faktisk er ny.
 */
export function useIdag(): string {
  const [dag, setDag] = useState(idag);
  useEffect(() => {
    const t = window.setInterval(() => {
      const na = idag();
      setDag((forrige) => (forrige === na ? forrige : na));
    }, 60_000);
    return () => window.clearInterval(t);
  }, []);
  return dag;
}
