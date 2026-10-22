import { useCallback, useRef } from "react";
import { skrivTidsplan, type Tidsplandag } from "../../data/tidsplan";
import type { LagrePlan } from "./Generator";

/**
 * Lagringen av en tidsplan: vises med en gang (`vis`), skrives etter
 * hverandre så raske klikk på − / + ikke krysser, og lastes inn igjen.
 */
export function useLagrePlan({
  dager,
  min,
  pause,
  vis,
  etter,
}: {
  dager: Tidsplandag[];
  min: number;
  pause: number;
  vis: (rekke: string[], harPlan: boolean) => void;
  etter: () => Promise<void>;
}): LagrePlan {
  const ko = useRef(Promise.resolve());
  const fersk = useRef({ dager, min, pause, vis, etter });
  fersk.current = { dager, min, pause, vis, etter };
  return useCallback((rekke, tema, d, m, p) => {
    const f = fersk.current;
    const dagene = d ?? f.dager;
    f.vis(rekke, dagene.length > 0);
    ko.current = ko.current.then(async () => {
      await skrivTidsplan(rekke, dagene, m ?? f.min, p ?? f.pause, tema);
      await fersk.current.etter();
    });
    return ko.current;
  }, []);
}
