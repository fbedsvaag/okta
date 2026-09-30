import type { Okt } from "./okter";

/**
 * Setningen øverst på forsiden: hva dagen har av økter, og hva du skrev
 * forrige gang i hvert fag.
 *
 * Skriver du «husk å dele ut oppgavearket» i øktloggen på torsdag, står det
 * her neste torsdag — den dagen du faktisk trenger det.
 */

type Oktlik = Pick<
  Okt,
  "id" | "skolearFagId" | "dato" | "klokkeslett" | "fagKode" | "logg"
>;

/** Økta rett før i samme fag. Ikke den siste med notat — den rett før. */
export function forrigeOkt<T extends Oktlik>(okt: Oktlik, alle: T[]): T | null {
  const nokkel = (o: Oktlik) => `${o.dato} ${o.klokkeslett ?? ""}`;
  return (
    alle
      .filter(
        (o) =>
          o.skolearFagId === okt.skolearFagId &&
          o.id !== okt.id &&
          nokkel(o) < nokkel(okt),
      )
      .sort((a, b) => nokkel(b).localeCompare(nokkel(a)))[0] ?? null
  );
}

const TALLORD = ["Ingen", "Én", "To", "Tre", "Fire", "Fem", "Seks"];

export type Dagslinje = {
  /** økta i dag linja gjelder */
  okt: Oktlik;
  /** forrige økt i faget; null når dette er første gang */
  forrige: Oktlik | null;
  /** notatet fra forrige gang, eller null når det ikke ble skrevet noe */
  notat: string | null;
};

export type Dagen = {
  /** «Én økt i dag: MFL1 kl. 09:15.» */
  setning: string;
  linjer: Dagslinje[];
};

export function dagen<T extends Oktlik>(alle: T[], idag: string): Dagen {
  const dagens = alle
    .filter((o) => o.dato === idag)
    .sort((a, b) => (a.klokkeslett ?? "").localeCompare(b.klokkeslett ?? ""));

  if (dagens.length === 0) return { setning: "Ingen økter i dag.", linjer: [] };

  const antall = TALLORD[dagens.length] ?? String(dagens.length);
  const hvilke = dagens.map(
    (o) => `${o.fagKode}${o.klokkeslett ? ` kl. ${o.klokkeslett}` : ""}`,
  );
  const liste =
    hvilke.length === 1
      ? hvilke[0]
      : `${hvilke.slice(0, -1).join(", ")} og ${hvilke[hvilke.length - 1]}`;

  return {
    setning: `${antall} ${dagens.length === 1 ? "økt" : "økter"} i dag: ${liste}.`,
    linjer: dagens.map((o) => {
      const forrige = forrigeOkt(o, alle);
      const notat = forrige?.logg?.trim() || null;
      return { okt: o, forrige, notat };
    }),
  };
}
