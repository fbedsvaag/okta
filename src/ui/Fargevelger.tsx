import { useEffect, useRef, useState } from "react";
import { FAGFARGER } from "./farger";
import { Fagfirkant } from "./felles";

/**
 * Fargen på et fag (ARBEIDSLISTE 17.3): fagfirkanten er knappen, og et
 * klikk åpner palettens fagfarger og «Egen farge». Fargen hører til faget
 * og følger med overalt: lista, kalenderen, skåringen og årsplanen.
 */
export function Fargevelger({
  farge,
  storrelse = 12,
  onVelg,
}: {
  farge: string | null;
  storrelse?: 8 | 10 | 12;
  onVelg: (farge: string) => void;
}) {
  const [apen, setApen] = useState(false);
  const boks = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!apen) return;
    const ut = (e: MouseEvent) => {
      if (!boks.current?.contains(e.target as Node)) setApen(false);
    };
    const tast = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setApen(false);
    };
    window.addEventListener("mousedown", ut);
    window.addEventListener("keydown", tast, true);
    return () => {
      window.removeEventListener("mousedown", ut);
      window.removeEventListener("keydown", tast, true);
    };
  }, [apen]);

  return (
    <span ref={boks} className="relative inline-flex self-center">
      <button
        onClick={() => setApen((a) => !a)}
        title="Bytt farge"
        aria-expanded={apen}
        className="grid place-items-center rounded-[5px] p-1 hover:bg-flate"
      >
        <Fagfirkant farge={farge} storrelse={storrelse} />
      </button>
      {apen && (
        <div className="glass-meny absolute left-0 top-[calc(100%+6px)] z-[60] w-[214px] rounded-[14px] p-3">
          <p className="menygruppe -mx-1 -mt-1 pb-2">Fagfarge</p>
          <div className="grid grid-cols-6 gap-1.5">
            {FAGFARGER.map((f) => (
              <button
                key={f}
                title={f}
                aria-label={`Farge ${f}`}
                onClick={() => {
                  onVelg(f);
                  setApen(false);
                }}
                className={`h-6 w-6 rounded-[6px] ${
                  farge === f
                    ? "ring-2 ring-aksent ring-offset-2 ring-offset-[var(--color-ark)]"
                    : "hover:scale-110"
                }`}
                style={{ background: f }}
              />
            ))}
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-linje-medium pt-2.5 text-[calc(13px*var(--tekst-skala))]">
            <input
              type="color"
              // <input type="color"> godtar bare en bokstavelig hex-verdi.
              value={farge ?? FAGFARGER[0]}
              onChange={(e) => onVelg(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border border-linje bg-ark p-0.5"
            />
            Egen farge
          </label>
        </div>
      )}
    </span>
  );
}
