import {
  formatDato,
  formatTimer,
  regnskapstekst,
  ukedag,
  type Ark,
  type Arkbolk,
} from "./arsplanark";

/**
 * Årsplanarket som tekst: markdown og CSV. Word ligger for seg i
 * `arsplandocx.ts`, fordi biblioteket er stort og bare lastes når det trengs.
 *
 * Alle leser av samme `Ark`. Det som ikke står der, kan ikke lekke ut her.
 */

/** Linja under tittelen: år, faglærer og rom — det som finnes av dem. */
export function undertittel(ark: Ark): string {
  return [
    `Årsplan ${ark.skolearNavn}`,
    ark.laerer && `Faglærer: ${ark.laerer}`,
    ark.rom && `Rom: ${ark.rom}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** «17.08.26–18.12.26 · 14 økter · 42 timer» for en periodeoverskrift. */
export function bolktekst(b: Arkbolk): string {
  const datoer = b.rader.map((r) => r.dato);
  const fra = formatDato(datoer[0]);
  const til = formatDato(datoer[datoer.length - 1]);
  const spenn = fra === til ? fra : `${fra}–${til}`;
  const n = b.rader.length;
  return `${spenn} · ${n} ${n === 1 ? "økt" : "økter"} · ${formatTimer(b.timer)} t`;
}

/** Kolonnene arket faktisk har. Tomme kolonner utelates. */
export function kolonner(
  ark: Ark,
): ("uke" | "dato" | "tema" | "lekse" | "vurdering")[] {
  return [
    "uke",
    "dato",
    "tema",
    ...(ark.harLekse ? (["lekse"] as const) : []),
    ...(ark.harVurdering ? (["vurdering"] as const) : []),
  ];
}

export const KOLONNENAVN = {
  uke: "Uke",
  dato: "Dato",
  tema: "Tema",
  lekse: "Lekse",
  vurdering: "Vurdering",
} as const;

// ---------------------------------------------------------------- markdown

function celle(s: string): string {
  // Pipe og linjeskift ville brutt tabellraden.
  return s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
}

export function somMarkdown(ark: Ark): string {
  const ut: string[] = [];
  ut.push(`# ${ark.fagKode} — ${ark.fagNavn}`, "");
  ut.push(undertittel(ark), "");
  ut.push(regnskapstekst(ark.regnskap), "");

  if (ark.arknotat) ut.push(ark.arknotat, "");

  if (ark.kompetansemal.length > 0) {
    ut.push("## Kompetansemål", "");
    for (const m of ark.kompetansemal) ut.push(`- ${m.tekst}`);
    ut.push("");
  } else if (ark.kompetansemalFritekst) {
    ut.push("## Kompetansemål", "", ark.kompetansemalFritekst, "");
  }

  const kol = kolonner(ark);
  ut.push("## Økter", "");
  for (const b of ark.bolker) {
    if (b.navn) ut.push(`### ${b.navn}`, "", bolktekst(b), "");
    ut.push(`| ${kol.map((k) => KOLONNENAVN[k]).join(" | ")} |`);
    ut.push(`|${kol.map(() => "---").join("|")}|`);
    for (const r of b.rader) {
      const verdi = {
        uke: String(r.uke),
        dato: `${ukedag(r.dato)} ${formatDato(r.dato)}`,
        tema: r.tema ?? "",
        lekse: r.lekse ?? "",
        vurdering: r.vurderinger.join(", "),
      };
      ut.push(`| ${kol.map((k) => celle(verdi[k])).join(" | ")} |`);
    }
    ut.push("");
  }

  ut.push("*Med forbehold om endringer.*", "");
  return ut.join("\n");
}

// --------------------------------------------------------------------- csv

/**
 * Semikolon og BOM, fordi det er det Excel med norsk oppsett venter seg.
 * Med komma havner hele raden i én celle, uten BOM blir æøå til rot.
 *
 * Tar flere ark, med fagkoden i første kolonne, slik at «alle fag» blir én
 * tabell som kan filtreres i regnearket.
 */
export function somCsv(ark: Ark[]): string {
  const felt = (s: string) =>
    /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;

  const rader = [
    [
      "Fag",
      "Uke",
      "Dato",
      "Ukedag",
      "Periode",
      "Tema",
      "Lekse",
      "Vurdering",
      "Timer",
    ],
  ];
  for (const a of ark) {
    for (const b of a.bolker) {
      for (const r of b.rader) {
        rader.push([
          a.fagKode,
          String(r.uke),
          r.dato,
          ukedag(r.dato),
          b.navn ?? "",
          r.tema ?? "",
          r.lekse ?? "",
          r.vurderinger.join(", "),
          formatTimer(r.varighetMin / 60),
        ]);
      }
    }
  }
  return (
    "\uFEFF" + rader.map((r) => r.map(felt).join(";")).join("\r\n") + "\r\n"
  );
}

/** Flere fag i én markdown: ett dokument per fag, skilt med en strek. */
export function somMarkdownFlere(ark: Ark[]): string {
  return ark.map(somMarkdown).join("\n---\n\n");
}
