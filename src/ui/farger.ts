/**
 * Fargene i appen, samlet ett sted.
 *
 * `skalaverdi.farge` lagrer et navn — `gronn`, `gul`, `rod` — ikke en
 * hex-kode. Navnet sier hva verdien betyr; hvilken grønn den tegnes med er
 * en presentasjonsdetalj og hører hjemme her, ikke i basen. Da kan paletten
 * byttes uten å røre data, og alle visninger følger med.
 *
 * Skal fargene bli redigerbare for brukeren, hører det til skalabyggeren
 * i §5.3.
 */

/**
 * Trafikklyspaletten. Fem trinn fra grønt til rødt.
 *
 * Trafikklyset i v1 bruker de tre ytterpunktene. De to mellomtrinnene ligger
 * her fordi en femtrinns skåringsskala er en naturlig utvidelse, og fordi en
 * palett med jevne overganger er lettere å lese enn tre farger valgt hver
 * for seg.
 */
export const TRAFIKKLYS = {
  gronn: "var(--color-lys-gronn)",
  gronngul: "var(--color-lys-gronngul)",
  gul: "var(--color-lys-gul)",
  guloransje: "var(--color-lys-oransje)",
  rod: "var(--color-lys-rod)",
} as const;

/**
 * Verdier uten farge, og «ikke i økta».
 *
 * Peker på et token framfor en hex-kode, som resten av paletten. Det er
 * det som gjør at et temabytte også treffer trafikklyset.
 */
export const NOYTRAL = "var(--color-lys-borte)";

/**
 * Slår opp fargen til en skalaverdi. Ukjente navn og `null` gir den nøytrale
 * gråtonen framfor å kaste — en skala kan ha verdier uten farge.
 */
export function skalafarge(navn: string | null): string {
  if (navn && navn in TRAFIKKLYS) {
    return TRAFIKKLYS[navn as keyof typeof TRAFIKKLYS];
  }
  return NOYTRAL;
}

/**
 * Fargene fag skilles med. Dempede blekkfarger — de vises som en liten
 * firkant (`Fagfirkant`), ikke som strek eller flate (DESIGN.md §4). Trafikklyset skal fortsatt
 * være det eneste stedet i appen med mettet farge.
 */
/**
 * Fagfargene (ARBEIDSLISTE 17.3): 36 farger i seks familier à seks, vist
 * som rader med familienavn. Ingen av dem er trafikklysfargene.
 */
export const FAGFARGER: Record<string, readonly string[]> = {
  Jord: ["#9a5a2c", "#b5703a", "#c9922e", "#a98b5d", "#7a4f2e", "#5e4632"],
  Bær: ["#c0607a", "#a83f5f", "#d4708c", "#8e3b6b", "#b85c9e", "#e08a9a"],
  Skog: ["#3d7a5a", "#2f9a8a", "#5b8c3a", "#7a9a3e", "#2e6b4f", "#4fa37a"],
  Hav: ["#2e6a8e", "#3f6a95", "#4f7ac0", "#2b8fb8", "#5aa3c9", "#1f4f7a"],
  Skumring: ["#7d6bb0", "#4a3d7d", "#9584c8", "#6a4fa0", "#b07cc6", "#58507a"],
  Klar: ["#e0563b", "#f08a24", "#e8b400", "#1aa37a", "#1f8ae0", "#d43d8c"],
};

/** Alle 36, i rekkefølge: til nye fag, som får den første ledige. */
export const ALLE_FAGFARGER: readonly string[] =
  Object.values(FAGFARGER).flat();

/** Den første fagfargen ingen andre fag bruker (ellers neste i rekka). */
export function ledigFagfarge(
  brukt: (string | null)[],
  n = brukt.length,
): string {
  const sett = new Set(brukt.map((f) => f?.toLowerCase()));
  return (
    ALLE_FAGFARGER.find((f) => !sett.has(f)) ??
    ALLE_FAGFARGER[n % ALLE_FAGFARGER.length]
  );
}

/** Trafikklysfargene: fagfarger skal aldri ligne dem. */
const TRAFIKKLYSHEX = ["#3f9d49", "#d9a92f", "#c04a3d"];

/**
 * Om en egen farge er for lik et trafikklys (avstand i RGB), og ville
 * kunne leses som innsats. Gir trafikklyset den ligner, eller null.
 */
export function lignerTrafikklys(hex: string): string | null {
  const rgb = (h: string) =>
    [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const a = rgb(hex);
  for (const t of TRAFIKKLYSHEX) {
    const b = rgb(t);
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 20) return t;
  }
  return null;
}

/**
 * Skåringen som tegn, til tekst uten farge.
 *
 * Markdown har ingen farge, så tekstarkivet (§8) viser skåringen med emoji.
 * To sett, samme skille som i appen: **sirkler** der én skåring står for seg
 * selv — en tabellcelle, en enkeltrad — og **kvadrater** i den sammenhengende
 * stripa, der rutene skal danne en ubrutt linje. Sirkler etterlater hull og
 * leses som prikker.
 *
 * Oppslaget skjer på `skalaverdi.farge`, som `skalafarge` over. Ingen visning
 * skriver emojien selv; da ville to visninger før eller siden ment noe
 * forskjellig med samme farge.
 */
const TEGN = {
  sirkel: { gronn: "🟢", gul: "🟡", rod: "🔴", ingen: "⚪" },
  kvadrat: { gronn: "🟩", gul: "🟨", rod: "🟥", ingen: "⬜" },
} as const;

export type Tegnsett = keyof typeof TEGN;

/**
 * Tegnet for en skalaverdis farge, eller `null` når det ikke finnes noe.
 *
 * `null` betyr «skriv ordet i stedet», ikke «ingen skåring». Unicode har
 * ikke tegn for alle fargene datamodellen tillater, og å sette to emoji ved
 * siden av hverandre er ingen tilnærming — det leses som to skåringer.
 *
 * En økt uten skåring har ingen rad i det hele tatt, og da skal kallstedet
 * skrive ingenting. Det er noe annet enn «ikke i økta», som er en registrert
 * opplysning og får ⚪.
 */
export function skalategn(farge: string | null, sett: Tegnsett): string | null {
  const t: Record<string, string> = TEGN[sett];
  if (farge === null || farge === "") return t.ingen;
  return t[farge] ?? null;
}

/**
 * Fagfargen der den brukes som tekst eller strek. Fagfargene er mørke
 * blekkfarger, laget for lys grunn; i mørk modus lysnes de (`--fag-lys` i
 * index.css), så fagkoden fortsatt kan leses. I lys modus er den uendret.
 */
export function fagfarge(hex: string): string {
  return `color-mix(in srgb, ${hex}, white var(--fag-lys))`;
}

/**
 * Temafargene i samtaletrekkeren (DESIGN.md §10): svake pastelltoner, bare
 * til å kjenne igjen oppgaven. Oppgavenummeret står i en liten rute i
 * fargen, med mørk tekst — også i mørk modus, siden flaten er lys.
 */
export const TEMAFARGER = [
  "#f3dfc6",
  "#d6eadc",
  "#dbe1f4",
  "#f2d9e2",
  "#e4ddf2",
  "#f2ebc4",
  "#d4e9e8",
  "#ecddd2",
] as const;

export const TEMATEKST = "#241f33";

/** Fargen til oppgave nummer `nr` (fra 1). */
export function temafarge(nr: number): string {
  return TEMAFARGER[(nr - 1) % TEMAFARGER.length];
}
