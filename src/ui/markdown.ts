/**
 * Markdown for notatene — et lite, eget utvalg.
 *
 * Notater og møtelogg lagres som ren tekst og går ut som markdown i arkivet
 * (§8), så formatet er allerede markdown. Her tolkes det for visning, og her
 * ligger hjelpen man får mens man skriver.
 *
 * Bevisst lite: overskrifter, punkt- og nummerlister med innrykk,
 * avkrysningsbokser, fet, kursiv og kode. Ingen HTML, ingen lenker som kan
 * åpnes, ingen bilder — tolkningen lager bare tekstbiter, og ingenting fra et
 * notat kan kjøres. Ingen avhengighet.
 */

export type Del =
  | { type: "tekst"; tekst: string }
  | { type: "fet"; deler: Del[] }
  | { type: "kursiv"; deler: Del[] }
  | { type: "kode"; tekst: string };

export type Punkt = {
  /** 0 = ytterst; hvert innrykk (to mellomrom eller tab) er ett nivå */
  niva: number;
  deler: Del[];
  /** null = vanlig punkt; true/false = avkrysningsboks */
  avkrysset: boolean | null;
  /** linjenummeret i teksten, så en avkrysning kan skrives tilbake */
  linje: number;
};

export type Blokk =
  | { type: "overskrift"; niva: 1 | 2 | 3; deler: Del[] }
  | { type: "liste"; ordnet: boolean; start: number; punkter: Punkt[] }
  | { type: "avsnitt"; linjer: Del[][] };

const LISTE = /^(\s*)([-*+]|(\d+)[.)])\s+(.*)$/;
const BOKS = /^\[( |x|X)\]\s+(.*)$/;

function niva(innrykk: string): number {
  return Math.floor(innrykk.replace(/\t/g, "  ").length / 2);
}

/** Deler teksten i blokker: overskrifter, lister og avsnitt. */
export function tolkMarkdown(tekst: string): Blokk[] {
  const linjer = tekst.replace(/\r\n?/g, "\n").split("\n");
  const ut: Blokk[] = [];
  let avsnitt: Del[][] = [];

  const avsluttAvsnitt = () => {
    if (avsnitt.length > 0) ut.push({ type: "avsnitt", linjer: avsnitt });
    avsnitt = [];
  };

  linjer.forEach((linje, nr) => {
    const overskrift = linje.match(/^(#{1,3})\s+(.*)$/);
    if (overskrift) {
      avsluttAvsnitt();
      ut.push({
        type: "overskrift",
        niva: overskrift[1].length as 1 | 2 | 3,
        deler: tolkInline(overskrift[2]),
      });
      return;
    }

    const punkt = linje.match(LISTE);
    if (punkt) {
      avsluttAvsnitt();
      const ordnet = punkt[3] !== undefined;
      const boks = punkt[4].match(BOKS);
      const p: Punkt = {
        niva: niva(punkt[1]),
        deler: tolkInline(boks ? boks[2] : punkt[4]),
        avkrysset: boks ? boks[1].toLowerCase() === "x" : null,
        linje: nr,
      };
      const forrige = ut[ut.length - 1];
      if (forrige?.type === "liste" && forrige.ordnet === ordnet) {
        forrige.punkter.push(p);
      } else {
        ut.push({
          type: "liste",
          ordnet,
          start: ordnet ? Number(punkt[3]) : 1,
          punkter: [p],
        });
      }
      return;
    }

    if (linje.trim() === "") {
      avsluttAvsnitt();
      // En tom linje avslutter også en liste.
      ut.push({ type: "avsnitt", linjer: [] });
      return;
    }

    avsnitt.push(tolkInline(linje));
  });
  avsluttAvsnitt();

  // Tomme avsnitt var bare skiller.
  return ut.filter((b) => b.type !== "avsnitt" || b.linjer.length > 0);
}

/** Fet (**), kursiv (* eller _) og `kode` innen en linje. */
export function tolkInline(tekst: string): Del[] {
  const ut: Del[] = [];
  let rest = tekst;
  const monster =
    /(\*\*(.+?)\*\*)|(`([^`]+)`)|(\*([^*\s][^*]*?)\*)|(\b_([^_\s][^_]*?)_\b)/;

  while (rest.length > 0) {
    const m = rest.match(monster);
    if (!m || m.index === undefined) {
      ut.push({ type: "tekst", tekst: rest });
      break;
    }
    if (m.index > 0) ut.push({ type: "tekst", tekst: rest.slice(0, m.index) });
    if (m[1]) ut.push({ type: "fet", deler: tolkInline(m[2]) });
    else if (m[3]) ut.push({ type: "kode", tekst: m[4] });
    else if (m[5]) ut.push({ type: "kursiv", deler: tolkInline(m[6]) });
    else ut.push({ type: "kursiv", deler: tolkInline(m[8]) });
    rest = rest.slice(m.index + m[0].length);
  }
  return ut;
}

// ---------------------------------------------------------------- skriving

export type Redigering = { tekst: string; start: number; slutt: number };

function linjeRundt(tekst: string, pos: number): [number, number] {
  const fra = tekst.lastIndexOf("\n", pos - 1) + 1;
  const til = tekst.indexOf("\n", pos);
  return [fra, til === -1 ? tekst.length : til];
}

/**
 * Enter i en liste: nytt punkt med samme merke, innrykk og — for nummererte
 * — neste tall. En avkrysningsboks gir en ny, tom boks. Enter på et tomt
 * punkt avslutter lista i stedet. Gir null når markøren ikke står i en liste,
 * og Enter da skal gjøre det vanlige.
 */
export function enterIListe(tekst: string, pos: number): Redigering | null {
  const [fra, til] = linjeRundt(tekst, pos);
  const linje = tekst.slice(fra, til);
  const m = linje.match(LISTE);
  if (!m) return null;

  const [, innrykk, merke, tall, innhold] = m;
  const boks = innhold.match(/^\[( |x|X)\]\s*(.*)$/);
  const tom = (boks ? boks[2] : innhold).trim() === "";

  if (tom) {
    // Tomt punkt: ta bort merket, og la linja stå tom.
    const ny = tekst.slice(0, fra) + tekst.slice(til);
    return { tekst: ny, start: fra, slutt: fra };
  }

  const nyttMerke =
    tall !== undefined ? `${Number(tall) + 1}${merke.slice(-1)}` : merke;
  const prefiks = `\n${innrykk}${nyttMerke} ${boks ? "[ ] " : ""}`;
  const ny = tekst.slice(0, pos) + prefiks + tekst.slice(pos);
  const p = pos + prefiks.length;
  return { tekst: ny, start: p, slutt: p };
}

/** Tab rykker listepunktene i markeringen inn, Shift+Tab ut. */
export function rykk(
  tekst: string,
  start: number,
  slutt: number,
  inn: boolean,
): Redigering | null {
  const [fra] = linjeRundt(tekst, start);
  const [, til] = linjeRundt(tekst, slutt);
  const linjer = tekst.slice(fra, til).split("\n");
  if (!linjer.every((l) => LISTE.test(l) || l.trim() === "")) return null;

  let forskyvStart = 0;
  let forskyvTotal = 0;
  const nye = linjer.map((l, i) => {
    if (l.trim() === "") return l;
    if (inn) {
      if (i === 0) forskyvStart = 2;
      forskyvTotal += 2;
      return "  " + l;
    }
    const fjernes = l.startsWith("  ") ? 2 : l.startsWith("\t") ? 1 : 0;
    if (i === 0) forskyvStart = -fjernes;
    forskyvTotal -= fjernes;
    return l.slice(fjernes);
  });
  const ny = tekst.slice(0, fra) + nye.join("\n") + tekst.slice(til);
  return {
    tekst: ny,
    start: Math.max(fra, start + forskyvStart),
    slutt: slutt + forskyvTotal,
  };
}

/** ⌘B og ⌘I: legger merket rundt markeringen, eller tar det bort igjen. */
export function pakkInn(
  tekst: string,
  start: number,
  slutt: number,
  merke: string,
): Redigering {
  const n = merke.length;
  const innenfor =
    tekst.slice(start - n, start) === merke &&
    tekst.slice(slutt, slutt + n) === merke;
  if (innenfor) {
    const ny =
      tekst.slice(0, start - n) +
      tekst.slice(start, slutt) +
      tekst.slice(slutt + n);
    return { tekst: ny, start: start - n, slutt: slutt - n };
  }
  const ny =
    tekst.slice(0, start) +
    merke +
    tekst.slice(start, slutt) +
    merke +
    tekst.slice(slutt);
  return { tekst: ny, start: start + n, slutt: slutt + n };
}

/** Krysser av eller fjerner avkrysningen på en linje, fra visningen. */
export function vekslBoks(tekst: string, linjenr: number): string {
  const linjer = tekst.split("\n");
  const l = linjer[linjenr];
  if (l === undefined) return tekst;
  linjer[linjenr] = l.replace(
    /^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\]/,
    (_, p, x) => `${p}[${x === " " ? "x" : " "}]`,
  );
  return linjer.join("\n");
}
