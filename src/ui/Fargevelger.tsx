import { useEffect, useRef, useState } from "react";
import { FAGFARGER, lignerTrafikklys } from "./farger";
import { Fagfirkant } from "./felles";

/**
 * Fagfargene som paletten i lerretet Fagfarger (ARBEIDSLISTE 17.3): seks
 * familier som rader, farger andre fag bruker dempet («brukt av MFL2») men
 * valgbare, valgt farge med ring, og «Egen farge» nederst. En egen farge
 * som ligner et trafikklys, avvises: den kunne vært lest som innsats.
 */
export function Fargepalett({
  farge,
  brukt,
  onVelg,
}: {
  farge: string | null;
  /** farge → koden til faget som bruker den */
  brukt?: Map<string, string>;
  onVelg: (farge: string) => void;
}) {
  const [feil, setFeil] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      {Object.entries(FAGFARGER).map(([familie, farger]) => (
        <div key={familie} className="flex items-center gap-1.5">
          <span className="w-[70px] shrink-0 text-etikett text-blekk-dempet">
            {familie}
          </span>
          {farger.map((f) => {
            const av = brukt?.get(f.toLowerCase());
            const valgt = farge?.toLowerCase() === f;
            return (
              <button
                key={f}
                onClick={() => {
                  setFeil(null);
                  onVelg(f);
                }}
                title={av ? `Brukt av ${av}` : f}
                aria-label={av ? `${f}, brukt av ${av}` : `Farge ${f}`}
                aria-pressed={valgt}
                className={`h-[22px] w-[22px] rounded-[7px] transition-transform ${
                  av && !valgt ? "opacity-30" : ""
                } ${valgt ? "" : "hover:scale-110"}`}
                style={{
                  background: f,
                  boxShadow: valgt
                    ? "0 0 0 2px var(--color-ark), 0 0 0 3.5px var(--color-blekk)"
                    : undefined,
                }}
              />
            );
          })}
        </div>
      ))}
      <label className="mt-1.5 flex cursor-pointer items-center gap-2 border-t border-linje-medium pt-2.5 text-[calc(12.5px*var(--tekst-skala))]">
        Egen farge
        <input
          type="color"
          // <input type="color"> godtar bare en bokstavelig hex-verdi.
          value={farge ?? "#4f7ac0"}
          onChange={(e) => {
            const v = e.target.value;
            if (lignerTrafikklys(v)) {
              setFeil(
                "For lik trafikklyset (grønt, gult eller rødt). Den kunne blitt lest som innsats.",
              );
              return;
            }
            setFeil(null);
            onVelg(v);
          }}
          className="h-[22px] w-8 cursor-pointer rounded border border-linje bg-ark p-0.5"
        />
        <span className="rounded-md bg-flate-svak px-2 py-0.5 font-mono text-etikett text-blekk-dempet">
          {farge ?? "—"}
        </span>
      </label>
      {feil && <p className="text-etikett text-feil">{feil}</p>}
    </div>
  );
}

/**
 * De tolv fargene i faginnstillingene (29.2, lerretet FagInnstillinger):
 * to fra hver familie i paletten. Resten ligger i Innstillinger → Fag.
 */
export const FARGEUTVALG = [
  "#9a5a2c",
  "#b5703a",
  "#c9922e",
  "#c0607a",
  "#a83f5f",
  "#3d7a5a",
  "#2f9a8a",
  "#2e6a8e",
  "#4f7ac0",
  "#7d6bb0",
  "#4a3d7d",
  "#58507a",
] as const;

/**
 * Utvalget som to rader. Har faget en farge utenfor utvalget, står den
 * først, så du ser hva det har.
 */
export function Fargeutvalg({
  farge,
  brukt,
  onVelg,
}: {
  farge: string | null;
  brukt?: Map<string, string>;
  onVelg: (farge: string) => void;
}) {
  const valgt = farge?.toLowerCase() ?? null;
  const vis =
    valgt && !FARGEUTVALG.includes(valgt as (typeof FARGEUTVALG)[number])
      ? [valgt, ...FARGEUTVALG]
      : [...FARGEUTVALG];
  return (
    <div className="grid w-fit grid-cols-6 gap-1.5">
      {vis.map((f) => {
        const av = brukt?.get(f);
        const pa = valgt === f;
        return (
          <button
            key={f}
            onClick={() => onVelg(f)}
            title={av ? `Brukt av ${av}` : f}
            aria-label={av ? `${f}, brukt av ${av}` : `Farge ${f}`}
            aria-pressed={pa}
            className={`h-[26px] w-[26px] rounded-[7px] transition-transform ${
              av && !pa ? "opacity-30" : ""
            } ${pa ? "" : "hover:scale-110"}`}
            style={{
              background: f,
              boxShadow: pa
                ? "0 0 0 2px var(--color-ark), 0 0 0 3.5px var(--color-blekk)"
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Fargen på et fag: fagfirkanten er knappen, og et klikk åpner paletten.
 * Fargen hører til faget og følger med overalt.
 */
export function Fargevelger({
  farge,
  storrelse = 12,
  brukt,
  onVelg,
  rute = false,
}: {
  farge: string | null;
  storrelse?: 8 | 10 | 12;
  brukt?: Map<string, string>;
  onVelg: (farge: string) => void;
  /** en stor rute (22 px), som i Innstillinger → Fag */
  rute?: boolean;
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
        {rute ? (
          <span
            className="block h-[22px] w-[22px] rounded-[7px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
            style={{ background: farge ?? "var(--color-linje-sterk)" }}
          />
        ) : (
          <Fagfirkant farge={farge} storrelse={storrelse} />
        )}
      </button>
      {apen && (
        <div className="glass-meny absolute left-0 top-[calc(100%+6px)] z-[60] w-[290px] rounded-[14px] p-3">
          <p className="menygruppe -mx-1 -mt-1 pb-2">
            Fagfarge{" "}
            <span className="font-normal text-blekk-svak">
              · brukt av andre er dempet
            </span>
          </p>
          <Fargepalett
            farge={farge}
            brukt={brukt}
            onVelg={(f) => {
              onVelg(f);
              setApen(false);
            }}
          />
        </div>
      )}
    </span>
  );
}

/** Fargene andre fag i året bruker: farge → kode. */
export function bruktAv(
  fag: { id: string; kode: string; farge: string | null }[],
  unntatt?: string,
): Map<string, string> {
  return new Map(
    fag
      .filter((f) => f.id !== unntatt && f.farge)
      .map((f) => [f.farge!.toLowerCase(), f.kode]),
  );
}
