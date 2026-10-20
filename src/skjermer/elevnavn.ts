/**
 * Navnelogikken bak «Ny elev» (ARBEIDSLISTE 19.1, lerretet ElevNy): hvor skillet
 * mellom fornavn og etternavn går, og om navnet finnes fra før.
 *
 * Skillet starter der parseren setter det (§7: siste ord, med partikler som
 * «van der»), og Tab flytter det ett ord mot venstre, rundt til slutten igjen.
 * Med komma («Berg, Anne») er skillet gitt, og Tab gjør ingenting.
 */
import { delNavn } from "../import/parser";
import { vurderImport, type EksisterendeElev } from "../import/duplikat";

function ordene(tekst: string): string[] {
  return tekst.trim().split(/\s+/).filter(Boolean);
}

/** Antall ord i fornavnet, eller null når skillet ikke kan flyttes. */
function standardskille(tekst: string): number | null {
  if (tekst.includes(",")) return null;
  const ord = ordene(tekst);
  if (ord.length < 2) return null;
  return ordene(delNavn(tekst).fornavn).length;
}

/** Navnet delt, med skillet etter `skille` ord når det er satt. */
export function delVed(
  tekst: string,
  skille: number | null,
): { fornavn: string; etternavn: string } {
  const std = standardskille(tekst);
  if (std === null || skille === null) return delNavn(tekst);
  const ord = ordene(tekst);
  const k = Math.max(1, Math.min(ord.length - 1, skille));
  return {
    fornavn: ord.slice(0, k).join(" "),
    etternavn: ord.slice(k).join(" "),
  };
}

/** Skillet etter ett trykk på Tab, eller null når Tab skal gjøre det vanlige. */
export function nesteSkille(
  tekst: string,
  skille: number | null,
  bakover = false,
): number | null {
  const std = standardskille(tekst);
  const n = ordene(tekst).length;
  if (std === null || n < 3) return null;
  const naa = skille ?? std;
  if (bakover) return naa + 1 > n - 1 ? 1 : naa + 1;
  return naa - 1 < 1 ? n - 1 : naa - 1;
}

/** To bokstaver til sirkelen: fornavnet og det siste ordet i etternavnet. */
export function initialer(fornavn: string, etternavn: string): string {
  const ord = ordene(etternavn);
  const siste = ord[ord.length - 1] ?? "";
  return (fornavn.charAt(0) + siste.charAt(0)).toLocaleUpperCase("nb-NO");
}

export type Treff = {
  /** «finnes»: samme navn, Lagre stenges. «ligner»: mulig skrivefeil. */
  slag: "finnes" | "ligner";
  elev: EksisterendeElev;
};

/**
 * Duplikatsjekken fra importen (§7.1), brukt på ett navn. Samme navn — eller
 * et fullere navn på en som finnes — er «finnes». Skrivefeil-nærhet er bare
 * «ligner», og stopper ingenting.
 */
export function finnTreff(
  fornavn: string,
  etternavn: string,
  eksisterende: EksisterendeElev[],
): Treff | null {
  if (!fornavn || !etternavn) return null;
  const [v] = vurderImport(
    [{ linjenr: 1, original: "", fornavn, etternavn, klasse: null }],
    eksisterende,
    { skolearFagId: null, valgtKlasse: null },
  );
  if (v.kandidater.length === 0) return null;
  return {
    slag: v.grunn === "naer-match" ? "ligner" : "finnes",
    elev: v.kandidater[0],
  };
}
