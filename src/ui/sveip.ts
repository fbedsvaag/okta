import { useEffect, useRef, useState } from "react";

/**
 * Sveip med to fingre på styreflata: til høyre = tilbake, til venstre =
 * fram, som i Safari. Styreflata sender sveipet som vannrette
 * rullehendelser (`wheel` med deltaX). De telles opp til en terskel, og
 * gesten må slippe (en kort pause) før neste kan utløses — ellers ville
 * etterslengen fra styreflata blitt to-tre steg.
 *
 * Over noe som selv ruller sidelengs (uka, tabeller, rommet i klassekartet)
 * ruller sveipet som før. Over et ark (økta, elevkortet …) lukker sveip til
 * høyre arket, som Esc.
 *
 * Det skal ikke være lett å ta seg selv ut av det man holder på med (test
 * 4.11: en kollega ble tatt ut av klassekartet igjen og igjen). Derfor et
 * langt sveip, ingenting mens noe dras, og av der `av` er satt (Plasser og
 * grupper). ‹ › og ⌘[ ⌘] virker fortsatt.
 *
 * Gir fremdriften tilbake (−1 til 1), så sveipet kan vises mens det pågår.
 */
const TERSKEL = 340;
const PAUSE_MS = 220;

export function useSveip(
  onTilbake: () => void,
  onFram: () => void,
  kanTilbake: boolean,
  kanFram: boolean,
  /** sveip er av på denne skjermen */
  av = false,
): number {
  const [fremdrift, setFremdrift] = useState(0);
  const sum = useRef(0);
  const last = useRef(false);
  const tidtaker = useRef<number | null>(null);
  const ref = useRef({ onTilbake, onFram, kanTilbake, kanFram, av });
  ref.current = { onTilbake, onFram, kanTilbake, kanFram, av };

  useEffect(() => {
    const slipp = () => {
      sum.current = 0;
      last.current = false;
      setFremdrift(0);
    };
    const hjul = (e: WheelEvent) => {
      if (tidtaker.current) window.clearTimeout(tidtaker.current);
      tidtaker.current = window.setTimeout(slipp, PAUSE_MS);
      if (last.current || e.ctrlKey) return;
      // Av på skjermen, eller mens noe dras: ingenting.
      if (ref.current.av || "drar" in document.documentElement.dataset) {
        if (sum.current !== 0) {
          sum.current = 0;
          setFremdrift(0);
        }
        return;
      }
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.5) return;
      if (rullerSidelengs(e.target as Element | null, e.deltaX)) return;

      sum.current -= e.deltaX;
      const p = Math.max(-1, Math.min(1, sum.current / TERSKEL));
      const { onTilbake, onFram, kanTilbake, kanFram } = ref.current;
      const overArk = !!(e.target as Element | null)?.closest?.(".ark");
      if (p > 0 && !kanTilbake && !overArk) return;
      if (p < 0 && (!kanFram || overArk)) return;
      setFremdrift(p);
      if (Math.abs(p) < 1) return;

      last.current = true;
      setFremdrift(0);
      if (p > 0) {
        if (overArk)
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        else onTilbake();
      } else onFram();
    };
    window.addEventListener("wheel", hjul, { passive: true });
    return () => window.removeEventListener("wheel", hjul);
  }, []);

  return fremdrift;
}

/** Om noe under musa kan rulle sidelengs i den retningen sveipet går. */
function rullerSidelengs(el: Element | null, dx: number): boolean {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    if (e.scrollWidth <= e.clientWidth + 1) continue;
    const o = getComputedStyle(e).overflowX;
    if (o !== "auto" && o !== "scroll") continue;
    if (dx < 0 && e.scrollLeft > 0) return true;
    if (dx > 0 && e.scrollLeft + e.clientWidth < e.scrollWidth - 1) return true;
  }
  return false;
}
