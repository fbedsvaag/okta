import { hent } from "./db";

export type Skala = {
  id: string;
  navn: string;
  bruksomrade: "skaring" | "vurdering" | "begge";
  innebygd: number;
};

export type Skalaverdi = {
  id: string;
  skala_id: string;
  kode: string;
  etikett: string | null;
  rang: number;
  farge: "gronn" | "gul" | "rod" | null;
  bestatt: number | null;
  teller_ikke: number;
};

/**
 * Tastene utledes av rang, de er ikke hardkodet noe sted (SPEC §5).
 *
 *   rang = 0  ->  tast "0". Det er alltid verdien som betyr "ingenting her":
 *                 ikke i økta, ikke levert, ikke vurderingsgrunnlag.
 *   ellers    ->  "1" og oppover, stigende etter rang.
 *
 * En 1-6-skala får dermed tastene 1-6 uten at noe bygges om.
 * Skalaer med mer enn ni verdier (utenom 0) får ingen taster: der skriver
 * læreren koden, f.eks. «4+», og trykker Enter.
 */
export function taster(verdier: Skalaverdi[]): Map<string, string> {
  const sortert = [...verdier].sort((a, b) => a.rang - b.rang);
  const kart = new Map<string, string>();
  // Høyst ni verdier ved siden av 0 får taster (ARBEIDSLISTE 22.4). Over
  // det skriver læreren koden og trykker Enter.
  if (sortert.filter((v) => v.rang !== 0).length > 9) return kart;

  let neste = 1;
  for (const v of sortert) {
    kart.set(v.id, v.rang === 0 ? "0" : String(neste++));
  }
  return kart;
}

export async function hentSkalaer(): Promise<Skala[]> {
  return hent<Skala>(
    "SELECT id, navn, bruksomrade, innebygd FROM skala WHERE slettet IS NULL ORDER BY bruksomrade, navn",
  );
}

export async function hentVerdier(skalaId: string): Promise<Skalaverdi[]> {
  return hent<Skalaverdi>(
    "SELECT * FROM skalaverdi WHERE skala_id = $1 AND slettet IS NULL ORDER BY rang",
    [skalaId],
  );
}
