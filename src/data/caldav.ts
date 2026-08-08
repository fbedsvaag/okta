import { invoke } from "@tauri-apps/api/core";
import { lagHendelse } from "./ical";
import { hentOkter } from "./okter";
import { hentAllePerioder, periodeFor, type Periode } from "./perioder";
import { hentInnstilling, settInnstilling, type Skolear } from "./skolear";

/**
 * Publisering av timeplanen til brukerens kalenderserver, SPEC §8.1.
 *
 * Ett fag = én kalender på serveren. Da kan en elev abonnere på faget sitt
 * uten å få alle de andre med på kjøpet.
 *
 * Innholdet lages av `lagHendelse`, som er det ene stedet feltlista
 * håndheves. Denne fila bestemmer bare *hvilke* økter som skal skrives og
 * hvilke som skal fjernes — aldri hva som står i dem.
 */

const URL_BASE = "caldav_base";
const BRUKER = "caldav_bruker";
const PA = "caldav_pa";
const KALENDERE = "caldav_kalendere";
const PUBLISERT = "caldav_publisert";

export type Oppsett = {
  base: string;
  bruker: string;
  pa: boolean;
  /** skolearFagId -> kalendernavn på serveren. Mangler = publiseres ikke. */
  kalendere: Record<string, string>;
};

export async function hentOppsett(): Promise<Oppsett> {
  const [base, bruker, pa, kal] = await Promise.all([
    hentInnstilling(URL_BASE),
    hentInnstilling(BRUKER),
    hentInnstilling(PA),
    hentInnstilling(KALENDERE),
  ]);
  return {
    base: base ?? "",
    bruker: bruker ?? "",
    pa: pa === "1",
    kalendere: kal ? (JSON.parse(kal) as Record<string, string>) : {},
  };
}

export async function lagreOppsett(o: Partial<Oppsett>): Promise<void> {
  if (o.base !== undefined) await settInnstilling(URL_BASE, o.base.trim());
  if (o.bruker !== undefined) await settInnstilling(BRUKER, o.bruker.trim());
  if (o.pa !== undefined) await settInnstilling(PA, o.pa ? "1" : "0");
  if (o.kalendere !== undefined)
    await settInnstilling(KALENDERE, JSON.stringify(o.kalendere));
}

export async function lagrePassord(passord: string): Promise<void> {
  await invoke("caldav_lagre_passord", { passord });
}

export async function harPassord(): Promise<boolean> {
  return invoke<boolean>("caldav_har_passord");
}

export async function glemPassord(): Promise<void> {
  await invoke("caldav_glem_passord");
}

export async function test(url: string, bruker: string): Promise<string> {
  return invoke<string>("caldav_test", { url, bruker });
}

export type Resultat = { skrevet: number; slettet: number; feil: string[] };

/**
 * Skriver alle øktene til serveren, ett fag om gangen.
 *
 * Vi spør aldri serveren om hva den allerede har — publiseringen er enveis
 * (§8.1). I stedet husker vi hvilke id-er vi sendte sist, og sletter dem som
 * er borte nå. Lista ligger i `innstilling`, så den følger databasen.
 *
 * Alle økter skrives hver gang. Med rundt 150 økter er det noen sekunder, og
 * det er en pris verdt å betale for å slippe å spore endringer per økt.
 */
export async function publiser(skolear: Skolear): Promise<Resultat> {
  const o = await hentOppsett();
  if (!o.base || !o.bruker) {
    throw new Error("Adresse og brukernavn må være satt.");
  }

  const okter = await hentOkter(skolear.id);
  const alle = await hentAllePerioder(skolear.id);

  const perOkt = new Map<string, Periode>();
  for (const okt of okter) {
    const p = periodeFor(
      okt,
      alle.filter((x) => x.skolearFagId === okt.skolearFagId),
    );
    if (p) perOkt.set(okt.id, p);
  }

  const forrige: Record<string, string[]> = JSON.parse(
    (await hentInnstilling(PUBLISERT)) ?? "{}",
  );
  const na: Record<string, string[]> = {};
  const samlet: Resultat = { skrevet: 0, slettet: 0, feil: [] };

  for (const [fagId, kalender] of Object.entries(o.kalendere)) {
    if (!kalender.trim()) continue;

    const egne = okter.filter((x) => x.skolearFagId === fagId);
    const hendelser = egne.map((okt) => ({
      uid: okt.id,
      ics: lagHendelse(okt, perOkt.get(okt.id) ?? null),
    }));

    const finnes = new Set(egne.map((x) => x.id));
    const fjern = (forrige[fagId] ?? []).filter((id) => !finnes.has(id));

    const r = await invoke<Resultat>("caldav_publiser", {
      url: `${o.base.replace(/\/$/, "")}/${kalender.trim()}`,
      bruker: o.bruker,
      hendelser,
      fjern,
    });

    samlet.skrevet += r.skrevet;
    samlet.slettet += r.slettet;
    samlet.feil.push(...r.feil);
    na[fagId] = [...finnes];
  }

  await settInnstilling(PUBLISERT, JSON.stringify(na));
  return samlet;
}
