import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { angre, angreSiste, gjorOmSiste, type Angring } from "./angre";
import { hovedtast } from "./taster";
import { tast } from "./taster";

/**
 * Bekreftelsen nederst i vinduet etter en handling som endrer mye
 * (ARBEIDSLISTE 16.3): «Periode satt på 3 økter» med «Angre ⌘Z». Står i
 * seks sekunder, eller til neste toast. Samme mørke pille som linja for
 * flervalg (ui/Flervalg.tsx), og den legger seg over den når begge vises.
 */

type Toastdata = {
  id: number;
  tekst: string;
  angring?: Angring;
  handling?: { tekst: string; onKlikk: () => void };
};

let nr = 0;
const lyttere = new Set<(t: Toastdata | null) => void>();
let flervalg = false;
const flervalgLyttere = new Set<(v: boolean) => void>();

export function visToast(
  tekst: string,
  valg: Omit<Toastdata, "id" | "tekst"> = {},
): void {
  const t = { id: ++nr, tekst, ...valg };
  lyttere.forEach((f) => f(t));
}

/** Flervalgslinja sier fra når den står, så toasten legger seg over. */
export function settFlervalgSynlig(v: boolean): void {
  flervalg = v;
  flervalgLyttere.forEach((f) => f(v));
}

/** Monteres én gang, i App. Tar også ⌘Z for hele appen. */
export function Toaster() {
  const [t, setT] = useState<Toastdata | null>(null);
  const [over, setOver] = useState(flervalg);

  useEffect(() => {
    const f = (x: Toastdata | null) => setT(x);
    lyttere.add(f);
    flervalgLyttere.add(setOver);
    return () => {
      lyttere.delete(f);
      flervalgLyttere.delete(setOver);
    };
  }, []);

  useEffect(() => {
    if (!t) return;
    const id = t.id;
    const tid = window.setTimeout(
      () => setT((x) => (x?.id === id ? null : x)),
      6000,
    );
    return () => window.clearTimeout(tid);
  }, [t]);

  // ⌘Z angrer den siste handlingen, men ikke i et tekstfelt: der angrer
  // ⌘Z skrivingen, som det skal.
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (!hovedtast(e) || e.key.toLowerCase() !== "z") return;
      const mal = e.target as HTMLElement;
      if (mal.closest?.("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      // ⇧⌘Z gjør om det som ble angret.
      if (e.shiftKey)
        void gjorOmSiste().then((tekst) => {
          if (tekst) visToast(`Gjort om: ${tekst}`);
        });
      else
        void angreSiste().then((tekst) => {
          if (tekst) visToast(`Angret: ${tekst}`);
        });
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, []);

  if (!t) return null;
  // Rett i <body>: appskallet er sin egen stabel (isolate), og arkene
  // legger seg over det. Toasten skal stå over alt.
  return createPortal(
    <div
      role="status"
      className="toast fixed left-1/2 z-[70] flex h-[42px] -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full pl-4 pr-1.5 text-[calc(13px*var(--tekst-skala))]"
      style={{ bottom: over ? 80 : 22 }}
    >
      <span>{t.tekst}</span>
      {t.handling && (
        <button
          onClick={() => {
            t.handling!.onKlikk();
            setT(null);
          }}
          className="toast-knapp"
        >
          {t.handling.tekst}
        </button>
      )}
      {t.angring && (
        <button
          onClick={() => {
            void angre(t.angring!);
            setT(null);
          }}
          className="toast-knapp"
        >
          Angre {tast("⌘")}Z
        </button>
      )}
    </div>,
    document.body,
  );
}
