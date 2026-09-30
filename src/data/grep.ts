/**
 * Fagene fra Udirs Grep-database, SPEC §10.
 *
 * Fila er hentet på **byggetidspunktet** av `hent_grep.py` og pakkes med
 * appen. Appen gjør ingen nettverkskall for å lese den — det er hele
 * poenget: Udir krever API-nøkkel fra 1. september 2026, og ingen kollega
 * skal trenge en for å slå opp et fag.
 *
 * Oppslaget er på **fag**, ikke på læreplan. Læreren tenker i «Markedsføring
 * og ledelse 1» med sin egen fagkode, ikke i læreplanen MFL01-04 som er
 * paraplyen over både MFL1 og MFL2. Kompetansemålene er unike per fag.
 *
 * Lisens: NLOD. Dataene kan kopieres, endres og videreformidles.
 */

export type Kompetansemaal = {
  kode: string;
  tekst: string;
};

export type Bolk = {
  tittel: string;
  beskrivelse: string | null;
};

export type GrepFag = {
  /** fagkoden på vitnemålet, f.eks. SAM3045 */
  fagkode: string | null;
  /** Udirs interne kode for opplæringsfaget, f.eks. MFL1Z03 */
  opplaeringsfag: string;
  navn: string;
  laereplan: string;
  laereplannavn: string;
  beskrivelse: string | null;
  /** årstimetall fra Udirs `omfang-totalt`, f.eks. 140 */
  timer: number | null;
  kjerneelementer: string[];
  tverrfaglige: Bolk[];
  ferdigheter: Bolk[];
  kompetansemaal: Kompetansemaal[];
};

type Fil = {
  hentet: string;
  kilde: string;
  antall_fag: number;
  fag: GrepFag[];
};

let lastet: Promise<GrepFag[]> | null = null;

/**
 * Leser fagfila. Lastes først når noen faktisk søker etter et fag, ikke ved
 * oppstart — den er på noen megabyte, og de fleste øktene i appen trenger
 * den aldri.
 */
export function hentGrepFag(): Promise<GrepFag[]> {
  if (!lastet) {
    lastet = import("../assets/grep-fag.json")
      // Gjennom unknown: formen kommer fra en fil som genereres utenfor
      // prosjektet, så typen her er en påstand, ikke noe kompilatoren kan
      // utlede. `hent_grep.py` og `Fil` må holdes i takt for hånd.
      .then((m) => {
        const fag = (m.default as unknown as Fil).fag ?? [];
        // Fila genereres utenfor prosjektet. Har den feil form — en eldre
        // versjon av hent_grep.py, en halvskrevet fil — skal søket si fra,
        // ikke kaste midt i en tastetrykkhåndterer.
        const gyldig = fag.filter(
          (x) =>
            typeof x?.navn === "string" &&
            typeof x?.opplaeringsfag === "string",
        );
        if (gyldig.length !== fag.length) {
          console.error(
            `grep-fag.json: ${fag.length - gyldig.length} av ${fag.length} rader ` +
              "har feil form. Kjør hent_grep.py på nytt.",
          );
        }
        return gyldig;
      })
      .catch((e) => {
        // Fila mangler hvis noen har bygget uten å kjøre hent_grep.py.
        // Da skal fagvelgeren si det, ikke krasje.
        console.error("grep-fag.json mangler eller er ugyldig:", e);
        return [];
      });
  }
  return lastet;
}

/**
 * Søker i fagnavn og fagkode.
 *
 * Treff på starten av navnet rangeres først — skriver du «mark», er
 * «Markedsføring og ledelse 1» mer sannsynlig enn «Kunst og håndverk med
 * markedsføring». Deretter alfabetisk, så rekkefølgen er forutsigbar.
 */
export async function sokFag(sok: string, grense = 25): Promise<GrepFag[]> {
  const q = sok.trim().toLocaleLowerCase("nb-NO");
  if (q.length < 2) return [];

  const alle = await hentGrepFag();
  const treff = alle.filter(
    (f) =>
      f.navn.toLocaleLowerCase("nb-NO").includes(q) ||
      (f.fagkode ?? "").toLocaleLowerCase("nb-NO").includes(q) ||
      (f.opplaeringsfag ?? "").toLocaleLowerCase("nb-NO").includes(q),
  );

  return treff
    .sort((a, b) => {
      const na = a.navn.toLocaleLowerCase("nb-NO");
      const nb = b.navn.toLocaleLowerCase("nb-NO");
      const sa = na.startsWith(q) ? 0 : 1;
      const sb = nb.startsWith(q) ? 0 : 1;
      return sa !== sb ? sa - sb : na.localeCompare(nb, "nb-NO");
    })
    .slice(0, grense);
}

/** Faget bak en lagret fagkode, til å vise kompetansemålene igjen senere. */
export async function finnFag(fagkode: string | null): Promise<GrepFag | null> {
  if (!fagkode) return null;
  const alle = await hentGrepFag();
  return (
    alle.find((f) => f.fagkode === fagkode) ??
    alle.find((f) => f.opplaeringsfag === fagkode) ??
    null
  );
}
