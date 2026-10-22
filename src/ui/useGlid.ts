import { useLayoutEffect, useRef, type RefObject } from "react";

/** Som samtaletrekkeren (DESIGN.md §8): rolig, myk ut-kurve, ingen sprett. */
const VARIGHET = 360;
const KURVE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Elementene merket `data-glid="<nøkkel>"` i `beholder` glir fra der de sto
 * til ny plass når `noekkel` endres (FLIP). Brukes når delene på I dag
 * bytter oppsett eller Uka blir kompakt (20.5).
 */
export function useGlid(
  beholder: RefObject<HTMLElement | null>,
  noekkel: unknown,
): void {
  const forrige = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const b = beholder.current;
    if (!b) return;
    const rolig = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const naa = new Map<string, DOMRect>();
    b.querySelectorAll<HTMLElement>("[data-glid]").forEach((el) => {
      const k = el.dataset.glid!;
      const r = el.getBoundingClientRect();
      naa.set(k, r);
      const f = forrige.current.get(k);
      if (!f || rolig || !el.animate) return;
      const dx = f.left - r.left;
      const dy = f.top - r.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: VARIGHET, easing: KURVE },
      );
    });
    forrige.current = naa;
  }, [noekkel]);

  // Plassene etter hver tegning, så neste glid starter fra der delene
  // faktisk står (data som lastes inn, flytter dem også).
  useLayoutEffect(() => {
    const b = beholder.current;
    if (!b) return;
    const naa = new Map<string, DOMRect>();
    b.querySelectorAll<HTMLElement>("[data-glid]").forEach((el) =>
      naa.set(el.dataset.glid!, el.getBoundingClientRect()),
    );
    forrige.current = naa;
  });
}
