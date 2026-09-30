/**
 * Klasselista fra InSchool, lest ut av PDF-en skolen skriver ut.
 *
 * Utskriften har to deler: en tabell med nummer, klasse og fullt navn, og
 * sider med elevbilder i et rutenett — navn og klasse står rett under hvert
 * bilde. Tabellen gir klasselista; bildetekstene gir hvilket bilde som
 * hører til hvem.
 *
 * Alt her er rene funksjoner på posisjoner. Selve PDF-lesingen (pdf.js) og
 * utklippet av bildene ligger i `pdf.ts`, så dette kan testes uten en
 * nettleser — og uten ekte elevdata i testene.
 *
 * Koordinatene er PDF-ens egne: punkter, med y oppover fra bunnen av siden.
 */

export type Tekstbit = { x: number; y: number; str: string };
/** Der et bilde er tegnet: nederste venstre hjørne, bredde og høyde. */
export type Bildeplass = { x: number; y: number; w: number; h: number };
export type Side = { tekst: Tekstbit[]; bilder: Bildeplass[] };

export type InschoolElev = { navn: string; klasse: string | null };
export type InschoolBilde = {
  /** sidenummer, fra 1 */
  side: number;
  plass: Bildeplass;
  navn: string;
  klasse: string | null;
};

export type Inschool = {
  /** fagkoden i toppen, f.eks. «SPR3029» fra «Blokk_2/SPR3029/Engelsk 1» */
  fagkode: string | null;
  elever: InschoolElev[];
  bilder: InschoolBilde[];
};

/** Samme navn skrevet likt uansett mellomrom, bindestrek og store bokstaver. */
export function navnenokkel(navn: string): string {
  return navn
    .normalize("NFC")
    .toLocaleLowerCase("nb-NO")
    .replace(/[^\p{L}]/gu, "");
}

const NAER = 3;

/** Et elevbilde er et portrett: høyere enn bredt, og ikke bittelite. */
function erPortrett(b: Bildeplass): boolean {
  const forhold = b.h / b.w;
  return b.w >= 30 && forhold > 1.1 && forhold < 1.6;
}

export function lesInschool(sider: Side[]): Inschool {
  const alleTekster = sider.flatMap((s) => s.tekst);
  const fagkode =
    alleTekster
      .map((t) => t.str.match(/(?:^|\/)([A-ZÆØÅ]{3}\d{4})(?:\/|$)/)?.[1])
      .find(Boolean) ?? null;

  const elever = sider.flatMap(lesTabell);

  const kjente = new Map(elever.map((e) => [navnenokkel(e.navn), e]));
  const bilder = sider.flatMap((s, i) =>
    s.bilder.filter(erPortrett).flatMap((plass) => {
      const tekst = bildetekst(s.tekst, plass);
      if (!tekst) return [];
      const { navn, klasse } = delBildetekst(tekst);
      // Navnet fra tabellen vinner — der står det på én linje, uten brekk.
      const fraTabell = kjente.get(navnenokkel(navn));
      return [
        {
          side: i + 1,
          plass,
          navn: fraTabell?.navn ?? navn,
          klasse: fraTabell?.klasse ?? klasse,
        },
      ];
    }),
  );

  // Uten tabell er bildetekstene hele lista.
  return {
    fagkode,
    elever:
      elever.length > 0
        ? elever
        : bilder.map((b) => ({ navn: b.navn, klasse: b.klasse })),
    bilder,
  };
}

/**
 * Tabellen: en overskriftsrad med «Klasse» og «Elev», og under den én rad
 * per elev med nummer først.
 */
function lesTabell(side: Side): InschoolElev[] {
  const hodeKlasse = side.tekst.find((t) => t.str.trim() === "Klasse");
  const hodeElev = side.tekst.find(
    (t) =>
      t.str.trim() === "Elev" &&
      hodeKlasse &&
      Math.abs(t.y - hodeKlasse.y) < NAER,
  );
  if (!hodeKlasse || !hodeElev) return [];

  const rader = new Map<number, Tekstbit[]>();
  for (const t of side.tekst) {
    if (t.y >= hodeKlasse.y - 1) continue;
    const y = Math.round(t.y);
    const nokkel = [...rader.keys()].find((k) => Math.abs(k - y) < NAER) ?? y;
    rader.set(nokkel, [...(rader.get(nokkel) ?? []), t]);
  }

  return [...rader.entries()]
    .sort(([a], [b]) => b - a)
    .flatMap(([, biter]) => {
      const nr = biter.find((t) => /^\d+$/.test(t.str.trim()));
      const klasse = biter.find((t) => Math.abs(t.x - hodeKlasse.x) < NAER);
      const elev = biter.find((t) => Math.abs(t.x - hodeElev.x) < NAER);
      if (!nr || !elev || !elev.str.trim()) return [];
      return [{ navn: elev.str.trim(), klasse: klasse?.str.trim() || null }];
    });
}

/** Linjene rett under bildet, i samme venstrekant, satt sammen. */
function bildetekst(tekst: Tekstbit[], b: Bildeplass): string | null {
  const linjer = tekst
    .filter(
      (t) =>
        Math.abs(t.x - b.x) <= NAER &&
        t.y < b.y &&
        t.y > b.y - 60 &&
        t.str.trim(),
    )
    .sort((a, c) => c.y - a.y)
    .map((t) => t.str.trim());
  if (linjer.length === 0) return null;
  // Et navn brukket ved bindestreken limes sammen uten mellomrom.
  return linjer.reduce((s, l) => (s.endsWith("-") ? s + l : `${s} ${l}`));
}

function delBildetekst(tekst: string): InschoolElev {
  const m = tekst.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m
    ? { navn: m[1].trim(), klasse: m[2].trim() }
    : { navn: tekst.trim(), klasse: null };
}

/** Linjene lim-inn-parseren tar imot: «navn; klasse» (§7). */
export function somLimInnTekst(elever: InschoolElev[]): string {
  return elever
    .map((e) => (e.klasse ? `${e.navn}; ${e.klasse}` : e.navn))
    .join("\n");
}
