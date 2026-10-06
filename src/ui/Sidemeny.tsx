import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { FagIAr } from "../data/fag";
import type { Trekning } from "../data/samtale";
import { fagfarge } from "./farger";
import { Ordmerke } from "./logo";
import { Utfold } from "./Utfold";
import { Glideflate } from "./Glideflate";

/**
 * Sidemenyen til venstre (DESIGN.md §6, variant A i lerretet).
 *
 * Bare skjermene står fast. Lister hører til en skjerm og står som en
 * innrykket undermeny under den, med en tynn strek foran: fagene under
 * Økter (⌘0–9), trekningene under Samtaler. Undermenyen er åpen under
 * skjermen du står i; under de andre rulles den ut når musa holdes over
 * punktet en liten stund, på en felles glassflate. Innstillinger nederst.
 */

export type Menypunkt =
  "idag" | "okter" | "elever" | "vurderinger" | "samtaler";

/** G og en bokstav. Ø har O som reserve, for tastatur uten ø. */
export const G_SNARVEIER: Record<string, Menypunkt> = {
  d: "idag",
  ø: "okter",
  o: "okter",
  e: "elever",
  v: "vurderinger",
  s: "samtaler",
};

const PUNKTER: { id: Menypunkt; navn: string; tast: string }[] = [
  { id: "idag", navn: "I dag", tast: "G D" },
  { id: "okter", navn: "Økter", tast: "G Ø" },
  { id: "elever", navn: "Elever", tast: "G E" },
  { id: "vurderinger", navn: "Vurderinger", tast: "G V" },
  { id: "samtaler", navn: "Samtaler", tast: "G S" },
];

/** Så lenge musa må hvile på et punkt før undermenyen rulles ut. */
const HOVER_MS = 140;

export function Sidemeny({
  skolearNavn,
  aktiv,
  fag,
  valgtFag,
  kanTilbake,
  kanFram,
  onGa,
  onVelgFag,
  trekninger,
  vurderingsnavn,
  apenTrekning,
  onApneTrekning,
  onSok,
  onInnstillinger,
  onSkolear,
  onTilbake,
  onFram,
}: {
  skolearNavn: string;
  /** hvilket punkt som er markert; null når ingen av dem er det */
  aktiv: Menypunkt | "innstillinger" | null;
  fag: FagIAr[];
  /** faget Økter står filtrert på; "" = alle fag */
  valgtFag: string;
  kanTilbake: boolean;
  kanFram: boolean;
  onGa: (p: Menypunkt) => void;
  /** et fag i undermenyen under Økter; "" = Alle fag */
  onVelgFag: (id: string) => void;
  /** de planlagte samtaletrekningene, under Samtaler */
  trekninger: Trekning[];
  /** vurderings-id → tittel; en trekning heter det vurderingen heter */
  vurderingsnavn: Map<string, string>;
  /** trekningen som er åpen: fag-id, «mentor», null = ingen valgt; undefined = ikke i Samtaler */
  apenTrekning: string | null | undefined;
  onApneTrekning: (id: string) => void;
  onSok: () => void;
  onInnstillinger: () => void;
  /** skoleåret øverst: Innstillinger › Skoleår */
  onSkolear: () => void;
  onTilbake: () => void;
  onFram: () => void;
}) {
  // Punktet musa hviler på. Settes etter en liten pause, så undermenyene
  // ikke blafrer når musa bare passerer.
  const [hover, setHover] = useState<Menypunkt | null>(null);
  const meny = useRef<HTMLUListElement>(null);
  const knapper = useRef(new Map<Menypunkt, HTMLButtonElement>());
  const [aktivKnapp, setAktivKnapp] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setAktivKnapp(
      aktiv && aktiv !== "innstillinger"
        ? (knapper.current.get(aktiv) ?? null)
        : null,
    );
  }, [aktiv]);
  const tidtaker = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (tidtaker.current) window.clearTimeout(tidtaker.current);
    },
    [],
  );

  function inn(p: Menypunkt) {
    if (tidtaker.current) window.clearTimeout(tidtaker.current);
    tidtaker.current = window.setTimeout(() => setHover(p), HOVER_MS);
  }
  function ut() {
    if (tidtaker.current) window.clearTimeout(tidtaker.current);
    tidtaker.current = null;
    setHover(null);
  }

  const undermeny: Partial<Record<Menypunkt, ReactNode>> = {
    okter: (
      <>
        <Underpunkt
          aktiv={aktiv === "okter" && valgtFag === ""}
          merke={<Firkant farge="var(--color-linje-sterk)" />}
          tast="⌘0"
          onKlikk={() => onVelgFag("")}
        >
          Alle fag
        </Underpunkt>
        {fag.map((f, i) => (
          <Underpunkt
            key={f.id}
            aktiv={aktiv === "okter" && valgtFag === f.id}
            merke={<Firkant farge={f.farge ? fagfarge(f.farge) : null} />}
            tast={i < 9 ? `⌘${i + 1}` : undefined}
            tittel={`${f.kode} — ${f.navn}`}
            onKlikk={() => onVelgFag(f.id)}
          >
            {f.kode}
          </Underpunkt>
        ))}
      </>
    ),
    samtaler: (
      <>
        {trekninger.map((t) => {
          const id = t.skolearFagId ?? "mentor";
          const f = fag.find((x) => x.id === t.skolearFagId);
          const vurdering = t.dager.find((d) => d.vurderingId)?.vurderingId;
          const navn =
            t.skolearFagId === null
              ? "Mentorsamtaler"
              : ((vurdering && vurderingsnavn.get(vurdering)) ??
                t.fagKode ??
                "");
          const meta = [
            t.skolearFagId !== null && navn !== t.fagKode ? t.fagKode : null,
            spenn(t),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <Underpunkt
              key={id}
              aktiv={apenTrekning === id}
              merke={
                t.skolearFagId === null ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-aksent" />
                ) : (
                  <Firkant farge={f?.farge ? fagfarge(f.farge) : null} />
                )
              }
              meta={meta}
              tittel={`${navn} — ${meta}`}
              onKlikk={() => onApneTrekning(id)}
            >
              {navn}
            </Underpunkt>
          );
        })}
        <Underpunkt dempet onKlikk={() => onApneTrekning("ny")}>
          + Ny trekning
        </Underpunkt>
      </>
    ),
  };

  return (
    <nav className="glass-sidepanel ikkeutskrift my-2.5 ml-2.5 flex w-56 shrink-0 flex-col rounded-glass px-2 py-3">
      <div className="flex items-center gap-2 px-2 pb-2.5">
        <Ordmerke storrelse={18} />
        <button
          onClick={onSkolear}
          title="Skoleåret — bytt eller endre i Innstillinger"
          className="ml-auto rounded-vanlig px-1 text-etikett tabular-nums text-blekk-dempet hover:text-blekk"
        >
          {skolearNavn}
        </button>
      </div>

      {/* Synlig inngang til ⌘K, så snarveien kan oppdages. */}
      <button
        onClick={onSok}
        className="mb-2.5 flex h-[30px] items-center gap-2 rounded-full border border-[var(--glass-kant)] bg-[var(--glass-valgt)]/60 px-3 text-liten text-blekk-dempet hover:text-blekk"
      >
        <IkonSok />
        Søk
        <Tast>⌘K</Tast>
      </button>

      <ul
        ref={meny}
        className="relative min-h-0 flex-1 space-y-px overflow-y-auto"
      >
        {/* Valgt punkt glir til det nye (DESIGN.md §8). */}
        <Glideflate
          beholder={meny}
          mal={aktivKnapp}
          klasse="glass-valgt rounded-[9px]"
        />
        {PUNKTER.map((p) => {
          const liste = undermeny[p.id];
          const erAktiv = aktiv === p.id;
          // Under skjermen du står i, er undermenyen alltid åpen. Under de
          // andre rulles den ut når musa hviler på punktet.
          const apen = !!liste && (erAktiv || hover === p.id);
          const svever = !!liste && !erAktiv && hover === p.id;
          return (
            <li
              key={p.id}
              onMouseEnter={liste && !erAktiv ? () => inn(p.id) : undefined}
              onMouseLeave={liste && !erAktiv ? ut : undefined}
              className={`rounded-[10px] transition-[background-color,box-shadow] duration-[var(--tid-utfold)] ${
                svever
                  ? "bg-[var(--glass-valgt)]/55 shadow-[0_1px_3px_var(--glass-skygge)]"
                  : ""
              }`}
            >
              <button
                ref={(el) => {
                  if (el) knapper.current.set(p.id, el);
                  else knapper.current.delete(p.id);
                }}
                onClick={() => onGa(p.id)}
                aria-current={erAktiv ? "page" : undefined}
                className={`relative z-[1] flex h-[30px] w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[calc(13.5px*var(--tekst-skala))] ${
                  erAktiv
                    ? "font-medium text-blekk"
                    : "text-blekk hover:bg-[var(--glass-valgt)]/70"
                }`}
              >
                {p.navn}
                <Tast>{p.tast}</Tast>
              </button>
              {liste && (
                <Utfold apen={apen} variant="rolig">
                  <ul className="space-y-px py-1">{liste}</ul>
                </Utfold>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-1 pt-2">
        <button
          onClick={onInnstillinger}
          aria-current={aktiv === "innstillinger" ? "page" : undefined}
          className={`flex h-[30px] min-w-0 flex-1 items-center rounded-[9px] px-2.5 text-left text-[calc(13.5px*var(--tekst-skala))] ${
            aktiv === "innstillinger"
              ? "glass-valgt font-medium text-blekk"
              : "text-blekk hover:bg-[var(--glass-valgt)]/70"
          }`}
        >
          Innstillinger
          <Tast>⌘,</Tast>
        </button>
        <Pil retning="tilbake" av={!kanTilbake} onKlikk={onTilbake} />
        <Pil retning="fram" av={!kanFram} onKlikk={onFram} />
      </div>
    </nav>
  );
}

/**
 * Et punkt i undermenyen: innrykket, med en tynn loddrett strek foran.
 * Valgt punkt får en lys flate og medium vekt.
 */
function Underpunkt({
  aktiv = false,
  dempet = false,
  merke,
  meta,
  tast,
  tittel,
  onKlikk,
  children,
}: {
  aktiv?: boolean;
  dempet?: boolean;
  merke?: ReactNode;
  meta?: string;
  tast?: string;
  tittel?: string;
  onKlikk: () => void;
  children: ReactNode;
}) {
  return (
    <li className="relative ml-[22px] before:absolute before:-bottom-px before:-left-[11px] before:-top-px before:w-[1.5px] before:rounded-[1px] before:bg-[color-mix(in_srgb,var(--color-blekk)_16%,transparent)]">
      <button
        onClick={onKlikk}
        title={tittel}
        aria-current={aktiv ? "true" : undefined}
        className={`flex min-h-7 w-full items-center gap-2 rounded-lg px-2.5 py-[3px] text-left text-[calc(13px*var(--tekst-skala))] ${
          aktiv
            ? "bg-[var(--glass-valgt)]/80 font-medium text-blekk"
            : dempet
              ? "text-blekk-dempet hover:bg-[var(--glass-valgt)]/60 hover:text-blekk"
              : "text-blekk hover:bg-[var(--glass-valgt)]/60"
        }`}
      >
        {merke}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{children}</span>
          {meta && (
            <span className="block truncate text-mikro font-normal tabular-nums text-blekk-dempet">
              {meta}
            </span>
          )}
        </span>
        {tast && <Tast>{tast}</Tast>}
      </button>
    </li>
  );
}

function Firkant({ farge }: { farge: string | null }) {
  return (
    <span
      aria-hidden
      className="h-2 w-2 shrink-0 rounded-[2px]"
      style={{ background: farge ?? "var(--color-linje-sterk)" }}
    />
  );
}

function Tast({ children }: { children: ReactNode }) {
  return (
    <kbd className="ml-auto shrink-0 font-sans text-[calc(10.5px*var(--tekst-skala))] font-normal tracking-[0.04em] text-blekk-dempet">
      {children}
    </kbd>
  );
}

function Pil({
  retning,
  av,
  onKlikk,
}: {
  retning: "tilbake" | "fram";
  av: boolean;
  onKlikk: () => void;
}) {
  return (
    <button
      onClick={onKlikk}
      disabled={av}
      title={retning === "tilbake" ? "Tilbake (⌘[)" : "Fram (⌘])"}
      className="grid h-[30px] w-6 shrink-0 place-items-center rounded-[9px] text-tittel leading-none text-blekk-dempet hover:bg-[var(--glass-valgt)] hover:text-blekk disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {retning === "tilbake" ? "‹" : "›"}
    </button>
  );
}

/** «24. nov» for én dag, «15. og 19. okt» for to, «2.–9. des» for flere. */
function spenn(t: Trekning): string {
  if (!t.forste) return "uten dato";
  const datoer = [
    ...new Set(t.dager.map((d) => d.dato).filter(Boolean)),
  ].sort();
  if (datoer.length === 2 && datoer[0].slice(0, 7) === datoer[1].slice(0, 7)) {
    const [a, b] = datoer.map((d) => new Date(`${d}T00:00:00`));
    const mnd = b
      .toLocaleDateString("nb-NO", { month: "short" })
      .replace(/\.$/, "");
    return `${a.getDate()}. og ${b.getDate()}. ${mnd}`;
  }
  const kort = (d: string) =>
    new Date(`${d}T00:00:00`)
      .toLocaleDateString("nb-NO", { day: "numeric", month: "short" })
      .replace(/\.$/, "");
  return t.forste === t.siste
    ? kort(t.forste)
    : `${kort(t.forste)}–${kort(t.siste)}`;
}

function IkonSok() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      className="h-3.5 w-3.5 shrink-0"
    >
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3.5 3.5" />
    </svg>
  );
}
