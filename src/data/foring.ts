import { hent, oppdater } from "../db";
import { lesJson } from "./json";
import type { Leveranse } from "./muntlig";

/**
 * Føring av skriftlig prøve og innlevering (ARBEIDSLISTE 29.5): levert,
 * ikke levert eller borte, faste fraser til kommentaren, og en kolonne lim
 * inn fra Excel.
 */

export async function hentFraser(vurderingId: string): Promise<string[]> {
  const [r] = await hent<{ fraser: string | null }>(
    "SELECT fraser FROM vurdering WHERE id = $1",
    [vurderingId],
  );
  return lesJson<string[]>(r?.fraser ?? null, [], "frasene");
}

export async function settFraser(
  vurderingId: string,
  fraser: string[],
): Promise<void> {
  await oppdater("vurdering", vurderingId, { fraser: JSON.stringify(fraser) });
}

/**
 * Elevene som var borte i en av øktene vurderingen holdes i: skåret
 * «ikke i økta» (teller_ikke).
 */
export async function hentBorteIOkt(vurderingId: string): Promise<Set<string>> {
  const rader = await hent<{ elevId: string }>(
    `SELECT DISTINCT s.elev_id AS elevId
       FROM vurdering_okt vo
       JOIN okt o ON o.id = vo.okt_id AND o.slettet IS NULL
       JOIN skaring s ON s.okt_id = o.id AND s.slettet IS NULL
       JOIN skalaverdi sv ON sv.id = s.skalaverdi_id
      WHERE vo.vurdering_id = $1 AND vo.slettet IS NULL
        AND sv.teller_ikke = 1`,
    [vurderingId],
  );
  return new Set(rader.map((r) => r.elevId));
}

/**
 * Hva som står for eleven. Satt for hånd gjelder; ellers borte når eleven
 * var borte i økta, levert når det er ført en karakter, og ellers ikke noe
 * ennå.
 */
export function leveranseFor(
  satt: Leveranse | null | undefined,
  borteIOkt: boolean,
  harKarakter: boolean,
): Leveranse | null {
  if (satt) return satt;
  if (borteIOkt) return "borte";
  if (harKarakter) return "levert";
  return null;
}

/** En frase lagt til kommentaren: på slutten, med mellomrom. */
export function leggTilFrase(kommentar: string, frase: string): string {
  const t = kommentar.trimEnd();
  return t ? `${t} ${frase}` : frase;
}

/**
 * En kolonne limt inn fra Excel eller Teams: én verdi per linje. Tomme
 * linjer midt i blir stående (eleven hoppes over), tomme linjer på slutten
 * tas bort. Er det flere kolonner, brukes den første.
 */
export function lesKolonne(tekst: string): string[] {
  const linjer = tekst
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.split("\t")[0].trim());
  while (linjer.length > 0 && linjer[linjer.length - 1] === "") linjer.pop();
  return linjer;
}
