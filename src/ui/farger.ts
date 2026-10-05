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
export const FAGFARGER = [
  "#2f5d8a",
  "#7a4b2a",
  "#3f6b4a",
  "#6b3f5e",
  "#8a6a2f",
  "#4a4a6b",
  "#1f6f74",
  "#8a3f3f",
  "#55618a",
  "#5f7a3a",
  "#7a5a8a",
  "#3f5a3f",
] as const;

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
