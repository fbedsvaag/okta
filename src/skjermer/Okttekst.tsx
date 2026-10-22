import { Notat } from "../ui/Notat";
import { useLayoutEffect, useRef, useState } from "react";
import { useLagretInnstilling } from "../ui/useLagretInnstilling";

/**
 * Agenda og kladd i økta (ARBEIDSLISTE 16.6–16.7, lerretet OktTekst).
 *
 * Agendaen er et flerlinjet felt som vokser med teksten. ↵ gir ny linje, og
 * ⌘↵ er fortsatt Ferdig (arket tar den). Avsnittene går ut i kalenderen
 * som linjeskift.
 *
 * Kladden er bare for læreren og går aldri ut av appen: ikke i kalenderen,
 * ikke på årsplanen, ikke i eksport. Høyden dras i håndtaket under
 * (60–420 px) og huskes; et dobbeltklikk tilpasser den til teksten.
 */

const LAV = 60;
const HOY = 420;

/** Flerlinjet felt som lagres når det forlates. */
export function Agendafelt({
  verdi,
  plassholder,
  onLagre,
}: {
  verdi: string | null;
  plassholder: string;
  onLagre: (v: string | null) => void;
}) {
  const felt = useRef<HTMLTextAreaElement>(null);
  const hoyde = () => {
    const el = felt.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  };
  useLayoutEffect(hoyde, [verdi]);
  return (
    <textarea
      ref={felt}
      key={verdi ?? ""}
      defaultValue={verdi ?? ""}
      rows={1}
      placeholder={plassholder}
      onInput={hoyde}
      onBlur={(e) => {
        const v = e.target.value.replace(/\s+$/, "") || null;
        if (v !== verdi) onLagre(v);
      }}
      className="block min-h-8 w-full resize-none overflow-hidden rounded-[7px] bg-ark px-2.5 py-[7px] text-[calc(13.5px*var(--tekst-skala))] leading-[1.55] shadow-[inset_0_0_0_1px_var(--color-linje)] outline-none placeholder:text-blekk-svak focus:shadow-[inset_0_0_0_1.5px_var(--color-aksent)]"
    />
  );
}

/** Kladden, med håndtak for høyden. */
export function Kladdfelt({
  verdi,
  onLagre,
  kompakt = false,
}: {
  verdi: string | null;
  onLagre: (v: string | null) => void;
  /** i skåringens høyre kolonne: litt mindre luft */
  kompakt?: boolean;
}) {
  const felt = useRef<HTMLDivElement>(null);
  const [lagret, lagreHoyde] = useLagretInnstilling<number>(
    "kladd_hoyde",
    120,
    (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= LAV && n <= HOY ? n : 120;
    },
    String,
  );
  // Høyden mens det dras; lagres når man slipper.
  const [dras, setDras] = useState<number | null>(null);
  const hoyde = dras ?? lagret;

  function dra(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = hoyde;
    let siste = h0;
    document.documentElement.dataset.drar = "";
    const flytt = (ev: PointerEvent) => {
      siste = Math.max(LAV, Math.min(HOY, Math.round(h0 + ev.clientY - y0)));
      setDras(siste);
    };
    const slipp = () => {
      window.removeEventListener("pointermove", flytt);
      window.removeEventListener("pointerup", slipp);
      delete document.documentElement.dataset.drar;
      setDras(null);
      lagreHoyde(siste);
    };
    window.addEventListener("pointermove", flytt);
    window.addEventListener("pointerup", slipp);
  }

  /** Dobbeltklikk i håndtaket: så høy som teksten, innenfor grensene. */
  function tilpass() {
    const el = felt.current;
    if (!el) return;
    const n = Math.max(LAV, Math.min(HOY, el.scrollHeight + 4));
    lagreHoyde(n);
  }

  return (
    <div className="relative">
      <div
        ref={felt}
        style={{ height: hoyde }}
        className={`kladd block w-full overflow-auto rounded-[8px] ${
          kompakt ? "px-2.5 py-2" : "px-3 py-2.5"
        } text-[calc(13.5px*var(--tekst-skala))] leading-[1.55]`}
      >
        <Notat
          verdi={verdi ?? ""}
          plassholder="Det du vil huske i økta. Bare for deg."
          minHoyde={0}
          onForlat={(t) => {
            const v = t.replace(/\s+$/, "") || null;
            if (v !== verdi) onLagre(v);
          }}
        />
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Høyden på kladden"
        title="Dra for å endre høyden, dobbeltklikk for å tilpasse"
        onPointerDown={dra}
        onDoubleClick={tilpass}
        className="group absolute inset-x-0 -bottom-1.5 flex h-3 cursor-row-resize touch-none justify-center"
      >
        <span className="mt-1 h-[3px] w-8 rounded-full bg-linje-sterk group-hover:bg-aksent" />
      </div>
    </div>
  );
}
