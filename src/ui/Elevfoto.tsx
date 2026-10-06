import { useEffect, useState } from "react";
import { hentAlleElevbilder, hentAlleKjonn } from "../data/elevbilde";
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
let kjonnene: Map<string, "j" | "g"> = new Map();
let henter: Promise<void> | null = null;
const abonnenter = new Set<() => void>();

function hent() {
  henter ??= Promise.all([hentAlleElevbilder(), hentAlleKjonn()])
    .then(([m, k]) => {
      bilder = m;
      kjonnene = k;
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
  kjonn,
  klasse = "",
}: {
  elevId: string;
  /** til plassholderen når bildet mangler; ellers slås det opp */
  kjonn?: Kjonn;
  /** sidene i px */
  storrelse?: number;
  /** til verktøytipset og skjermlesere */
  navn?: string;
  klasse?: string;
}) {
  const alle = useElevbilder();
  const src = alle.get(elevId);
  kjonn ??= kjonnene.get(elevId) ?? null;
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
  return <Plassholder storrelse={storrelse} kjonn={kjonn} klasse={klasse} />;
}

export type Kjonn = "j" | "g" | null;

/**
 * Uten bilde: en liten illustrasjon — jente, gutt eller nøytral etter
 * `elev.kjonn` — i palettens farger (DESIGN.md §6): lys grunn, ansikt og
 * kropp i mellomtone, hår i aksenten. Den bytter farge med paletten i
 * Utseende. Ikke initialer.
 */
export function Plassholder({
  storrelse,
  kjonn = null,
  klasse = "",
}: {
  storrelse: number;
  kjonn?: Kjonn;
  klasse?: string;
}) {
  return (
    <span
      aria-hidden
      className={`relative block shrink-0 overflow-hidden rounded-full ${klasse}`}
      style={{
        width: storrelse,
        height: storrelse,
        background: "var(--pal-lys)",
      }}
    >
      <svg viewBox="0 0 28 28" className="block h-full w-full">
        {kjonn === "j" && (
          <path
            d="M7.4 15.4c0-5.6 3-9.3 6.6-9.3s6.6 3.7 6.6 9.3v5.4H7.4z"
            fill="var(--pal)"
            fillOpacity={0.7}
          />
        )}
        <path
          d="M4.8 28.5c.4-5 4.3-8.4 9.2-8.4s8.8 3.4 9.2 8.4z"
          fill="var(--pal-mid)"
        />
        <circle
          cx="14"
          cy={kjonn === "j" ? 12.8 : kjonn === "g" ? 12.6 : 12.4}
          r={kjonn === "j" ? 4.3 : kjonn === "g" ? 4.5 : 4.6}
          fill="var(--pal-mid)"
        />
        {kjonn === "j" && (
          <path
            d="M9.7 11.9c.6-3 2.3-4.6 4.3-4.6s3.7 1.6 4.3 4.6c-1.4-1.4-2.7-2-4.3-2s-2.9.6-4.3 2z"
            fill="var(--pal)"
            fillOpacity={0.7}
          />
        )}
        {kjonn === "g" && (
          <path
            d="M9.4 11.6c.2-3.4 2.1-5.3 4.6-5.3s4.4 1.9 4.6 5.3c-1.2-1.2-2.7-1.8-4.6-1.8s-3.4.6-4.6 1.8z"
            fill="var(--pal)"
            fillOpacity={0.7}
          />
        )}
      </svg>
    </span>
  );
}
