import type { ReactNode } from "react";

/**
 * Byggeklossene i innstillingene (ARBEIDSLISTE 23.2, lerretet Innstillinger2):
 * en side med overskrift og ingress, grupper som kort, og rader med tittel
 * og hjelp til venstre og kontrollen til høyre.
 */

export function Side({
  tittel,
  intro,
  children,
}: {
  tittel: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="inn-side">
      <h1 className="text-[calc(28px*var(--tekst-skala))] font-light tracking-overskrift">
        {tittel}
      </h1>
      {intro && (
        <p className="mb-[18px] mt-1 text-liten leading-normal text-blekk-dempet">
          {intro}
        </p>
      )}
      {children}
    </div>
  );
}

/** Et kort med rader. `tittel` står over kortet, `fot` under. */
export function Gruppe({
  tittel,
  fot,
  children,
}: {
  tittel?: string;
  fot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {tittel && (
        <h2 className="mx-1 mb-[7px] mt-5 text-etikett font-semibold text-blekk-dempet">
          {tittel}
        </h2>
      )}
      <div className="inn-grp">{children}</div>
      {fot && (
        <p className="mx-1 mt-[7px] text-etikett leading-normal text-blekk-svak">
          {fot}
        </p>
      )}
    </>
  );
}

/**
 * Én rad: tittel og hjelp til venstre, kontroll til høyre. `k` er nøkkelen
 * søket hopper til (sok.ts). `under` står over hele bredden under raden.
 */
export function Rad({
  k,
  tittel,
  hjelp,
  children,
  under,
}: {
  k?: string;
  tittel: ReactNode;
  hjelp?: ReactNode;
  children?: ReactNode;
  under?: ReactNode;
}) {
  return (
    <div className="inn-rad" data-k={k}>
      <div className="min-w-[220px] flex-1">
        <div className="text-[calc(13.5px*var(--tekst-skala))]">{tittel}</div>
        {hjelp && (
          <div className="mt-[3px] max-w-[440px] text-etikett leading-normal text-blekk-svak">
            {hjelp}
          </div>
        )}
      </div>
      {children && (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {children}
        </div>
      )}
      {under && <div className="w-full">{under}</div>}
    </div>
  );
}

/** Av/på (23.2). */
export function Vippebryter({
  pa,
  onBytt,
  etikett,
  av = false,
}: {
  pa: boolean;
  onBytt: (pa: boolean) => void;
  etikett: string;
  av?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={pa}
      aria-label={etikett}
      disabled={av}
      onClick={() => onBytt(!pa)}
      className="vippebryter"
    >
      <span />
    </button>
  );
}

/** Et tekstfelt i en rad: lav og grå, hvitt når det har fokus. */
export function Feltinput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { bredde?: string },
) {
  const { bredde = "w-60", className = "", ...rest } = props;
  return <input {...rest} className={`inn-felt ${bredde} ${className}`} />;
}

/** En sti eller adresse, i fast bredde. */
export function Sti({ children }: { children: ReactNode }) {
  return (
    <code className="max-w-[320px] truncate rounded-md bg-flate-svak px-[7px] py-[3px] font-mono text-etikett text-blekk-dempet">
      {children}
    </code>
  );
}

/** Ikonene i undermenyen, fra lerretet. */
export function Menyikon({ navn }: { navn: string }) {
  const p = {
    width: 15,
    height: 15,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (navn) {
    case "deg":
      return (
        <svg {...p}>
          <circle cx="8" cy="5.5" r="2.6" />
          <path d="M3 13.5c.8-2.6 2.8-3.8 5-3.8s4.2 1.2 5 3.8" />
        </svg>
      );
    case "generelt":
      return (
        <svg {...p}>
          <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
          <circle cx="5.5" cy="4.5" r="1.3" fill="var(--inn-ikonbunn)" />
          <circle cx="10.5" cy="8" r="1.3" fill="var(--inn-ikonbunn)" />
          <circle cx="7" cy="11.5" r="1.3" fill="var(--inn-ikonbunn)" />
        </svg>
      );
    case "skolear":
      return (
        <svg {...p}>
          <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
          <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
        </svg>
      );
    case "fag":
      return (
        <svg {...p}>
          <path d="M3 3.5h4.2a1.8 1.8 0 011.8 1.8v8a1.5 1.5 0 00-1.5-1.5H3zM13 3.5H9.8A1.8 1.8 0 008 5.3" />
          <path d="M13 3.5v8.8H9.5" />
        </svg>
      );
    case "skalaer":
      return (
        <svg {...p}>
          <circle cx="4" cy="8" r="1.8" />
          <circle cx="8" cy="8" r="1.8" />
          <circle cx="12" cy="8" r="1.8" />
        </svg>
      );
    case "utseende":
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M8 2.5v11" />
          <path d="M8 2.5a5.5 5.5 0 010 11z" fill="currentColor" />
        </svg>
      );
    case "kopi":
      return (
        <svg {...p}>
          <path d="M8 2.5c2 1.4 3.8 1.8 5.5 1.8 0 5-2.2 8-5.5 9.2C4.7 12.3 2.5 9.3 2.5 4.3 4.2 4.3 6 3.9 8 2.5z" />
        </svg>
      );
    case "personvern":
      return (
        <svg {...p}>
          <rect x="3.5" y="7" width="9" height="6.5" rx="1.6" />
          <path d="M5.5 7V5.2a2.5 2.5 0 015 0V7" />
        </svg>
      );
    case "kalender":
      return (
        <svg {...p}>
          <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
          <path d="M2.5 6.5h11" />
          <circle cx="8" cy="10" r="1.2" fill="currentColor" />
        </svg>
      );
    case "del":
      return (
        <svg {...p}>
          <circle cx="4.5" cy="8" r="1.8" />
          <circle cx="11.5" cy="4.2" r="1.8" />
          <circle cx="11.5" cy="11.8" r="1.8" />
          <path d="M6.1 7.1l3.8-2M6.1 8.9l3.8 2" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M8 7.2v3.6" />
          <circle cx="8" cy="5.2" r=".5" fill="currentColor" />
        </svg>
      );
  }
}

/** Grønn hake foran en setning (Personvern, status for kopiene). */
export function Hake() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden
      className="mt-0.5 shrink-0"
    >
      <circle cx="7" cy="7" r="7" fill="var(--color-god)" />
      <path
        d="M4 7.2l2 2 4-4.4"
        stroke="#fff"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
