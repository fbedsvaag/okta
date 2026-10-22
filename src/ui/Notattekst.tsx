import { Notat } from "./Notat";
import { useEffect, useRef, type ReactNode } from "react";
import { tolkMarkdown, type Del, type Punkt } from "./markdown";

/**
 * Markdown i notater og øktlogg.
 *
 * Man skriver i et vanlig tekstfelt med hjelp: Enter fortsetter en liste,
 * Tab/Shift+Tab rykker inn og ut, ⌘B og ⌘I gir fet og kursiv. Når feltet
 * forlates, vises teksten ferdig formatert. Klikk på den for å skrive igjen.
 */

// ------------------------------------------------------------------ visning

/** Teksten ferdig formatert. Avkrysningsboksene kan klikkes. */
export function Markdown({
  tekst,
  onVekslBoks,
}: {
  tekst: string;
  /** en boks er klikket: linjenummeret i teksten */
  onVekslBoks?: (linje: number) => void;
}) {
  return (
    <div className="kan-markeres space-y-1.5 text-brod leading-relaxed">
      {tolkMarkdown(tekst).map((b, i) => {
        if (b.type === "overskrift") {
          const stor = ["text-medium", "text-brod", "text-brod"][b.niva - 1];
          return (
            <p key={i} className={`${stor} font-semibold`}>
              <Deler deler={b.deler} />
            </p>
          );
        }
        if (b.type === "liste") {
          return (
            <Liste
              key={i}
              ordnet={b.ordnet}
              start={b.start}
              punkter={b.punkter}
              onVekslBoks={onVekslBoks}
            />
          );
        }
        return (
          <p key={i}>
            {b.linjer.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Deler deler={l} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function Liste({
  ordnet,
  start,
  punkter,
  onVekslBoks,
}: {
  ordnet: boolean;
  start: number;
  punkter: Punkt[];
  onVekslBoks?: (linje: number) => void;
}) {
  // Nummereringen teller per nivå, så et innrykket punkt ikke bryter
  // tellingen i nivået over.
  const tellere: number[] = [];
  return (
    <ul className="space-y-0.5">
      {punkter.map((p) => {
        tellere.length = p.niva + 1;
        tellere[p.niva] =
          (tellere[p.niva] ?? (p.niva === 0 ? start : 1) - 1) + 1;
        const merke =
          p.avkrysset !== null ? (
            <input
              type="checkbox"
              checked={p.avkrysset}
              disabled={!onVekslBoks}
              onChange={() => onVekslBoks?.(p.linje)}
              onClick={(e) => e.stopPropagation()}
              className="mt-[0.3em] shrink-0"
            />
          ) : ordnet ? (
            <span className="w-5 shrink-0 text-right tabular-nums text-blekk-dempet">
              {tellere[p.niva]}.
            </span>
          ) : (
            <span
              aria-hidden
              className="w-3 shrink-0 text-center text-blekk-svak"
            >
              {p.niva % 2 === 0 ? "•" : "◦"}
            </span>
          );
        return (
          <li
            key={p.linje}
            className="flex items-start gap-2"
            style={{ paddingLeft: `${p.niva * 1.25}rem` }}
          >
            {merke}
            <span
              className={`min-w-0 ${p.avkrysset ? "text-blekk-svak line-through" : ""}`}
            >
              <Deler deler={p.deler} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Deler({ deler }: { deler: Del[] }): ReactNode {
  return deler.map((d, i) => {
    if (d.type === "tekst") return <span key={i}>{d.tekst}</span>;
    if (d.type === "kode")
      return (
        <code
          key={i}
          className="rounded-liten bg-flate px-1 font-mono text-liten"
        >
          {d.tekst}
        </code>
      );
    if (d.type === "fet")
      return (
        <strong key={i} className="font-semibold">
          <Deler deler={d.deler} />
        </strong>
      );
    return (
      <em key={i}>
        <Deler deler={d.deler} />
      </em>
    );
  });
}

// ---------------------------------------------------------------- skriving

/**
 * Notatfeltet (29.1): den felles editoren (ui/Notat), som skriver rett på
 * flaten og lagrer Markdown. Lagrer når feltet forlates, og litt etter at
 * du sluttet å skrive — så en avkrysning i en sjekkliste også lagres.
 */
export function Markdownfelt({
  verdi,
  onLagre,
  plassholder,
  minRader = 3,
}: {
  verdi: string | null;
  /** tom tekst lagres som null */
  onLagre: (v: string | null) => Promise<void> | void;
  plassholder?: string;
  minRader?: number;
}) {
  const lagret = useRef(verdi ?? "");
  const tid = useRef(0);
  useEffect(() => {
    lagret.current = verdi ?? "";
  }, [verdi]);
  useEffect(() => () => window.clearTimeout(tid.current), []);
  const lagre = (md: string) => {
    window.clearTimeout(tid.current);
    const ny = md.trim() || null;
    if ((ny ?? "") === (lagret.current.trim() || "")) return;
    lagret.current = ny ?? "";
    void onLagre(ny);
  };
  return (
    <Notat
      verdi={verdi ?? ""}
      plassholder={plassholder}
      minHoyde={minRader * 24}
      onEndre={(md) => {
        window.clearTimeout(tid.current);
        tid.current = window.setTimeout(() => lagre(md), 900);
      }}
      onForlat={lagre}
    />
  );
}
