import { useEffect, useState, type RefObject } from "react";

/**
 * Hover som én glassflate som glir (ARBEIDSLISTE 10.3, DESIGN.md §8).
 *
 * Ikke en bakgrunn per punkt som tennes og slukkes: flaten glir fra punktet
 * musa var på til det nye, med S-kurven (`--ease-sprett`, 220 ms). Kommer
 * musa inn i lista fra utsiden, står flaten der med en gang og tones fram;
 * forlater den lista, tones den bort.
 *
 * Punktene merkes med `data-hover` (eller er `role="menuitem"`) og må
 * ligge over flaten: `relative z-[1]` eller lignende. `beholder` må ha
 * `position: relative`. Flyttes musa over noe som ikke er et punkt — en
 * skillelinje, en overskrift — blir flaten stående der den er.
 *
 * Forsvinner punktet flaten står på — en undermeny som legges sammen mens
 * musa står i ro, eller utenfor vinduet — tones flaten bort (21.10). Før
 * ble den hengende igjen som en tom boks.
 */
export function Hovermarkor({
  beholder,
  klasse = "rounded-[9px]",
}: {
  beholder: RefObject<HTMLElement | null>;
  klasse?: string;
}) {
  const [maal, setMaal] = useState<{
    x: number;
    y: number;
    b: number;
    h: number;
  } | null>(null);
  const [synlig, setSynlig] = useState(false);
  // Første plassering etter at musa kom inn, skal ikke gli fra der den
  // forlot lista sist.
  const [glir, setGlir] = useState(false);

  useEffect(() => {
    const b = beholder.current;
    if (!b) return;
    let inne = false;
    let ramme = 0;
    let sist: HTMLElement | null = null;
    let sjekkRamme = 0;
    // Står punktet fortsatt synlig der flaten er? Ellers skjules flaten.
    const sjekk = () => {
      sjekkRamme = 0;
      if (!sist) return;
      const r = sist.getBoundingClientRect();
      const midt = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      );
      const synligNa =
        sist.isConnected && r.height > 1 && !!midt && sist.contains(midt);
      if (!synligNa) {
        sist = null;
        inne = false;
        setSynlig(false);
      }
    };
    const sjekkSnart = () => {
      if (sist && !sjekkRamme) sjekkRamme = window.setTimeout(sjekk, 16);
    };
    const vakt = new MutationObserver(sjekkSnart);
    vakt.observe(b, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-apen", "hidden"],
    });
    const over = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-hover], [role='menuitem']",
      );
      if (!el || !b.contains(el)) return sjekkSnart();
      if ((el as HTMLButtonElement).disabled) return;
      sist = el;
      const rb = b.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setMaal({
        x: r.left - rb.left + b.scrollLeft,
        y: r.top - rb.top + b.scrollTop,
        b: r.width,
        h: r.height,
      });
      setSynlig(true);
      if (!inne) {
        inne = true;
        setGlir(false);
        cancelAnimationFrame(ramme);
        ramme = requestAnimationFrame(() =>
          requestAnimationFrame(() => setGlir(true)),
        );
      }
    };
    const ut = () => {
      inne = false;
      sist = null;
      setSynlig(false);
    };
    // Et ark eller en meny som legger seg over lista mens musa står i ro,
    // gir ingen pointerleave. Da skjules flaten første gang musa er over
    // noe annet.
    const annet = (e: PointerEvent) => {
      if (inne && !b.contains(e.target as Node)) ut();
    };
    b.addEventListener("pointerover", over);
    b.addEventListener("pointerleave", ut);
    b.addEventListener("transitionend", sjekkSnart);
    document.addEventListener("pointerover", annet);
    return () => {
      b.removeEventListener("pointerover", over);
      b.removeEventListener("pointerleave", ut);
      b.removeEventListener("transitionend", sjekkSnart);
      vakt.disconnect();
      window.clearTimeout(sjekkRamme);
      document.removeEventListener("pointerover", annet);
      cancelAnimationFrame(ramme);
    };
  }, [beholder]);

  if (!maal) return null;
  return (
    <span
      aria-hidden
      className={`hovermarkor pointer-events-none absolute left-0 top-0 ${klasse}`}
      data-glir={glir}
      data-synlig={synlig}
      style={{
        width: maal.b,
        height: maal.h,
        transform: `translate(${maal.x}px, ${maal.y}px)`,
      }}
    />
  );
}
