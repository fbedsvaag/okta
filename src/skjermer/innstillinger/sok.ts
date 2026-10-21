/**
 * Søk i innstillingene (ARBEIDSLISTE 23.3, lerretet Innstillinger2). Hver rad
 * som kan søkes fram, står her med siden og nøkkelen (`data-k` på raden).
 * Et treff hopper til siden og blinker raden.
 *
 * `ord` er andre ord folk bruker om det samme («backup», «iCloud»), så
 * treffet kommer selv om man ikke kan appens ord.
 */

export type Sideid =
  | "deg"
  | "generelt"
  | "skolear"
  | "fag"
  | "skalaer"
  | "utseende"
  | "kopi"
  | "personvern"
  | "kalender"
  | "del"
  | "om";

export const SIDENAVN: Record<Sideid, string> = {
  deg: "Deg",
  generelt: "Generelt",
  skolear: "Skoleår",
  fag: "Fag",
  skalaer: "Skalaer",
  utseende: "Utseende",
  kopi: "Sikkerhetskopi",
  personvern: "Personvern",
  kalender: "Kalender",
  del: "Del med kollegaer",
  om: "Om Økta",
};

/** De gamle side-id-ene, som andre skjermer og lenker fortsatt bruker. */
export const GAMLE: Record<string, Sideid> = {
  sikkerhetskopi: "kopi",
  arkiv: "kopi",
  kalenderstrom: "kalender",
  kalenderserver: "kalender",
  deloppsett: "del",
};

export type Oppslag = {
  side: Sideid;
  /** nøkkelen på raden, `data-k` */
  k: string;
  tittel: string;
  ord?: string[];
};

export const INDEKS: Oppslag[] = [
  { side: "deg", k: "navn", tittel: "Ditt navn", ord: ["faglærer", "lærer"] },
  {
    side: "deg",
    k: "mentor",
    tittel: "Jeg er mentor",
    ord: ["kontaktlærer", "mentorelever", "kontaktelever", "samtaler"],
  },
  { side: "deg", k: "mentorklasse", tittel: "Mentorklasse", ord: ["klasse"] },
  {
    side: "generelt",
    k: "idag",
    tittel: "I dag",
    ord: ["forsiden", "enkel", "full", "startskjerm"],
  },
  {
    side: "generelt",
    k: "varighet",
    tittel: "Standard lengde på nye økter",
    ord: ["varighet", "minutter"],
  },
  { side: "generelt", k: "plan", tittel: "Øktplan", ord: ["tidslinje"] },
  {
    side: "generelt",
    k: "tekst",
    tittel: "Tekststørrelse",
    ord: ["skrift", "zoom", "større"],
  },
  { side: "skolear", k: "aret", tittel: "Skoleåret", ord: ["datoer"] },
  { side: "skolear", k: "start", tittel: "Første skoledag" },
  { side: "skolear", k: "slutt", tittel: "Siste skoledag" },
  {
    side: "skolear",
    k: "fri",
    tittel: "Ferier og fridager",
    ord: ["skoleruta", "ferie", "planleggingsdag"],
  },
  { side: "skolear", k: "nytt", tittel: "Neste skoleår", ord: ["nytt år"] },
  {
    side: "skolear",
    k: "tidligere",
    tittel: "Tidligere år",
    ord: ["bytt skoleår", "aktivt"],
  },
  {
    side: "fag",
    k: "fagfarge",
    tittel: "Fagfarger",
    ord: ["farge", "fag"],
  },
  {
    side: "fag",
    k: "nyfag",
    tittel: "Legg til fag",
    ord: ["udir", "fagkode", "fagbank"],
  },
  {
    side: "skalaer",
    k: "skalaer",
    tittel: "Skalaer",
    ord: ["karakter", "trafikklys", "vurderingsskala"],
  },
  {
    side: "utseende",
    k: "palett",
    tittel: "Fargepalett",
    ord: ["aksentfarge", "farger"],
  },
  { side: "utseende", k: "glass", tittel: "Glass", ord: ["gjennomsiktig"] },
  { side: "utseende", k: "bev", tittel: "Bevegelse", ord: ["animasjon"] },
  {
    side: "utseende",
    k: "lysmork",
    tittel: "Lys eller mørk",
    ord: ["mørk modus", "tema"],
  },
  {
    side: "kopi",
    k: "kopinaa",
    tittel: "Ta kopi nå",
    ord: ["backup", "sikkerhetskopi", "gjenopprett"],
  },
  { side: "kopi", k: "kopimappe", tittel: "Mappe med kopier" },
  {
    side: "kopi",
    k: "arkiv",
    tittel: "Lesbart arkiv",
    ord: ["markdown", "obsidian", "eksport"],
  },
  {
    side: "personvern",
    k: "lagres",
    tittel: "Hva Økta lagrer",
    ord: ["gdpr", "personvern", "data"],
  },
  {
    side: "kalender",
    k: "strom",
    tittel: "Kalenderstrøm",
    ord: ["icloud", "kalender-appen", "abonnement", "webcal"],
  },
  {
    side: "kalender",
    k: "dav",
    tittel: "Publiser til kalenderserver",
    ord: ["caldav", "telefon"],
  },
  { side: "kalender", k: "davadr", tittel: "Adresse til kalendermappa" },
  { side: "kalender", k: "davbr", tittel: "Brukernavn" },
  { side: "kalender", k: "davpw", tittel: "Passord", ord: ["nøkkelring"] },
  {
    side: "kalender",
    k: "davmentor",
    tittel: "Publiser mentorsamtaler",
    ord: ["kontaktsamtaler"],
  },
  {
    side: "del",
    k: "deloppsett",
    tittel: "Oppsettfil",
    ord: ["del", "kollega", "eksporter", "importer"],
  },
  { side: "om", k: "versjon", tittel: "Versjon" },
  {
    side: "om",
    k: "tilbake",
    tittel: "Gi tilbakemelding",
    ord: ["feil", "ønske"],
  },
  { side: "om", k: "datamappe", tittel: "Datamappe", ord: ["database", "fil"] },
];

const norm = (s: string) => s.toLocaleLowerCase("nb-NO").trim();

/**
 * Treffene for et søk, høyst `maks`: først de der tittelen begynner med
 * søket, så resten. Søket treffer tittel, andre ord og sidens navn. Samme
 * rad står bare én gang.
 */
export function sok(q: string, ekstra: Oppslag[] = [], maks = 7): Oppslag[] {
  const s = norm(q);
  if (!s) return [];
  const sett = new Set<string>();
  const treff = [...INDEKS, ...ekstra].filter((x) => {
    const ok =
      norm(x.tittel).includes(s) ||
      (x.ord ?? []).some((o) => norm(o).includes(s)) ||
      norm(SIDENAVN[x.side]).includes(s);
    const nokkel = `${x.side}:${x.k}`;
    if (!ok || sett.has(nokkel)) return false;
    sett.add(nokkel);
    return true;
  });
  const forst = (x: Oppslag) => (norm(x.tittel).startsWith(s) ? 0 : 1);
  return treff
    .map((x, i) => ({ x, i }))
    .sort((a, b) => forst(a.x) - forst(b.x) || a.i - b.i)
    .slice(0, maks)
    .map(({ x }) => x);
}
