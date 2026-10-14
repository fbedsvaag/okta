import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Tekst der tegnene som endres, ruller som et telleverk (samtaletimeplanen:
 * klokkeslettet på raden som dras). Bare tegnene som faktisk er nye, ruller;
 * «08:55» → «09:20» ruller fire sifre, men kolonet står.
 *
 * Retningen følger verdien: større verdi ruller opp, mindre ned. Varigheten
 * er appens egen (--tid-inn), og med bevegelse av hopper tegnene rett til
 * den nye verdien. Ingenting venter på transitionend, som aldri kommer når
 * overganger er slått av.
 */
export function Ticker({ tekst }: { tekst: string }) {
  const forrige = useRef(tekst);
  const opp = tekst >= forrige.current;
  useEffect(() => {
    forrige.current = tekst;
  }, [tekst]);
  return (
    <span className="inline-flex tabular-nums" aria-live="off">
      {[...tekst].map((c, i) => (
        <Tegn key={i} c={c} opp={opp} />
      ))}
    </span>
  );
}

type Fase = "hvile" | "start" | "rull";

function Tegn({ c, opp }: { c: string; opp: boolean }) {
  const [s, setS] = useState<{
    gammel: string;
    ny: string;
    opp: boolean;
    fase: Fase;
  }>({ gammel: c, ny: c, opp, fase: "hvile" });

  // Ny verdi: legg den gamle og den nye i en kolonne, i startposisjon.
  useLayoutEffect(() => {
    setS((f) => (f.ny === c ? f : { gammel: f.ny, ny: c, opp, fase: "start" }));
  }, [c, opp]);

  // Neste bilde: rull. Litt etter: bare den nye står igjen.
  useEffect(() => {
    if (s.fase === "start") {
      const r = requestAnimationFrame(() =>
        setS((f) => ({ ...f, fase: "rull" })),
      );
      return () => cancelAnimationFrame(r);
    }
    if (s.fase === "rull") {
      const t = window.setTimeout(
        () => setS((f) => ({ ...f, fase: "hvile" })),
        260,
      );
      return () => window.clearTimeout(t);
    }
  }, [s.fase]);

  if (s.fase === "hvile") return <span>{s.ny}</span>;

  // Opp: gammel over ny, kolonnen glir fra 0 til -50 %. Ned: ny over
  // gammel, fra -50 % til 0.
  const kolonne = s.opp ? [s.gammel, s.ny] : [s.ny, s.gammel];
  const fra = s.opp ? "0%" : "-50%";
  const til = s.opp ? "-50%" : "0%";
  return (
    <span className="relative inline-block h-[1lh] overflow-hidden align-top">
      {/* Bredden holdes av den nye verdien, usynlig. */}
      <span className="invisible">{s.ny}</span>
      <span
        className="absolute inset-x-0 top-0 flex flex-col"
        style={{
          transform: `translateY(${s.fase === "start" ? fra : til})`,
          transition:
            s.fase === "rull"
              ? "transform var(--tid-inn) var(--ease-inn)"
              : "none",
        }}
      >
        {kolonne.map((x, i) => (
          <span key={i} className="h-[1lh]">
            {x}
          </span>
        ))}
      </span>
    </span>
  );
}
