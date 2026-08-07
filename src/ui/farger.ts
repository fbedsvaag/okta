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
 * Fargene fag skilles med. Dempede blekkfarger — de skal leses som en tynn
 * strek i venstremargen, ikke som en flate (§13). Trafikklyset skal fortsatt
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
