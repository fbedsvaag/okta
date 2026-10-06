import { useEffect, useState, type ReactNode } from "react";
import { hentInnstilling, settInnstilling } from "../data/skolear";

/**
 * Bolker som kan legges sammen med et klikk på overskriften (forsiden,
 * fagkortet, elevkortet). Valget huskes per bolk i `innstilling`, under
 * «sammenlagt:<nøkkel>», så det følger basen og gjelder til det endres.
 *
 * Svaret holdes også i minnet, så en bolk som lages på nytt — et nytt
 * elevkort, forsiden etter et besøk i Økter — ikke blinker åpen før
 * innstillingen er lest.
 */

const kjent = new Map<string, boolean>();

/** Åpen eller lagt sammen. Uten nøkkel er bolken alltid åpen. */
export function useApen(
  nokkel: string | undefined,
  /** før noe er valgt: åpen (standard) eller lagt sammen */
  standard = true,
): [boolean, (apen: boolean) => void] {
  const [apen, setApenState] = useState(() =>
    nokkel ? (kjent.get(nokkel) ?? standard) : standard,
  );

  useEffect(() => {
    if (!nokkel || kjent.has(nokkel)) return;
    void hentInnstilling(`sammenlagt:${nokkel}`).then((v) => {
      const svar = v === null ? standard : v !== "1";
      kjent.set(nokkel, svar);
      setApenState(svar);
    });
  }, [nokkel, standard]);

  function setApen(ny: boolean) {
    setApenState(ny);
    if (!nokkel) return;
    kjent.set(nokkel, ny);
    void settInnstilling(`sammenlagt:${nokkel}`, ny ? "0" : "1");
  }

  return [apen, setApen];
}

/**
 * Overskriften som knapp: en pil som peker ned når bolken er åpen, og
 * tittelen. `etter` står etter tittelen — antall, en hjelpetekst — og
 * vises også når bolken er lagt sammen, så man ser hva som ligger der.
 */
export function Sammenleggknapp({
  tittel,
  apen,
  onBytt,
  etter,
  klasse = "",
}: {
  tittel: ReactNode;
  apen: boolean;
  onBytt: () => void;
  etter?: ReactNode;
  klasse?: string;
}) {
  return (
    <button
      onClick={onBytt}
      aria-expanded={apen}
      className={`flex min-w-0 items-baseline gap-1.5 text-left text-brod font-semibold text-blekk hover:text-blekk-dempet ${klasse}`}
    >
      <span
        aria-hidden
        className={`inline-block w-2 transition-transform duration-150 ${apen ? "rotate-90" : ""}`}
      >
        ›
      </span>
      <span className="shrink-0">{tittel}</span>
      {etter && (
        <span className="truncate font-normal text-liten text-blekk-svak">
          {etter}
        </span>
      )}
    </button>
  );
}
