import { useId } from "react";
import { NOYTRAL, skalafarge } from "./farger";

/**
 * Én skårprikk for hele appen (ARBEIDSLISTE 20.3): skåringen, heatmapet,
 * elevkortet, filteret og I dag tegner skåringer med denne, så de ser like
 * ut overalt.
 *
 * - `g` `y` `r`: trafikklyset
 * - `o`: 0, ikke i økta (mørk med kryss)
 * - `t`: ikke skåret, til stede men ikke sett (tom ring, 19.4)
 * - `n`: skåret med en verdi uten farge
 * - `k`: kommer, økta er ikke holdt ennå (svak ring)
 *
 * `farge` overstyrer trafikklysfargen for mellomtrinnene (grønngul,
 * oransje), f.eks. snittfargen til «Elever som glipper».
 *
 * Trafikklyset har form, så det kan leses uten fargesyn (20.1): grønn er
 * fylt, gul halvfylt, rød har et lite kryss. 0 har et større kryss på mørk
 * grunn.
 */
export type Skarslag = "g" | "y" | "r" | "o" | "t" | "n" | "k";

export const SKARNAVN: Record<Skarslag, string> = {
  g: "grønn",
  y: "gul",
  r: "rød",
  o: "ikke i økta",
  t: "ikke sett",
  n: "skåret",
  k: "kommer",
};

/** Slaget til en skalaverdi: `teller_ikke` er 0, ellers fargen. */
export function slagFraVerdi(
  v: { farge: string | null; teller_ikke?: number } | null,
): Skarslag {
  if (!v) return "t";
  if (v.teller_ikke === 1) return "o";
  return v.farge === "gronn"
    ? "g"
    : v.farge === "gul"
      ? "y"
      : v.farge === "rod"
        ? "r"
        : "n";
}

const FYLL: Record<Skarslag, string> = {
  g: skalafarge("gronn"),
  y: skalafarge("gul"),
  r: skalafarge("rod"),
  o: "var(--color-borte)",
  t: "transparent",
  n: NOYTRAL,
  k: "transparent",
};

export function Skarprikk({
  slag,
  storrelse = 11,
  form = "rund",
  farge,
  tittel,
  klasse = "",
}: {
  slag: Skarslag;
  /** sidene i px */
  storrelse?: number;
  form?: "rund" | "firkant";
  farge?: string;
  /** verktøytips; uten blir prikken skjult for skjermlesere */
  tittel?: string;
  klasse?: string;
}) {
  const klipp = useId();
  const fyll = farge ?? FYLL[slag];
  const r = form === "rund" ? 6 : 2.4;
  const ring =
    slag === "t"
      ? "var(--color-blekk-svak)"
      : slag === "k"
        ? "var(--color-linje)"
        : null;
  return (
    <svg
      width={storrelse}
      height={storrelse}
      viewBox="0 0 12 12"
      role={tittel ? "img" : undefined}
      aria-label={tittel}
      aria-hidden={tittel ? undefined : true}
      className={`block shrink-0 ${klasse}`}
    >
      {tittel && <title>{tittel}</title>}
      {slag === "y" ? (
        <>
          <clipPath id={klipp}>
            <rect width="12" height="12" rx={r} />
          </clipPath>
          <rect
            x="0.75"
            y="0.75"
            width="10.5"
            height="10.5"
            rx={Math.max(0, r - 0.75)}
            fill="none"
            stroke={fyll}
            strokeWidth="1.5"
          />
          <rect
            y="6"
            width="12"
            height="6"
            fill={fyll}
            clipPath={`url(#${klipp})`}
          />
        </>
      ) : ring ? (
        <rect
          x="0.75"
          y="0.75"
          width="10.5"
          height="10.5"
          rx={Math.max(0, r - 0.75)}
          fill="none"
          stroke={ring}
          strokeWidth="1.5"
        />
      ) : (
        <rect width="12" height="12" rx={r} fill={fyll} />
      )}
      {slag === "r" && (
        <path
          d="M4.9 4.9l2.2 2.2M7.1 4.9l-2.2 2.2"
          stroke="var(--color-ark)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      )}
      {slag === "o" && (
        <path
          d="M4 4l4 4M8 4l-4 4"
          stroke="var(--color-ark)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
