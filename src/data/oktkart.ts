import {
  gjeldendeOppsett,
  hentKart,
  hentKildeElever,
  hentOppsett,
  hentPlassfarger,
  hentRom,
  type Del,
  type Kart,
} from "./klassekart";

/**
 * Klassekartet på et blikk i økta (ARBEIDSLISTE 27): fagets kart,
 * plasseringen som gjaldt den dagen, og pultfargene. Bare til å se på.
 */
export type Oktkart = {
  kart: Kart;
  deler: Del[];
  /** elev → plassnummer */
  plass: Map<string, number>;
  /** plassnummer → gruppefarge (25.11) */
  pultfarge: Map<number, string>;
  navn: Map<string, { fornavn: string; etternavn: string }>;
};

export async function hentOktkart(
  skolearId: string,
  skolearFagId: string,
  dato: string,
): Promise<Oktkart | null> {
  const kart = (await hentKart(skolearId)).find(
    (k) => k.kildeType === "fag" && k.kildeId === skolearFagId,
  );
  if (!kart) return null;
  const [rom, historikk, farger, elever] = await Promise.all([
    hentRom(),
    hentOppsett(kart.id, "plass"),
    hentPlassfarger(kart.id),
    hentKildeElever("fag", skolearFagId, skolearId),
  ]);
  const o = gjeldendeOppsett(historikk, dato) ?? historikk[0] ?? null;
  return {
    kart,
    deler: rom.find((r) => r.id === kart.romId)?.deler ?? [],
    plass: new Map(
      (o?.rader ?? [])
        .filter((r) => r.plass)
        .map((r) => [r.elevId, r.plass as number]),
    ),
    pultfarge: new Map(farger.map((f) => [f.plass, f.farge])),
    navn: new Map(
      elever.map((e) => [e.id, { fornavn: e.fornavn, etternavn: e.etternavn }]),
    ),
  };
}

/**
 * Hva en tast gjør med kartkortet (27.1). K veksler, men ikke mens du
 * skriver i et felt, og ikke med ⌘/ctrl/alt. Esc lukker kortet når det er
 * åpent — før økta.
 */
export function kartTast(
  e: {
    key: string;
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    skriver: boolean;
  },
  apen: boolean,
): "veksle" | "lukk" | null {
  if (e.key === "Escape") return apen ? "lukk" : null;
  if (e.metaKey || e.ctrlKey || e.altKey || e.skriver) return null;
  if (e.key === "k" || e.key === "K") return "veksle";
  return null;
}

/** Om tastetrykket skjer i et skrivefelt. */
export const iFelt = (mal: EventTarget | null) =>
  !!(mal as HTMLElement | null)?.closest?.(
    "input, textarea, select, [contenteditable='true'], [contenteditable='']",
  );
