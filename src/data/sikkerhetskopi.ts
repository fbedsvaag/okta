import { invoke } from "@tauri-apps/api/core";
import { db, naa } from "../db";

/**
 * Rullerende sikkerhetskopi, SPEC §8.
 *
 * Kopien tas med `VACUUM INTO`, ikke som en filkopi. SQLite skriver da en
 * konsistent base uansett hva som foregår samtidig — en vanlig kopi av ei
 * åpen database kan bli ubrukelig uten at det synes før du trenger den.
 *
 * Kopiene ligger i `backup/` i appens data-mappe. Aldri i en synkmappe.
 */

export type Kopi = { navn: string; bytes: number; daglig: boolean };

const BEHOLD = 30;

/** Kjøres ved appstart. Tar en kopi hvis det ikke finnes en fra i dag. */
export async function daglingKopi(): Promise<string | null> {
  return taKopi(false);
}

export async function taKopiNa(): Promise<string | null> {
  return taKopi(true);
}

async function taKopi(tvungen: boolean): Promise<string | null> {
  const dato = naa().slice(0, 10);
  const mal = await invoke<string | null>("forbered_sikkerhetskopi", {
    dato,
    tvungen,
  });
  if (!mal) return null;

  // VACUUM INTO tar ikke bundne parametre — filnavnet må stå i teksten.
  // Stien lager vi selv, men fnutter i mappenavn dobles for sikkerhets skyld.
  await (await db()).execute(`VACUUM INTO '${mal.replace(/'/g, "''")}'`);
  await invoke("rydd_sikkerhetskopier", { behold: BEHOLD });
  return mal;
}

export async function hentKopier(): Promise<Kopi[]> {
  return invoke<Kopi[]>("sikkerhetskopier");
}

export async function hentKopimappe(): Promise<string> {
  return invoke<string>("sikkerhetskopimappe");
}

/**
 * Bytter ut arbeidsfila med en annen database og starter appen på nytt.
 *
 * Tilkoblingen lukkes først. Blir den stående åpen, kan SQLite spille av
 * loggfila til den gamle basen mot den nye ved neste oppstart.
 *
 * Den nåværende basen sikres i backup-mappa før noe overskrives, så også
 * denne handlingen kan angres.
 */
export async function gjenopprettFra(sti: string): Promise<void> {
  const tidsstempel = naa().replace(/[:T]/g, "-");
  await (await db()).close();
  await invoke("gjenopprett_fra", { sti, tidsstempel });
}
