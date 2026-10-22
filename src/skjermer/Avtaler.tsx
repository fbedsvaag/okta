import { useEffect, useState } from "react";
import type { Kart, Kartelev } from "../data/klassekart";
import {
  brukAvtaler,
  gjelderFor,
  hentAvtaler,
  hentOnsker,
  type Avtale,
  type Onske,
} from "../data/onsker";
import { lyttElever, lyttKlassekart } from "../data/endringer";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";

/** «Ta hensyn når jeg stokker» (26.7): ønskene som myk regel. Én for alle. */
export const ONSKER_VED_STOKK = "onsker_ved_stokk";

/**
 * Avtalene og ønskene for et kart når det stokkes (26.7, 26.13). Avtaler
 * finnes bare for fag. «Hopp over én gang» gjelder til neste lagring.
 */
export function useAvtaler(kart: Kart | null, hva: "klassekart" | "grupper") {
  const [avtaler, setAvtaler] = useState<Avtale[]>([]);
  const [onsker, setOnsker] = useState<Onske[]>([]);
  const [hopp, setHopp] = useState(false);
  const [medOnsker] = useLagretInnstilling(
    ONSKER_VED_STOKK,
    false,
    (v) => v === "pa",
    (v) => (v ? "pa" : "av"),
  );
  useEffect(() => {
    if (!kart) return;
    const last = () => {
      void (
        kart.kildeType === "fag"
          ? hentAvtaler(kart.kildeId)
          : Promise.resolve([])
      ).then((a) => setAvtaler(a.filter((x) => gjelderFor(x, hva))));
      void hentOnsker().then(setOnsker);
    };
    last();
    const a = lyttKlassekart(last);
    const b = lyttElever(last);
    return () => {
      a();
      b();
    };
  }, [kart?.id, hva]);

  /** Til fordelingen: avtalene som hard regel, ønskene som myk. */
  function regler(elever: Kartelev[]): {
    maa: [string, string][];
    sammen: Map<string, Set<string>>;
  } {
    const her = new Set(elever.map((e) => e.id));
    const maa = hopp
      ? []
      : avtaler
          .filter((a) => her.has(a.elevId) && her.has(a.medElevId))
          .map((a) => [a.elevId, a.medElevId] as [string, string]);
    const sammen = new Map<string, Set<string>>();
    if (medOnsker)
      for (const o of onsker)
        if (her.has(o.elevId) && her.has(o.onskerElevId))
          sammen.set(
            o.elevId,
            (sammen.get(o.elevId) ?? new Set()).add(o.onskerElevId),
          );
    return { maa, sammen };
  }

  /** Når kartet eller settet lagres: avtalene som ble oppfylt, er brukt. */
  async function lagret(sammen: (a: string, b: string) => boolean) {
    setHopp(false);
    if (avtaler.length > 0) await brukAvtaler(avtaler, sammen);
  }

  /** Avtalene som ikke kan holdes nå (en av dem er ikke med). */
  const ikkeMed = (elever: Kartelev[]) => {
    const her = new Set(elever.map((e) => e.id));
    return avtaler.filter((a) => !her.has(a.elevId) || !her.has(a.medElevId));
  };

  return { avtaler, hopp, setHopp, regler, lagret, ikkeMed };
}

/** «📌 2 avtaler for neste gang» over Stokk, med «hopp over én gang». */
export function Avtalelinje({
  antall,
  ikkeMed,
  hopp,
  onHopp,
  navnPa,
}: {
  antall: number;
  /** avtaler som ikke kan holdes nå, som «a|b» */
  ikkeMed: [string, string][];
  hopp: boolean;
  onHopp: (h: boolean) => void;
  navnPa: (id: string) => string;
}) {
  if (antall === 0) return null;
  return (
    <div className="flex flex-col gap-1 text-[calc(12.5px*var(--tekst-skala))]">
      <span className="flex flex-wrap items-center gap-2">
        <span className={hopp ? "text-blekk-svak line-through" : ""}>
          📌 {antall} {antall === 1 ? "avtale" : "avtaler"} for neste gang
        </span>
        <button
          onClick={() => onHopp(!hopp)}
          className="text-blekk-dempet underline-offset-2 hover:text-blekk hover:underline"
        >
          {hopp ? "Bruk likevel" : "hopp over én gang"}
        </button>
      </span>
      {!hopp &&
        ikkeMed.map(([a, b]) => (
          <span key={`${a}|${b}`} className="text-varsel">
            {navnPa(a)} og {navnPa(b)}: går ikke nå, en av dem er ikke med.
            Avtalen blir stående.
          </span>
        ))}
    </div>
  );
}
