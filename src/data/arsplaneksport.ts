import {
  formatDato,
  formatTimer,
  regnskapstekst,
  ukedag,
  type Ark,
  type Arkbolk,
  type Arkrad,
  type Kolonne,
} from "./arsplanark";

/**
 * Årsplanarket som tekst: markdown og CSV. Word ligger for seg i
 * `arsplandocx.ts`, fordi biblioteket er stort og bare lastes når det trengs.
 *
 * Alle leser av samme `Ark`. Det som ikke står der, kan ikke lekke ut her.
 */

/** «MFL1 (SAM3045) — Markedsføring og ledelse 1». Koden i parentes bare
 * når faget har et alias. */
export function tittel(ark: Ark): string {
  const kode = ark.offisiellKode
    ? `${ark.fagKode} (${ark.offisiellKode})`
    : ark.fagKode;
  return `${kode} · ${ark.fagNavn}`;
}

/** Linja under tittelen: år, skole, faglærer og rom — det som finnes av dem. */
export function undertittel(ark: Ark): string {
  return [
    `Årsplan ${ark.skolearNavn}`,
    ark.skole,
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

/** Kolonnene arket har — valgt, og med innhold. */
export function kolonner(ark: Ark): Kolonne[] {
  return ark.kolonner;
}

export const KOLONNENAVN: Record<Kolonne, string> = {
  uke: "Uke",
  dato: "Dato",
  tid: "Tid",
  varighet: "Timer",
  tema: "Tema",
  sted: "Rom",
  agenda: "Agenda",
  lekse: "Lekse",
  maal: "Kompetansemål",
  vurdering: "Vurdering",
};

/**
 * Relativ bredde per kolonne. Prosentene regnes ut fra de kolonnene som er
 * med, så arket fyller bredden uansett hvilke felt som er valgt — og tekst-
 * kolonnene får mest.
 */
const VEKT: Record<Kolonne, number> = {
  uke: 6,
  dato: 19,
  tid: 9,
  varighet: 9,
  tema: 28,
  sted: 9,
  agenda: 26,
  lekse: 22,
  maal: 32,
  vurdering: 16,
};

export function kolonnebredde(kol: Kolonne[], k: Kolonne): number {
  const sum = kol.reduce((s, x) => s + VEKT[x], 0);
  return Math.round((VEKT[k] / sum) * 1000) / 10;
}

/** Teksten i én celle. Ett sted, så alle formatene skriver det likt. */
export function celleverdi(r: Arkrad, k: Kolonne): string {
  switch (k) {
    case "uke":
      return String(r.uke);
    case "dato":
      return `${ukedag(r.dato)} ${formatDato(r.dato)}`;
    case "tid":
      return r.klokkeslett ?? "";
    case "varighet":
      return `${formatTimer(r.varighetMin / 60)} t`;
    case "tema":
      return r.tema ?? "";
    case "sted":
      return r.sted ?? "";
    case "agenda":
      return r.agenda ?? "";
    case "lekse":
      return r.lekse ?? "";
    case "vurdering":
      return r.vurderinger.join(", ");
    case "maal":
      return r.mal.join("; ");
  }
}

// ---------------------------------------------------------------- markdown

function celle(s: string): string {
  // Pipe og linjeskift ville brutt tabellraden.
  return s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
}

export function somMarkdown(ark: Ark): string {
  const ut: string[] = [];
  ut.push(`# ${tittel(ark)}`, "");
  ut.push(undertittel(ark), "");
  if (ark.regnskap) ut.push(regnskapstekst(ark.regnskap), "");

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
    if (b.mal.length > 0) {
      ut.push("Kompetansemål i perioden:", "");
      for (const m of b.mal) ut.push(`- ${m}`);
      ut.push("");
    }
    ut.push(`| ${kol.map((k) => KOLONNENAVN[k]).join(" | ")} |`);
    ut.push(`|${kol.map(() => "---").join("|")}|`);
    for (const r of b.rader) {
      ut.push(`| ${kol.map((k) => celle(celleverdi(r, k))).join(" | ")} |`);
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

  // Kolonnene fra det første arket; valget er det samme for alle fagene.
  // Datoen står som ISO, så regnearket kan sortere på den, med ukedagen for
  // seg. Periode er med når øktene er gruppert.
  const kol = ark[0]?.kolonner ?? [];
  const medPeriode = ark.some((a) => a.bolker.some((b) => b.navn));
  const hode = ["Fag", ...(medPeriode ? ["Periode"] : [])];
  for (const k of kol) {
    if (k === "dato") hode.push("Dato", "Ukedag");
    else hode.push(KOLONNENAVN[k]);
  }

  const rader = [hode];
  for (const a of ark) {
    for (const b of a.bolker) {
      for (const r of b.rader) {
        const rad = [a.fagKode, ...(medPeriode ? [b.navn ?? ""] : [])];
        for (const k of kol) {
          if (k === "dato") rad.push(r.dato, ukedag(r.dato));
          else rad.push(celleverdi(r, k));
        }
        rader.push(rad);
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
