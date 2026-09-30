import { hent, oppdater, settInn, slett } from "../db";
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
  const [finnes] = await hent<{ id: string }>(
    "SELECT id FROM elevbilde WHERE elev_id = $1",
    [elevId],
  );
  if (finnes) {
    await oppdater("elevbilde", finnes.id, { bilde, kilde, slettet: null });
  } else {
    await settInn("elevbilde", { elev_id: elevId, bilde, kilde });
  }
  varsleElever();
}

export async function hentElevbilde(elevId: string): Promise<string | null> {
  const [rad] = await hent<{ bilde: string | null }>(
    "SELECT bilde FROM elevbilde WHERE elev_id = $1 AND slettet IS NULL",
    [elevId],
  );
  return rad?.bilde ?? null;
}

/**
 * Fjerner bildet. Raden soft-slettes som alt annet, men selve bildet tømmes
 * først — ansiktet skal ikke ligge igjen i basen.
 */
export async function slettElevbilde(elevId: string): Promise<void> {
  const [rad] = await hent<{ id: string }>(
    "SELECT id FROM elevbilde WHERE elev_id = $1 AND slettet IS NULL",
    [elevId],
  );
  if (!rad) return;
  await oppdater("elevbilde", rad.id, { bilde: null });
  await slett("elevbilde", rad.id);
  varsleElever();
}
