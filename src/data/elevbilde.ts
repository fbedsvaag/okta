import { hent, settInnEllerOppdater, Transaksjon } from "../db";
import { varsleElever } from "./endringer";

/**
 * Elevbilder, klippet fra InSchool-utskriften (se `import/inschool.ts`).
 *
 * Bildet går aldri ut av appen — ingen spørring i arkivet, eksporten eller
 * kalenderen leser denne tabellen, og slik skal det forbli (§1, §8).
 */

/** Setter bildet, eller bytter det ut. Raden gjenbrukes (UNIQUE, §12). */
export async function settElevbilde(
  elevId: string,
  bilde: string,
  kilde: string,
): Promise<void> {
  await settInnEllerOppdater("elevbilde", ["elev_id"], {
    elev_id: elevId,
    bilde,
    kilde,
  });
  varsleElever();
}

export async function hentElevbilde(elevId: string): Promise<string | null> {
  const [rad] = await hent<{ bilde: string | null }>(
    "SELECT bilde FROM elevbilde WHERE elev_id = $1 AND slettet IS NULL",
    [elevId],
  );
  return rad?.bilde ?? null;
}

/** Alle bildene, etter elev. Til lister som søket, der mange vises på én gang. */
export async function hentAlleElevbilder(): Promise<Map<string, string>> {
  const rader = await hent<{ elevId: string; bilde: string }>(
    `SELECT elev_id AS elevId, bilde FROM elevbilde
      WHERE slettet IS NULL AND bilde IS NOT NULL`,
  );
  return new Map(rader.map((r) => [r.elevId, r.bilde]));
}

/**
 * Kjønnet til alle elevene som har det satt — til plassholderen der bildet
 * mangler (jente, gutt eller nøytral). Bor her fordi det hentes sammen med
 * bildene og vises på samme sted.
 */
export async function hentAlleKjonn(): Promise<Map<string, "j" | "g">> {
  const rader = await hent<{ id: string; kjonn: "j" | "g" }>(
    `SELECT id, kjonn FROM elev
      WHERE slettet IS NULL AND kjonn IN ('j', 'g')`,
  );
  return new Map(rader.map((r) => [r.id, r.kjonn]));
}

/**
 * Fjerner bildet. Raden soft-slettes som alt annet, men selve bildet tømmes
 * først — ansiktet skal ikke ligge igjen i basen.
 */
export async function slettElevbilde(elevId: string): Promise<void> {
  const t = new Transaksjon();
  await slettElevbildeI(t, elevId);
  await t.kjor();
  varsleElever();
}

/** Legger slettingen av bildet inn i en større transaksjon (#2). */
export async function slettElevbildeI(
  t: Transaksjon,
  elevId: string,
): Promise<void> {
  const [rad] = await hent<{ id: string }>(
    "SELECT id FROM elevbilde WHERE elev_id = $1 AND slettet IS NULL",
    [elevId],
  );
  if (!rad) return;
  t.oppdater("elevbilde", rad.id, { bilde: null });
  t.slett("elevbilde", rad.id);
}
