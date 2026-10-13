import { useRef } from "react";

/**
 * Bare det nyeste svaret får skrive (issue #5 og #6).
 *
 * Når man blar fort, kan svaret for forrige elev eller fag komme etter
 * svaret for den nye. Uten vakt skrives det gamle svaret da inn over det
 * nye: elevkortet viser en annen elevs bilde, eller temaene i ett fag
 * lagres under et annet.
 *
 *   const vakt = useSisteSvar();
 *   async function last() {
 *     const gjeldende = vakt();
 *     const svar = await hent(id);
 *     if (gjeldende()) settSvar(svar);
 *   }
 *
 * Hvert kall til `vakt()` gjør alle tidligere `gjeldende()` usanne.
 */
export function lagSisteSvar(): () => () => boolean {
  let siste = 0;
  return () => {
    const mitt = ++siste;
    return () => mitt === siste;
  };
}

/** `lagSisteSvar` som lever like lenge som komponenten. */
export function useSisteSvar(): () => () => boolean {
  const vakt = useRef<(() => () => boolean) | null>(null);
  if (!vakt.current) vakt.current = lagSisteSvar();
  return vakt.current;
}
