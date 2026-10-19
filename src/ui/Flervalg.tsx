import { useEffect, type ReactNode } from "react";
import { settFlervalgSynlig } from "./Toast";

/**
 * Flervalg i lister (ARBEIDSLISTE 16.3, lerretet OktListeMasse), og igjen i
 * Elever (17.4): avkrysning per rad, ⇧-klikk for et spenn, ⌘A for alle, esc
 * fjerner valget, og en mørk linje nederst med det man kan gjøre med det
 * som er valgt.
 */

/** Avkrysningen i en rad, eller i overskriften (`delvis`: noen valgt). */
export function Avkrysning({
  pa,
  delvis = false,
  etikett,
  onKlikk,
}: {
  pa: boolean;
  delvis?: boolean;
  etikett: string;
  /** ⇧ holdt inne: et spenn */
  onKlikk: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      role="checkbox"
      aria-checked={delvis ? "mixed" : pa}
      aria-label={etikett}
      onClick={(e) => {
        e.stopPropagation();
        onKlikk(e);
      }}
      onMouseDown={(e) => e.shiftKey && e.preventDefault()}
      className={`avkrysning ${pa || delvis ? "pa" : ""}`}
    >
      {pa ? (
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
          <path
            d="M1.8 5.2l2.2 2.2L8.4 2.8"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : delvis ? (
        <span className="h-[2px] w-[7px] rounded-full bg-current" />
      ) : null}
    </button>
  );
}

/**
 * Den mørke linja nederst når noe er valgt: «3 økter valgt», handlingene,
 * og ✕ som fjerner valget. Esc gjør det samme.
 */
export function Flervalgslinje({
  antall,
  hva,
  children,
  onTom,
}: {
  antall: number;
  /** «økt» / «økter», «elev» / «elever» */
  hva: [string, string];
  children: ReactNode;
  onTom: () => void;
}) {
  const synlig = antall > 0;
  useEffect(() => {
    settFlervalgSynlig(synlig);
    return () => settFlervalgSynlig(false);
  }, [synlig]);

  useEffect(() => {
    if (!synlig) return;
    const tast = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const mal = e.target as HTMLElement;
      if (
        mal.closest?.(
          "input, textarea, [contenteditable], [role='combobox'][aria-expanded='true']",
        )
      )
        return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onTom();
    };
    // Fanges før arket under, som ellers ville lukket seg på esc.
    window.addEventListener("keydown", tast, true);
    return () => window.removeEventListener("keydown", tast, true);
  }, [synlig, onTom]);

  if (!synlig) return null;
  return (
    <div
      role="toolbar"
      aria-label="Det som er valgt"
      className="flervalgslinje fixed bottom-[22px] left-1/2 z-[60] flex h-[46px] -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full pl-4 pr-2 text-[calc(13px*var(--tekst-skala))]"
    >
      <span className="mr-1.5 font-medium tabular-nums">
        {antall} {antall === 1 ? hva[0] : hva[1]} valgt
      </span>
      {children}
      <span className="mx-1 h-5 w-px bg-white/20" />
      <button
        onClick={onTom}
        title="Fjern valget (esc)"
        className="linjeknapp px-2.5"
      >
        ✕
      </button>
    </div>
  );
}

/** En knapp i linja, med tasten til høyre. */
export function Linjeknapp({
  children,
  tast,
  fare,
  apen,
  onKlikk,
  tittel,
}: {
  children: ReactNode;
  tast?: string;
  fare?: boolean;
  apen?: boolean;
  onKlikk: () => void;
  tittel?: string;
}) {
  return (
    <button
      onClick={onKlikk}
      title={tittel}
      className={`linjeknapp ${fare ? "fare" : ""} ${apen ? "apen" : ""}`}
    >
      {children}
      {tast && <span className="linjetast">{tast}</span>}
    </button>
  );
}

/**
 * Klikk i avkrysningen: ⇧ legger til alt mellom forrige klikk og denne,
 * ellers av og på. Rene tall, så regelen kan testes.
 */
export function nyttValg(
  valgt: ReadonlySet<string>,
  rekkefolge: string[],
  id: string,
  sist: string | null,
  spenn: boolean,
): Set<string> {
  const ny = new Set(valgt);
  if (spenn && sist) {
    const a = rekkefolge.indexOf(sist);
    const b = rekkefolge.indexOf(id);
    if (a >= 0 && b >= 0) {
      const [l, h] = a < b ? [a, b] : [b, a];
      for (const x of rekkefolge.slice(l, h + 1)) ny.add(x);
      return ny;
    }
  }
  if (ny.has(id)) ny.delete(id);
  else ny.add(id);
  return ny;
}
