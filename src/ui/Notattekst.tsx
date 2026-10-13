import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  enterIListe,
  pakkInn,
  rykk,
  tolkMarkdown,
  vekslBoks,
  type Del,
  type Punkt,
  type Redigering,
} from "./markdown";
import { hovedtast, harModifikator } from "./taster";

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
    <div className="space-y-1.5 text-brod leading-relaxed">
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
 * Tekstfeltet med listehjelp. Kontrollert: verdien eies av den som bruker
 * det. Vokser med teksten, så man ser hele notatet mens man skriver.
 */
export function MarkdownSkriv({
  verdi,
  onEndre,
  onForlat,
  plassholder,
  autoFocus,
  minRader = 3,
}: {
  verdi: string;
  onEndre: (v: string) => void;
  onForlat?: () => void;
  plassholder?: string;
  autoFocus?: boolean;
  minRader?: number;
}) {
  const felt = useRef<HTMLTextAreaElement>(null);
  const markering = useRef<[number, number] | null>(null);

  // Høyden følger teksten.
  useLayoutEffect(() => {
    const el = felt.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
    // Markøren settes etter at React har skrevet den nye teksten.
    if (markering.current) {
      el.setSelectionRange(...markering.current);
      markering.current = null;
    }
  }, [verdi]);

  function bruk(r: Redigering | null, e: React.KeyboardEvent) {
    if (!r) return;
    e.preventDefault();
    markering.current = [r.start, r.slutt];
    onEndre(r.tekst);
  }

  return (
    <textarea
      ref={felt}
      value={verdi}
      autoFocus={autoFocus}
      rows={minRader}
      placeholder={plassholder}
      onChange={(e) => onEndre(e.target.value)}
      onBlur={onForlat}
      onKeyDown={(e) => {
        const el = e.currentTarget;
        const [s, t] = [el.selectionStart, el.selectionEnd];
        if (e.key === "Enter" && !e.shiftKey && !harModifikator(e) && s === t) {
          bruk(enterIListe(verdi, s), e);
        } else if (e.key === "Tab") {
          bruk(rykk(verdi, s, t, !e.shiftKey), e);
        } else if (hovedtast(e) && e.key.toLowerCase() === "b") {
          bruk(pakkInn(verdi, s, t, "**"), e);
        } else if (hovedtast(e) && e.key.toLowerCase() === "i") {
          bruk(pakkInn(verdi, s, t, "*"), e);
        }
      }}
      className="w-full resize-none overflow-hidden rounded-vanlig border border-linje bg-ark px-2 py-1.5 text-brod leading-relaxed outline-none placeholder:text-blekk-svak focus:border-aksent"
    />
  );
}

/**
 * Formatert visning som blir til et skrivefelt ved klikk, og lagrer når
 * feltet forlates. Tomt: står som skrivefelt med plassholder med en gang.
 */
export function Markdownfelt({
  verdi,
  onLagre,
  plassholder,
  minRader,
}: {
  verdi: string | null;
  /** tom tekst lagres som null */
  onLagre: (v: string | null) => Promise<void> | void;
  plassholder?: string;
  minRader?: number;
}) {
  const [skriver, setSkriver] = useState(false);
  const [utkast, setUtkast] = useState(verdi ?? "");

  if (skriver || !verdi) {
    return (
      <MarkdownSkriv
        verdi={skriver ? utkast : (verdi ?? "")}
        autoFocus={skriver}
        minRader={minRader}
        plassholder={plassholder}
        onEndre={(v) => {
          if (!skriver) setSkriver(true);
          setUtkast(v);
        }}
        onForlat={() => {
          setSkriver(false);
          const ny = utkast.trim() || null;
          if (ny !== verdi) void onLagre(ny);
        }}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      title="Klikk for å skrive"
      onClick={() => {
        setUtkast(verdi);
        setSkriver(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setUtkast(verdi);
          setSkriver(true);
        }
      }}
      className="cursor-text rounded-vanlig border border-transparent px-2 py-1.5 hover:border-linje"
    >
      <Markdown
        tekst={verdi}
        onVekslBoks={(linje) => void onLagre(vekslBoks(verdi, linje))}
      />
    </div>
  );
}
