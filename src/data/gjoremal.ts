import { hent, oppdater, settInn } from "../db";
import { varsleElever } from "./endringer";
import { tolkMarkdown, vekslBoks } from "../ui/markdown";
import { endreElevnotat, opprettElevnotat, settLukket } from "./elevnotat";
import { endreOkt } from "./okter";

/**
 * Gjøremålene på forsiden: alt som venter, samlet ett sted.
 *
 * To kilder, begge noe du allerede skriver:
 * - notater merket «skal følges opp» som ikke er lukket (§4.7) — fra
 *   elevkortet eller fra en samtale;
 * - avkrysningsbokser som ikke er krysset av (`- [ ]`) i elevnotater og
 *   øktlogger.
 *
 * Gjøremålet bor der det ble skrevet, og krysses av der. Da kan det aldri
 * si noe annet enn notatet sier. Et gjøremål skrevet på forsiden blir et
 * oppfølgingsnotat på eleven — eller, uten elev, en rad i `gjoremal`
 * (migrasjon 023).
 */

export type Gjoremal =
  | {
      slag: "oppfolging";
      notatId: string;
      elevId: string;
      navn: string;
      dato: string;
      frist: string | null;
      tekst: string;
    }
  | {
      slag: "elevboks";
      notatId: string;
      linje: number;
      elevId: string;
      navn: string;
      dato: string;
      tekst: string;
    }
  | {
      slag: "eget";
      id: string;
      dato: string;
      frist: string | null;
      tekst: string;
    }
  | {
      slag: "oktboks";
      oktId: string;
      linje: number;
      fagKode: string;
      dato: string;
      tekst: string;
    };

/** De åpne boksene i en tekst: linjenummer og teksten etter boksen. */
export function apneBokser(tekst: string): { linje: number; tekst: string }[] {
  const linjer = tekst.split("\n");
  return tolkMarkdown(tekst).flatMap((b) =>
    b.type === "liste"
      ? b.punkter
          .filter((p) => p.avkrysset === false)
          .map((p) => ({
            linje: p.linje,
            tekst: (linjer[p.linje] ?? "")
              .replace(/^\s*(?:[-*+]|\d+[.)])\s+\[ \]\s*/, "")
              .trim(),
          }))
      : [],
  );
}

/** Første linje med innhold, uten markdown-tegn foran. */
export function forsteLinje(tekst: string): string {
  const l =
    tekst
      .split("\n")
      .map((x) =>
        x
          .replace(/^\s*#{1,3}\s+/, "")
          .replace(/^\s*(?:[-*+]|\d+[.)])\s+(\[( |x|X)\]\s+)?/, "")
          .trim(),
      )
      .find(Boolean) ?? "";
  return l;
}

/**
 * Rekkefølgen: forfalte og med frist først, tidligste frist øverst; så
 * resten, nyeste først.
 */
export function sorterGjoremal(liste: Gjoremal[]): Gjoremal[] {
  const frist = (g: Gjoremal) =>
    g.slag === "oppfolging" || g.slag === "eget" ? g.frist : null;
  return [...liste].sort((a, b) => {
    const fa = frist(a);
    const fb = frist(b);
    if (fa && fb) return fa.localeCompare(fb);
    if (fa) return -1;
    if (fb) return 1;
    return b.dato.localeCompare(a.dato);
  });
}

export async function hentGjoremal(skolearId: string): Promise<Gjoremal[]> {
  // Notatene til elever som finnes. Alle år: et åpent punkt fra i fjor er
  // fortsatt åpent.
  const notater = await hent<{
    id: string;
    elevId: string;
    navn: string;
    dato: string;
    tekst: string;
    frist: string | null;
    oppfolging: number;
  }>(
    `SELECT n.id, n.elev_id AS elevId,
            e.fornavn || ' ' || e.etternavn AS navn,
            n.dato, n.tekst, n.frist,
            (n.skal_folges_opp = 1 AND n.lukket IS NULL) AS oppfolging
       FROM elevnotat n
       JOIN elev e ON e.id = n.elev_id AND e.slettet IS NULL
      WHERE n.slettet IS NULL
        AND ((n.skal_folges_opp = 1 AND n.lukket IS NULL)
             OR n.tekst LIKE '%[ ]%')`,
  );

  // Øktloggene i året.
  const okter = await hent<{
    id: string;
    fagKode: string;
    dato: string;
    logg: string;
  }>(
    `SELECT o.id, COALESCE(NULLIF(f.alias, ''), f.kode) AS fagKode,
            o.dato, o.logg
       FROM okt o
       JOIN skolear_fag sf ON sf.id = o.skolear_fag_id
                          AND sf.slettet IS NULL AND sf.skolear_id = $1
       JOIN fag f ON f.id = sf.fag_id
      WHERE o.slettet IS NULL AND o.logg LIKE '%[ ]%'`,
    [skolearId],
  );

  const egne = await hent<{
    id: string;
    dato: string;
    frist: string | null;
    tekst: string;
  }>(
    `SELECT id, substr(opprettet, 1, 10) AS dato, frist, tekst
       FROM gjoremal
      WHERE skolear_id = $1 AND slettet IS NULL AND ferdig IS NULL`,
    [skolearId],
  );

  const ut: Gjoremal[] = egne.map((g) => ({ slag: "eget" as const, ...g }));
  for (const n of notater) {
    // Et oppfølgingsnotat står én gang, som seg selv — boksene i det er
    // en del av det samme punktet.
    if (n.oppfolging) {
      ut.push({
        slag: "oppfolging",
        notatId: n.id,
        elevId: n.elevId,
        navn: n.navn,
        dato: n.dato,
        frist: n.frist,
        tekst: forsteLinje(n.tekst),
      });
      continue;
    }
    for (const b of apneBokser(n.tekst))
      ut.push({
        slag: "elevboks",
        notatId: n.id,
        linje: b.linje,
        elevId: n.elevId,
        navn: n.navn,
        dato: n.dato,
        tekst: b.tekst,
      });
  }
  for (const o of okter)
    for (const b of apneBokser(o.logg))
      ut.push({
        slag: "oktboks",
        oktId: o.id,
        linje: b.linje,
        fagKode: o.fagKode,
        dato: o.dato,
        tekst: b.tekst,
      });

  return sorterGjoremal(ut);
}

/**
 * Krysser av gjøremålet der det bor. Teksten leses på nytt rett før, så en
 * endring gjort et annet sted i mellomtiden ikke skrives over.
 */
export async function fullforGjoremal(g: Gjoremal): Promise<void> {
  if (g.slag === "oppfolging") return settLukket(g.notatId, true);
  if (g.slag === "eget") {
    await oppdater("gjoremal", g.id, {
      ferdig: new Date().toLocaleDateString("sv-SE"),
    });
    varsleElever();
    return;
  }
  if (g.slag === "elevboks") {
    const [n] = await hent<{ tekst: string }>(
      "SELECT tekst FROM elevnotat WHERE id = $1",
      [g.notatId],
    );
    if (n)
      await endreElevnotat(g.notatId, { tekst: vekslBoks(n.tekst, g.linje) });
    return;
  }
  const [o] = await hent<{ logg: string | null }>(
    "SELECT logg FROM okt WHERE id = $1",
    [g.oktId],
  );
  if (o?.logg) await endreOkt(g.oktId, { logg: vekslBoks(o.logg, g.linje) });
}

/**
 * Et nytt gjøremål fra forsiden. Med elev blir det et oppfølgingsnotat på
 * eleven, så det også står i elevkortet; uten elev en rad i `gjoremal`.
 */
export async function nyttGjoremal(
  skolearId: string,
  felter: { tekst: string; elevId?: string | null; frist?: string | null },
): Promise<void> {
  const tekst = felter.tekst.trim();
  if (!tekst) return;
  const frist = felter.frist || null;
  if (felter.elevId) {
    await opprettElevnotat(felter.elevId, skolearId, {
      dato: new Date().toLocaleDateString("sv-SE"),
      tekst,
      skalFolgesOpp: true,
      frist,
    });
    return;
  }
  await settInn("gjoremal", { skolear_id: skolearId, tekst, frist });
  varsleElever();
}
