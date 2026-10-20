import type { Rute } from "../data/oktrader";

/**
 * Sortering i Elever (klikk på kolonnehodet): navn, klasse, fag, innsats og
 * fravær, stigende eller synkende. Elever uten tall (ingen skåringer, ikke
 * noe fravær å regne) står alltid sist, uansett retning.
 */
export type Sortering = "navn" | "klasse" | "fag" | "innsats" | "fravaer";
export type Retning = "opp" | "ned";

/** Innsatsen de siste ti: grønn 1, gul ½, rød 0; borte og uten farge teller ikke. */
export function innsatsSnitt(ruter: Rute[]): number | null {
  const v = ruter.flatMap((r) =>
    r === "g" ? [1] : r === "y" ? [0.5] : r === "r" ? [0] : [],
  );
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function sammenlign(
  a: string | number | null,
  b: string | number | null,
  retning: Retning,
): number {
  if (a === null || a === "") return b === null || b === "" ? 0 : 1;
  if (b === null || b === "") return -1;
  const r =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "nb-NO", { numeric: true });
  return retning === "opp" ? r : -r;
}

/** Neste retning ved klikk: ny kolonne starter stigende, samme snur. */
export function nesteSortering(
  na: { kolonne: Sortering; retning: Retning },
  kolonne: Sortering,
): { kolonne: Sortering; retning: Retning } {
  if (na.kolonne !== kolonne) return { kolonne, retning: "opp" };
  return { kolonne, retning: na.retning === "opp" ? "ned" : "opp" };
}
