import type { ReactNode } from "react";
import type { FagIAr } from "../data/fag";
import { Fagfirkant } from "./felles";
import { Ordmerke } from "./logo";

/**
 * Sidemenyen til venstre (DESIGN.md §6). Erstatter menyraden øverst.
 *
 * Øverst merket og skoleåret, så søket, så skjermene med G-snarveiene
 * sine, så fagene i år. Innstillinger nederst. Hovedflaten ligger som et
 * hvitt ark ved siden av.
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

const PUNKTER: {
  id: Menypunkt;
  navn: string;
  tast: string;
  ikon: ReactNode;
}[] = [
  { id: "idag", navn: "I dag", tast: "G D", ikon: <IkonIDag /> },
  { id: "okter", navn: "Økter", tast: "G Ø", ikon: <IkonOkter /> },
  { id: "elever", navn: "Elever", tast: "G E", ikon: <IkonElever /> },
  {
    id: "vurderinger",
    navn: "Vurderinger",
    tast: "G V",
    ikon: <IkonVurderinger />,
  },
  { id: "samtaler", navn: "Samtaler", tast: "G S", ikon: <IkonSamtaler /> },
];

export function Sidemeny({
  skolearNavn,
  aktiv,
  fag,
  apentFagId,
  kanTilbake,
  kanFram,
  onGa,
  onSok,
  onApneFag,
  onAlleFag,
  onInnstillinger,
  onTilbake,
  onFram,
}: {
  skolearNavn: string;
  /** hvilket punkt som er markert; null når ingen av dem er det */
  aktiv: Menypunkt | "fag" | "innstillinger" | null;
  fag: FagIAr[];
  apentFagId: string | null;
  kanTilbake: boolean;
  kanFram: boolean;
  onGa: (p: Menypunkt) => void;
  onSok: () => void;
  onApneFag: (id: string) => void;
  onAlleFag: () => void;
  onInnstillinger: () => void;
  onTilbake: () => void;
  onFram: () => void;
}) {
  return (
    <nav className="glass-sidepanel ikkeutskrift my-2.5 ml-2.5 flex w-56 shrink-0 flex-col gap-3 rounded-glass px-2.5 py-3">
      <div className="flex items-center justify-between px-1.5">
        <Ordmerke storrelse={20} />
        <button
          onClick={onInnstillinger}
          title="Skoleåret — bytt eller endre i Innstillinger"
          className="rounded-vanlig px-1 text-liten tabular-nums text-blekk-dempet hover:text-blekk"
        >
          {skolearNavn}
        </button>
      </div>

      {/* Synlig inngang til ⌘K, så snarveien kan oppdages. */}
      <button
        onClick={onSok}
        className="flex h-8 items-center gap-2 rounded-[10px] border border-[var(--glass-kant)] bg-[var(--glass-valgt)] px-2.5 text-liten text-blekk-dempet hover:text-blekk"
      >
        <IkonSok />
        Søk
        <kbd className="ml-auto font-sans text-mikro text-blekk-svakest">
          ⌘K
        </kbd>
      </button>

      <ul className="space-y-px">
        {PUNKTER.map((p) => (
          <li key={p.id}>
            <Rad
              aktiv={aktiv === p.id}
              onKlikk={() => onGa(p.id)}
              ikon={p.ikon}
              tast={p.tast}
            >
              {p.navn}
            </Rad>
          </li>
        ))}
      </ul>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="mb-1 px-2 text-etikett uppercase tracking-etikett text-blekk-dempet">
          Fag i år
        </p>
        <ul className="space-y-px">
          {fag.map((f) => (
            <li key={f.id}>
              <Rad
                aktiv={aktiv === "fag" && apentFagId === f.id}
                onKlikk={() => onApneFag(f.id)}
                ikon={<Fagfirkant farge={f.farge} />}
                tittel={`${f.kode} — ${f.navn}`}
              >
                <span className="font-medium">{f.kode}</span>
                <span className="ml-2 truncate text-blekk-dempet">
                  {f.navn}
                </span>
              </Rad>
            </li>
          ))}
          <li>
            <Rad
              aktiv={aktiv === "fag" && apentFagId === null}
              onKlikk={onAlleFag}
              ikon={<span className="text-blekk-svak">+</span>}
            >
              <span className="text-blekk-dempet">
                {fag.length === 0 ? "Legg til fag" : "Alle fag"}
              </span>
            </Rad>
          </li>
        </ul>
      </div>

      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Rad
            aktiv={aktiv === "innstillinger"}
            onKlikk={onInnstillinger}
            ikon={<IkonInnstillinger />}
            tast="⌘,"
          >
            Innstillinger
          </Rad>
        </div>
        <Pil retning="tilbake" av={!kanTilbake} onKlikk={onTilbake} />
        <Pil retning="fram" av={!kanFram} onKlikk={onFram} />
      </div>
    </nav>
  );
}

function Rad({
  aktiv,
  onKlikk,
  ikon,
  tast,
  tittel,
  children,
}: {
  aktiv: boolean;
  onKlikk: () => void;
  ikon: ReactNode;
  tast?: string;
  tittel?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onKlikk}
      title={tittel}
      aria-current={aktiv ? "page" : undefined}
      className={`flex h-8 w-full min-w-0 items-center gap-2.5 rounded-[10px] px-2 text-left text-brod ${
        aktiv
          ? "glass-valgt font-medium text-blekk"
          : "text-blekk hover:bg-[var(--glass-valgt)]"
      }`}
    >
      <span className="grid w-4 shrink-0 place-items-center text-blekk-dempet">
        {ikon}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline">{children}</span>
      {tast && (
        <kbd className="shrink-0 font-sans text-mikro tracking-etikett text-blekk-svak">
          {tast}
        </kbd>
      )}
    </button>
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
      className="grid h-8 w-6 shrink-0 place-items-center rounded-[10px] text-tittel leading-none text-blekk-dempet hover:bg-[var(--glass-valgt)] hover:text-blekk disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {retning === "tilbake" ? "‹" : "›"}
    </button>
  );
}

// ------------------------------------------------------------------ ikoner
// Tegnet som strek i currentColor, som `Ikon` i felles.tsx. Ikke emoji.

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      {children}
    </svg>
  );
}

function IkonIDag() {
  return (
    <Svg>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </Svg>
  );
}

function IkonOkter() {
  return (
    <Svg>
      <path d="M3 4.5h10M3 8h10M3 11.5h10" />
    </Svg>
  );
}

function IkonElever() {
  return (
    <Svg>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.6-2.4 2.6-3.8 5-3.8s4.4 1.4 5 3.8" />
    </Svg>
  );
}

function IkonVurderinger() {
  return (
    <Svg>
      <path d="M4 2.5h5.5L12 5v8.5H4z" />
      <path d="M6 9l1.5 1.5L10.5 7.5" />
    </Svg>
  );
}

function IkonSamtaler() {
  return (
    <Svg>
      <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
    </Svg>
  );
}

function IkonInnstillinger() {
  return (
    <Svg>
      <path d="M3 4.5h4M10 4.5h3M3 11.5h2M8 11.5h5" />
      <circle cx="8.5" cy="4.5" r="1.5" />
      <circle cx="6.5" cy="11.5" r="1.5" />
    </Svg>
  );
}

function IkonSok() {
  return (
    <Svg>
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3.5 3.5" />
    </Svg>
  );
}
