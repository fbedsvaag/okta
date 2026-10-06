import { useEffect, useState } from "react";
import { hentAlleElevbilder } from "../data/elevbilde";
import { lyttElever } from "../data/endringer";
import { Elevbilde } from "./Elevbilde";

/**
 * Elevbildet der et elevnavn står (DESIGN.md §6): en rund miniatyr foran
 * navnet, i fast størrelse — med bilde eller med plassholder — så radhøyden
 * aldri endrer seg av at noen mangler bilde.
 *
 * Bildene hentes én gang og deles av alle som viser dem, og hentes på nytt
 * når elever eller bilder endres. Bildet går aldri ut av appen.
 */

let bilder: Map<string, string> | null = null;
let henter: Promise<void> | null = null;
const abonnenter = new Set<() => void>();

function hent() {
  henter ??= hentAlleElevbilder()
    .then((m) => {
      bilder = m;
      abonnenter.forEach((f) => f());
    })
    .catch((e) => console.error("elevbilder:", e))
    .finally(() => {
      henter = null;
    });
}

let lytter: (() => void) | null = null;

/** Alle bildene, etter elev. Tom til de er hentet. */
export function useElevbilder(): Map<string, string> {
  const [, setVersjon] = useState(0);
  useEffect(() => {
    const oppdater = () => setVersjon((v) => v + 1);
    abonnenter.add(oppdater);
    if (!bilder) hent();
    // Én felles lytter: endres elevene, hentes bildene på nytt.
    lytter ??= lyttElever(hent);
    return () => {
      abonnenter.delete(oppdater);
    };
  }, []);
  return bilder ?? new Map();
}

export function Elevfoto({
  elevId,
  storrelse = 20,
  navn,
  klasse = "",
}: {
  elevId: string;
  /** sidene i px */
  storrelse?: number;
  /** til verktøytipset og skjermlesere */
  navn?: string;
  klasse?: string;
}) {
  const alle = useElevbilder();
  const src = alle.get(elevId);
  if (src)
    return (
      <Elevbilde
        src={src}
        storrelse={storrelse}
        hjorne={storrelse / 2}
        alt={navn ?? ""}
        klasse={klasse}
      />
    );
  return <Plassholder storrelse={storrelse} klasse={klasse} />;
}

/**
 * Uten bilde: en enkel figur i palettens farger. (Illustrasjonen etter
 * kjønn kommer i ARBEIDSLISTE 9.7; denne er den nøytrale.)
 */
export function Plassholder({
  storrelse,
  klasse = "",
}: {
  storrelse: number;
  klasse?: string;
}) {
  return (
    <span
      aria-hidden
      className={`relative block shrink-0 overflow-hidden rounded-full bg-valgt ${klasse}`}
      style={{ width: storrelse, height: storrelse }}
    >
      <svg viewBox="0 0 32 32" className="block h-full w-full">
        <circle
          cx="16"
          cy="13"
          r="6"
          fill="color-mix(in srgb, var(--color-aksent) 30%, var(--color-valgt))"
        />
        <path
          d="M5 32c1.2-6.4 5.6-10 11-10s9.8 3.6 11 10z"
          fill="color-mix(in srgb, var(--color-aksent) 30%, var(--color-valgt))"
        />
      </svg>
    </span>
  );
}
