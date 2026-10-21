import { hent, idag, settInn, slett, Transaksjon } from "../db";
import { varsleElever, varsleKlassekart } from "./endringer";

/**
 * Ønsker og avtaler om hvem som sitter sammen (ARBEIDSLISTE 26.7, 26.8,
 * 26.13). Bare for læreren: ingen modul som skriver ut av appen, leser
 * denne filen (testet i onsker.test.ts).
 *
 * - **Ønske** (`elevonske`): «trives med · vil gjerne sitte med». Gjelder i
 *   alle fag der begge er. Myk regel når læreren slår den på.
 * - **Avtale** (`neste_sammen`): «neste gang skal … sitte med», i ett fag.
 *   Hard regel ved neste Stokk; settes til brukt når kartet eller settet
 *   lagres.
 */

export type Kilde = "samtale" | "eleven" | "selv";

export type Onske = {
  id: string;
  elevId: string;
  onskerElevId: string;
  kilde: Kilde;
  dato: string;
  samtaleId: string | null;
};

export async function hentOnsker(): Promise<Onske[]> {
  return hent<Onske>(
    `SELECT o.id, o.elev_id AS elevId, o.onsker_elev_id AS onskerElevId,
            o.kilde, o.dato, o.samtale_id AS samtaleId
       FROM elevonske o
       JOIN elev a ON a.id = o.elev_id AND a.slettet IS NULL
       JOIN elev b ON b.id = o.onsker_elev_id AND b.slettet IS NULL
      WHERE o.slettet IS NULL
      ORDER BY o.dato DESC`,
  );
}

export async function leggTilOnske(
  elevId: string,
  onskerElevId: string,
  kilde: Kilde,
  samtaleId: string | null = null,
): Promise<string | null> {
  if (elevId === onskerElevId) return null;
  const [finnes] = await hent<{ id: string }>(
    `SELECT id FROM elevonske
      WHERE elev_id = $1 AND onsker_elev_id = $2 AND slettet IS NULL`,
    [elevId, onskerElevId],
  );
  if (finnes) return finnes.id;
  const id = await settInn("elevonske", {
    elev_id: elevId,
    onsker_elev_id: onskerElevId,
    kilde,
    dato: idag(),
    samtale_id: samtaleId,
  });
  varsleElever();
  return id;
}

export async function fjernOnske(id: string): Promise<void> {
  await slett("elevonske", id);
  varsleElever();
}

/** Om a og b har nevnt hverandre. */
export function gjensidig(onsker: Onske[], a: string, b: string): boolean {
  return (
    onsker.some((o) => o.elevId === a && o.onskerElevId === b) &&
    onsker.some((o) => o.elevId === b && o.onskerElevId === a)
  );
}

// ------------------------------------------------------------- avtaler

export type Gjelder = "klassekart" | "grupper" | "begge";
export type Avtalekilde = "eleven" | "samtale" | "jeg";

export type Avtale = {
  id: string;
  elevId: string;
  medElevId: string;
  skolearFagId: string;
  gjelder: Gjelder;
  kilde: Avtalekilde;
  dato: string;
};

/** Avtalene som ikke er brukt ennå, i ett fag eller alle. */
export async function hentAvtaler(skolearFagId?: string): Promise<Avtale[]> {
  return hent<Avtale>(
    `SELECT n.id, n.elev_id AS elevId, n.med_elev_id AS medElevId,
            n.skolear_fag_id AS skolearFagId, n.gjelder, n.kilde, n.dato
       FROM neste_sammen n
       JOIN elev a ON a.id = n.elev_id AND a.slettet IS NULL
       JOIN elev b ON b.id = n.med_elev_id AND b.slettet IS NULL
      WHERE n.slettet IS NULL AND n.brukt IS NULL
        AND ($1 = '' OR n.skolear_fag_id = $1)
      ORDER BY n.dato`,
    [skolearFagId ?? ""],
  );
}

export async function leggTilAvtale(
  a: Omit<Avtale, "id" | "dato">,
): Promise<string> {
  const id = await settInn("neste_sammen", {
    elev_id: a.elevId,
    med_elev_id: a.medElevId,
    skolear_fag_id: a.skolearFagId,
    gjelder: a.gjelder,
    kilde: a.kilde,
    dato: idag(),
  });
  varsleKlassekart();
  return id;
}

export async function fjernAvtale(id: string): Promise<void> {
  await slett("neste_sammen", id);
  varsleKlassekart();
}

/** Om avtalen gjelder for klassekart eller grupper. */
export const gjelderFor = (a: Avtale, hva: "klassekart" | "grupper") =>
  a.gjelder === "begge" || a.gjelder === hva;

/**
 * Avtalene som ble oppfylt i et lagret kart eller sett, settes til brukt.
 * `sammen(a, b)`: om a og b havnet sammen. De som ikke ble oppfylt (eleven
 * var borte), blir stående. Gir hvor mange som ble brukt.
 */
export async function brukAvtaler(
  avtaler: Avtale[],
  sammen: (a: string, b: string) => boolean,
): Promise<number> {
  const t = new Transaksjon();
  let n = 0;
  for (const a of avtaler)
    if (sammen(a.elevId, a.medElevId)) {
      t.oppdater("neste_sammen", a.id, { brukt: idag() });
      n++;
    }
  await t.kjor();
  if (n > 0) varsleKlassekart();
  return n;
}

/** Til sletting av en elev: ønskene og avtalene begge veier (26.8). */
export async function slettForElevI(
  t: Transaksjon,
  elevId: string,
): Promise<void> {
  for (const [tabell, a, b] of [
    ["elevonske", "elev_id", "onsker_elev_id"],
    ["neste_sammen", "elev_id", "med_elev_id"],
  ] as const) {
    const rader = await hent<{ id: string }>(
      `SELECT id FROM ${tabell}
        WHERE (${a} = $1 OR ${b} = $1) AND slettet IS NULL`,
      [elevId],
    );
    for (const r of rader) t.slett(tabell, r.id);
  }
}
