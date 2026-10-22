import type { ReactNode } from "react";

/**
 * Tomme sider (ARBEIDSLISTE 29.8, lerretet TommeSider): en rolig
 * strektegning, én setning om hva som mangler, én hovedknapp, en sekundær,
 * og et hint. Ingen utropstegn.
 */

export type Tegning =
  | "idag"
  | "nyttar"
  | "elever"
  | "vurderinger"
  | "grupper"
  | "karakterer"
  | "folgopp";

const STREK = "var(--color-linje-sterk)";
const FYLL = "var(--color-flate)";

const TEGNINGER: Record<Tegning, ReactNode> = {
  idag: (
    <>
      <rect x="10" y="12" width="100" height="62" rx="12" />
      <path d="M10 30h100" />
      <rect x="22" y="42" width="30" height="20" rx="5" fill={FYLL} />
      <rect x="62" y="42" width="36" height="8" rx="4" />
      <rect x="62" y="54" width="24" height="8" rx="4" />
    </>
  ),
  nyttar: (
    <>
      <rect x="14" y="16" width="92" height="56" rx="10" />
      <path d="M14 32h92M36 8v14M84 8v14" />
      <circle cx="44" cy="52" r="4" fill={STREK} stroke="none" />
      <circle cx="60" cy="52" r="4" strokeDasharray="2 2" />
      <circle cx="76" cy="52" r="4" strokeDasharray="2 2" />
    </>
  ),
  elever: (
    <>
      <circle cx="40" cy="34" r="12" />
      <path d="M20 70c3-12 11-18 20-18s17 6 20 18" />
      <circle cx="82" cy="38" r="9" strokeDasharray="3 3" />
      <path d="M68 70c2-9 8-13 14-13s12 4 14 13" strokeDasharray="3 3" />
    </>
  ),
  vurderinger: (
    <>
      <rect x="30" y="8" width="60" height="70" rx="10" />
      <path d="M42 26h36M42 38h36M42 50h20" />
      <circle cx="80" cy="62" r="10" fill={FYLL} />
      <path d="M76 62l3 3 5-6" />
    </>
  ),
  grupper: (
    <>
      <rect x="12" y="14" width="44" height="26" rx="7" />
      <rect x="64" y="14" width="44" height="26" rx="7" />
      <rect x="12" y="46" width="44" height="26" rx="7" strokeDasharray="3 3" />
      <rect x="64" y="46" width="44" height="26" rx="7" fill={FYLL} />
    </>
  ),
  karakterer: (
    <>
      <path d="M30 60l20-20 14 14 26-26" />
      <circle cx="90" cy="28" r="4" />
    </>
  ),
  folgopp: (
    <>
      <circle cx="60" cy="42" r="26" />
      <path d="M48 42l8 8 16-17" />
      <path d="M22 76h76" strokeDasharray="3 3" />
    </>
  ),
};

type Handling = { tekst: string; onKlikk: () => void };

export function Tomside({
  tegning,
  tittel,
  tekst,
  hoved,
  sekundar,
  hint,
}: {
  tegning: Tegning;
  tittel: string;
  tekst: ReactNode;
  hoved?: Handling;
  sekundar?: Handling;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-5 py-14 text-center">
      <svg
        aria-hidden
        width="120"
        height="84"
        viewBox="0 0 120 84"
        fill="none"
        stroke={STREK}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {TEGNINGER[tegning]}
      </svg>
      <h3 className="mt-1.5 text-[calc(20px*var(--tekst-skala))] font-light tracking-[-.01em]">
        {tittel}
      </h3>
      <p className="max-w-[380px] text-[calc(13.5px*var(--tekst-skala))] leading-normal text-blekk-dempet">
        {tekst}
      </p>
      {(hoved || sekundar) && (
        <div className="mt-1.5 flex gap-2">
          {hoved && (
            <button
              onClick={hoved.onKlikk}
              className="h-[30px] rounded-full bg-aksent px-3.5 text-[13px] font-medium text-ark hover:bg-aksent-mork"
            >
              {hoved.tekst}
            </button>
          )}
          {sekundar && (
            <button
              onClick={sekundar.onKlikk}
              className="h-[30px] rounded-full border border-linje-sterk bg-ark px-3.5 text-[13px] hover:bg-flate"
            >
              {sekundar.tekst}
            </button>
          )}
        </div>
      )}
      {hint && (
        <p className="mt-2 max-w-[380px] text-liten leading-normal text-blekk-svak">
          {hint}
        </p>
      )}
    </div>
  );
}
