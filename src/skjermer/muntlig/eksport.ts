import { somMarkdown, somTeamsHtml } from "../../data/samtale";
import type { Utlagtdag } from "../../data/tidsplan";
import type { Muntligdata } from "./MuntligArk";

/**
 * Det som går ut av muntlig vurdering: tidsplanen og karakterlista til
 * Teams, og tilbakemeldingene på papir. Bare faglige ting om denne
 * vurderingen; aldri mentorsamtaler, ønsker eller relasjoner.
 */

const rom = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function tilUtklipp(html: string, tekst: string) {
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([tekst], { type: "text/plain" }),
    }),
  ]);
}

/** Tidsplanen, med samtaletrekkerens Teams-tabell (samme kode). */
export async function kopierTidsplan(data: Muntligdata, utlagt: Utlagtdag[]) {
  const navn = new Map(
    data.elever.map((e) => [e.elevId, `${e.fornavn} ${e.etternavn}`]),
  );
  const dager = utlagt.map((d) => ({
    dato: d.dag.dato,
    lunsj: d.lunsj,
    rader: d.rader.map((r) => ({
      navn: navn.get(r.elevId) ?? "",
      tema: data.oppsett.trekkNa
        ? (data.samtale.get(r.elevId)?.tema ?? null)
        : null,
      fra: r.fra,
      til: r.til,
      motte: data.samtale.get(r.elevId)?.motte !== false,
    })),
  }));
  const medTema = data.oppsett.trekkNa && data.kort.length > 0;
  await tilUtklipp(somTeamsHtml(dager, medTema), somMarkdown(dager, medTema));
}

/** Markdown som ren tekst: tegnene tas bort, linjene blir stående. */
export function renTekst(md: string | null): string {
  if (!md) return "";
  return md
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*#{1,6}\s+/, "")
        .replace(/^\s*[-*]\s+\[[ xX]\]\s+/, "")
        .replace(/^\s*[-*]\s+/, "")
        .replace(/^\s*\d+\.\s+/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/_(.+?)_/g, "$1")
        .trim(),
    )
    .filter(Boolean)
    .join(" ");
}

export type Resultatrad = {
  navn: string;
  oppgave: string;
  karakter: string;
  notat: string;
};

/** Karakterlista som Teams-tabell og ren tekst (tabulator mellom). */
export function karakterliste(
  tittel: string,
  rader: Resultatrad[],
  medNotat: boolean,
): { html: string; tekst: string } {
  const hode = ["Elev", "Karakter", ...(medNotat ? ["Kommentar"] : [])];
  const celler = (r: Resultatrad) => [
    r.navn,
    r.karakter,
    ...(medNotat ? [r.notat] : []),
  ];
  const html =
    `<meta charset="utf-8"><p><strong>${rom(tittel)}</strong></p><table><thead><tr>` +
    hode.map((h) => `<th>${h}</th>`).join("") +
    "</tr></thead><tbody>" +
    rader
      .map(
        (r) =>
          "<tr>" +
          celler(r)
            .map((c) => `<td>${rom(c)}</td>`)
            .join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table>";
  const tekst = [hode, ...rader.map(celler)]
    .map((l) => l.join("\t"))
    .join("\n");
  return { html, tekst };
}

export async function kopierKarakterliste(
  tittel: string,
  rader: Resultatrad[],
  medNotat: boolean,
) {
  const { html, tekst } = karakterliste(tittel, rader, medNotat);
  await tilUtklipp(html, tekst);
}
