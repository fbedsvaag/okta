import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * En flate som glir til det som er valgt (DESIGN.md §8, lerretet
 * «Bevegelse»): valgt punkt i sidemenyen, tommelen i en bryter, markøren
 * i ⌘K og øktlista. Én flate som flytter seg, ikke en bakgrunn som hopper.
 *
 * `beholder` må ha `position: relative`. `mal` er elementet flaten skal
 * ligge under; null skjuler den. Plasseringen måles på nytt når målet
 * endres og når beholderen endrer størrelse (en undermeny som foldes ut,
 * et vindu som gjøres smalere). Glir med `--ease-sprett`; av med redusert
 * bevegelse, gjennom de vanlige reglene i index.css.
 */
export function Glideflate({
  beholder,
  mal,
  klasse = "",
  akse = "begge",
}: {
  beholder: RefObject<HTMLElement | null>;
  mal: HTMLElement | null;
  klasse?: string;
  /** «x» for brytere, «y» for lister */
  akse?: "x" | "y" | "begge";
}) {
  const [maal, setMaal] = useState<{
    x: number;
    y: number;
    b: number;
    h: number;
  } | null>(null);
  // Første plassering skal ikke gli inn fra hjørnet.
  const [klar, setKlar] = useState(false);

  useLayoutEffect(() => {
    const b = beholder.current;
    if (!b || !mal) {
      setMaal(null);
      return;
    }
    const mal_ = () => {
      const rb = b.getBoundingClientRect();
      const rm = mal.getBoundingClientRect();
      setMaal({
        x: rm.left - rb.left + b.scrollLeft,
        y: rm.top - rb.top + b.scrollTop,
        b: rm.width,
        h: rm.height,
      });
    };
    mal_();
    const ro = new ResizeObserver(mal_);
    ro.observe(b);
    ro.observe(mal);
    // Noe i beholderen foldes ut (en undermeny over det valgte): målet
    // flytter seg uten å endre størrelse. Da måles det hvert bilde til
    // overgangene er ferdige.
    let ramme = 0;
    let til = 0;
    const folg = () => {
      mal_();
      ramme = performance.now() < til ? requestAnimationFrame(folg) : 0;
    };
    const start = () => {
      til = performance.now() + 700;
      if (!ramme) ramme = requestAnimationFrame(folg);
    };
    b.addEventListener("transitionrun", start);
    return () => {
      ro.disconnect();
      b.removeEventListener("transitionrun", start);
      if (ramme) cancelAnimationFrame(ramme);
    };
  }, [beholder, mal]);

  useLayoutEffect(() => {
    if (maal && !klar) {
      const t = requestAnimationFrame(() => setKlar(true));
      return () => cancelAnimationFrame(t);
    }
  }, [maal, klar]);

  if (!maal) return null;
  return (
    <span
      aria-hidden
      className={`glideflate pointer-events-none absolute left-0 top-0 ${klasse}`}
      data-klar={klar}
      data-akse={akse}
      style={{
        width: maal.b,
        height: maal.h,
        transform: `translate(${maal.x}px, ${maal.y}px)`,
      }}
    />
  );
}
