import { hent, oppdater, settInn, slett } from "../db";
import { knyttOkt, losOkt } from "./vurderinger";

/**
 * Samtaler, SPEC §3.6 og §4.10.
 *
 * Den rene logikken ligger øverst og kjenner ingen database: å legge ut en
 * dag, regne kapasitet, trekke rekkefølge og lese historikk er regnestykker
 * som skal kunne prøves uten å skrive noe.
 */

// --------------------------------------------------------------------- tid

export function tilMin(klokke: string): number {
  const [t, m] = klokke.split(":").map(Number);
  return (t || 0) * 60 + (m || 0);
}

export function tilKlokke(min: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(min / 60))}:${p(min % 60)}`;
}

// ------------------------------------------------------------ dagen lagt ut

export type Dagoppsett = {
  fra: string;
  til: string;
  /** NULL = ingen lunsj */
  lunsjFra: string | null;
  lunsjMin: number | null;
};

export type Slot =
  | { type: "samtale"; plass: number; fra: number; til: number }
  | { type: "lunsj"; fra: number; til: number };

/**
 * Legger ut dagen slot for slot.
 *
 * Lunsjen legges inn ved første samtalegrense på eller etter tidspunktet —
 * en samtale deles aldri i to. Derfor kan en pause satt til 11:45 i praksis
 * begynne 11:55, og timeplanen viser det faktiske tidspunktet.
 *
 * Rekker dagen aldri fram til lunsjen, legges det ingen lunsj inn. En pause
 * etter siste samtale er ikke en pause — det er en feil HTML-verktøyet gjorde,
 * og den videreføres ikke.
 */
export function leggUtDagen(
  dag: Dagoppsett,
  antall: number,
  samtaletid: number,
  pause: number,
): Slot[] {
  if (samtaletid <= 0 || antall <= 0) return [];

  const slutt = tilMin(dag.til);
  const lunsjFra = dag.lunsjFra ? tilMin(dag.lunsjFra) : null;
  const lunsjMin = dag.lunsjMin ?? 0;

  const slots: Slot[] = [];
  let na = tilMin(dag.fra);
  let lunsjLagt = false;

  for (let i = 0; i < antall; i++) {
    // Lunsjen først, men bare når det faktisk kommer en samtale etter den.
    if (!lunsjLagt && lunsjFra !== null && lunsjMin > 0 && na >= lunsjFra) {
      if (na + lunsjMin + samtaletid > slutt) break;
      slots.push({ type: "lunsj", fra: na, til: na + lunsjMin });
      na += lunsjMin;
      lunsjLagt = true;
    }

    if (na + samtaletid > slutt) break;

    slots.push({ type: "samtale", plass: i, fra: na, til: na + samtaletid });
    na += samtaletid + pause;
  }

  return slots;
}

/**
 * Hvor mange samtaler dagen har plass til.
 *
 * Regnet ved å legge ut dagen, ikke med en formel. Om lunsjen nås avhenger av
 * hvor mange samtaler som får plass, som er det vi skal finne — en formel
 * måtte gjettet på sin egen forutsetning.
 */
export function kapasitet(
  dag: Dagoppsett,
  samtaletid: number,
  pause: number,
): number {
  const tak = Math.max(
    0,
    Math.ceil((tilMin(dag.til) - tilMin(dag.fra)) / Math.max(1, samtaletid)) +
      2,
  );
  return leggUtDagen(dag, tak, samtaletid, pause).filter(
    (s) => s.type === "samtale",
  ).length;
}

/**
 * Timene dagen legger beslag på, til timeregnskapet (§4.2).
 *
 * Her holder en enklere regel enn i kapasiteten: lunsjen trekkes fra når den
 * ligger innenfor dagens spenn. Regnskapet handler om dagen som er satt av,
 * ikke om hvordan samtalene falt.
 */
export function timerPaDagen(dag: Dagoppsett): number {
  const fra = tilMin(dag.fra);
  const til = tilMin(dag.til);
  if (til <= fra) return 0;

  const lunsj =
    dag.lunsjFra &&
    dag.lunsjMin &&
    tilMin(dag.lunsjFra) >= fra &&
    tilMin(dag.lunsjFra) < til
      ? dag.lunsjMin
      : 0;

  return Math.round(((til - fra - lunsj) / 60) * 10) / 10;
}

/** Fordeler elevene på dagene i rekkefølge, så langt kapasiteten rekker. */
export function fordelPaDager(antall: number, kapasiteter: number[]): number[] {
  const ut: number[] = [];
  let igjen = antall;
  for (const kap of kapasiteter) {
    const p = Math.max(0, Math.min(igjen, kap));
    ut.push(p);
    igjen -= p;
  }
  return ut;
}

// ------------------------------------------------------------------ trekning

/** Stokker en liste. Tilfeldigheten sendes inn, så trekningen kan prøves. */
export function stokk<T>(
  liste: T[],
  tilfeldig: () => number = Math.random,
): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(tilfeldig() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------------ grupper

/**
 * Gruppesamtaler: en gruppe er én plass i timeplanen, med ett tema og én
 * lås, akkurat som en enkelt elev. Trekningen behandler den som en enhet;
 * først når den lagres, får hver elev sin egen rad — på samme klokkeslett.
 *
 * En enhet med én elev har elevens id. En gruppe får en id laget av
 * medlemmene, så den kan kjennes igjen og pakkes ut igjen.
 */
const GRUPPE = "g:";

export function enhetId(medlemmer: string[]): string {
  return medlemmer.length === 1 ? medlemmer[0] : GRUPPE + medlemmer.join("+");
}

export function medlemmerAv(enhet: string): string[] {
  return enhet.startsWith(GRUPPE)
    ? enhet.slice(GRUPPE.length).split("+")
    : [enhet];
}

/**
 * Deler en ordnet elevliste i grupper på `storrelse`.
 *
 * Går det ikke opp, blir de siste gruppene én større — 25 elever i par gir
 * elleve par og én trio. Ingen sitter igjen alene. Er det færre elever enn
 * gruppestørrelsen, blir alle én gruppe.
 */
export function delIGrupper(ider: string[], storrelse: number): string[][] {
  if (storrelse <= 1) return ider.map((id) => [id]);
  const antall = Math.max(1, Math.floor(ider.length / storrelse));
  const rest = ider.length - antall * storrelse;
  const ut: string[][] = [];
  let i = 0;
  for (let g = 0; g < antall; g++) {
    // Resten legges på de siste gruppene, én hver.
    const n = storrelse + (g >= antall - rest ? 1 : 0);
    ut.push(ider.slice(i, i + n));
    i += n;
  }
  // Bare når det er færre elever enn én gruppe, er rest negativ.
  if (i < ider.length) ut[ut.length - 1].push(...ider.slice(i));
  return ut;
}

/**
 * Samler lagrede samtaler til plasser igjen: elever på samme klokkeslett
 * samme dag er én gruppesamtale. Rekkefølgen følger klokka.
 */
export function samlePaTid<T extends { klokkeslett: string }>(
  rader: T[],
): T[][] {
  const kart = new Map<string, T[]>();
  for (const r of rader)
    kart.set(r.klokkeslett, [...(kart.get(r.klokkeslett) ?? []), r]);
  return [...kart.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, gr]) => gr);
}

/** Hvor mange plasser elevene trenger med denne gruppestørrelsen. */
export function antallEnheter(elever: number, storrelse: number): number {
  if (elever === 0) return 0;
  return storrelse <= 1 ? elever : Math.max(1, Math.floor(elever / storrelse));
}

/**
 * Flytter én elev over i en annen enhet. Enhetene er lister per dag; den
 * eleven kom fra blir borte om den blir tom. Gir de nye enhetene, og et kart
 * fra gammel til ny id — så tema og lås kan følge med.
 */
export function flyttTilEnhet(
  perDag: string[][],
  elevId: string,
  til: { dag: number; rad: number },
): { perDag: string[][]; nyId: Map<string, string> } {
  const nyId = new Map<string, string>();
  const ut = perDag.map((d) => d.map((e) => medlemmerAv(e)));
  const malGammel = perDag[til.dag]?.[til.rad];
  if (!malGammel || medlemmerAv(malGammel).includes(elevId))
    return { perDag, nyId };

  for (let d = 0; d < ut.length; d++) {
    for (let r = 0; r < ut[d].length; r++) {
      if (ut[d][r].includes(elevId))
        ut[d][r] = ut[d][r].filter((x) => x !== elevId);
    }
  }
  ut[til.dag][til.rad] = [...ut[til.dag][til.rad], elevId];

  const ny = ut.map((d, di) =>
    d
      .map((m, ri) => {
        const gammel = perDag[di][ri];
        if (m.length === 0) return null;
        const id = enhetId(m);
        nyId.set(gammel, id);
        return id;
      })
      .filter((x): x is string => x !== null),
  );
  return { perDag: ny, nyId };
}

/** Temaene fordeles jevnt og tilfeldig — like mange av hvert, så langt det går. */
export function tildelTema(
  elevIder: string[],
  temaer: string[],
  tilfeldig: () => number = Math.random,
): Map<string, string> {
  const ut = new Map<string, string>();
  if (temaer.length === 0) return ut;

  const stokket = stokk(temaer, tilfeldig);
  elevIder.forEach((id, i) => ut.set(id, stokket[i % stokket.length]));
  return ut;
}

/**
 * Deler en ferdig ordnet liste på dagene, etter kapasitet.
 *
 * Skilt fra trekningen fordi rekkefølgen kan komme to veier: stokket, eller
 * vektet mot gjentakelse (§4.10). Delingen er den samme uansett.
 */
export function delPaDager(
  ordnet: string[],
  kapasiteter: number[],
): string[][] {
  const fordelt = fordelPaDager(ordnet.length, kapasiteter);
  const ut: string[][] = [];
  let i = 0;
  for (const antall of fordelt) {
    ut.push(ordnet.slice(i, i + antall));
    i += antall;
  }
  return ut;
}

/** Fordeler elevene på dagene og trekker rekkefølgen innen hver dag. */
export function trekkRekkefolge(
  elevIder: string[],
  kapasiteter: number[],
  tilfeldig: () => number = Math.random,
): string[][] {
  return delPaDager(stokk(elevIder, tilfeldig), kapasiteter);
}

/**
 * Trekker rekkefølgen om igjen, med låste elever stående.
 *
 * Omtrekningen skjer innen hver dag: dagene har hver sin kapasitet, og å
 * flytte noen mellom dem ville stilt spørsmål om hvem som må ut. En låst elev
 * blir i sin plass, og de andre stokkes rundt hen.
 */
export function trekkOmRekkefolge(
  perDag: string[][],
  laste: ReadonlySet<string>,
  tilfeldig: () => number = Math.random,
): string[][] {
  return perDag.map((dagen) => {
    const losse = stokk(
      dagen.filter((id) => !laste.has(id)),
      tilfeldig,
    );
    let i = 0;
    return dagen.map((id) => (laste.has(id) ? id : losse[i++]));
  });
}

/**
 * Fordeler temaene om igjen, med låste elever på sitt.
 *
 * De låste holder temaet de har; resten får en ny runde av temalista.
 */
export function trekkOmTema(
  ider: string[],
  gjeldende: Map<string, string>,
  laste: ReadonlySet<string>,
  temaer: string[],
  tilfeldig: () => number = Math.random,
): Map<string, string> {
  if (temaer.length === 0) return new Map();

  const losse = ider.filter((id) => !laste.has(id));
  const nye = tildelTema(losse, temaer, tilfeldig);

  const ut = new Map<string, string>();
  for (const id of ider) {
    const verdi = laste.has(id) ? gjeldende.get(id) : nye.get(id);
    if (verdi !== undefined) ut.set(id, verdi);
  }
  return ut;
}

/**
 * Flytter en rad innen dagen.
 *
 * Tar raden ut og setter den inn igjen på ny plass, så de mellomliggende
 * skyves én vei — ikke bytter plass parvis, som ville flyttet to elever når
 * man dro én.
 */
export function flyttInnenDagen<T>(rader: T[], fra: number, til: number): T[] {
  if (fra === til || fra < 0 || til < 0) return rader;
  if (fra >= rader.length || til >= rader.length) return rader;

  const ut = [...rader];
  const [flyttet] = ut.splice(fra, 1);
  ut.splice(til, 0, flyttet);
  return ut;
}

/**
 * Flytter en elev til en annen dag i trekningen.
 *
 * Har måldagen ledig plass, settes eleven inn der (`etter` = etter raden
 * det ble sluppet på), og dagen den kom fra får én mindre. Er måldagen full,
 * bytter de to elevene plass i stedet — da holder begge dagene kapasiteten
 * sin, og ingen må ut. `byttet` sier hvilken av de to som skjedde.
 */
export function flyttMellomDager<T>(
  perDag: T[][],
  kapasiteter: number[],
  fra: { dag: number; rad: number },
  til: { dag: number; rad: number; etter: boolean },
): { perDag: T[][]; byttet: T | null } {
  const ut = perDag.map((d) => [...d]);
  const kilde = ut[fra.dag];
  const mal = ut[til.dag];
  if (!kilde || !mal || fra.rad >= kilde.length)
    return { perDag, byttet: null };

  if (mal.length < (kapasiteter[til.dag] ?? 0)) {
    const [elev] = kilde.splice(fra.rad, 1);
    mal.splice(Math.min(til.rad + (til.etter ? 1 : 0), mal.length), 0, elev);
    return { perDag: ut, byttet: null };
  }

  if (til.rad >= mal.length) return { perDag, byttet: null };
  const byttet = mal[til.rad];
  mal[til.rad] = kilde[fra.rad];
  kilde[fra.rad] = byttet;
  return { perDag: ut, byttet };
}

/**
 * Finner lunsjen i en ferdig lagret dag.
 *
 * Pausen lagres ikke som en rad — den utledes av hullet mellom to samtaler.
 * Ett sted å skrive, og ingen verdi som kan komme i utakt med klokkeslettene.
 */
export function finnLunsj(
  rader: { fra: string; til: string }[],
  dag: Dagoppsett,
): { fra: string; til: string } | null {
  if (!dag.lunsjFra || !dag.lunsjMin) return null;

  const sortert = [...rader].sort((a, b) => a.fra.localeCompare(b.fra));
  for (let i = 0; i < sortert.length - 1; i++) {
    const slutt = tilMin(sortert[i].til);
    const neste = tilMin(sortert[i + 1].fra);
    if (neste - slutt >= dag.lunsjMin) {
      return { fra: tilKlokke(slutt), til: tilKlokke(slutt + dag.lunsjMin) };
    }
  }
  return null;
}

// ----------------------------------------------------------------- historikk

export type Plassering = "tidlig" | "midt" | "sent";

/**
 * Hvor i dagen en plass ligger, regnet i tredjedeler av dagens egen rekke.
 *
 * Et fast antall ville betydd ulike ting på en dag med seks og en med tolv.
 * Under tre elever gir null — der er det ingenting å sammenlikne.
 */
export function plassering(indeks: number, antall: number): Plassering | null {
  if (antall < 3 || indeks < 0 || indeks >= antall) return null;
  if (indeks < antall / 3) return "tidlig";
  if (indeks >= (antall * 2) / 3) return "sent";
  return "midt";
}

/**
 * Merknaden som står ved navnet, eller null når det ikke er noe å si.
 *
 * `nyesteForst` er elevens plasseringer, nyeste først. De fleste har ingenting
 * stående — og det er nettopp derfor de som har det er verdt å se på.
 */
export function merknad(nyesteForst: Plassering[]): string | null {
  const nyeste = nyesteForst[0];
  if (!nyeste || nyeste === "midt") return null;

  let antall = 1;
  while (nyesteForst[antall] === nyeste) antall++;

  return antall === 1 ? `${nyeste} sist` : `${nyeste} ${antall}× på rad`;
}

/**
 * Rekkefølge vektet mot gjentakelse. Av som standard i UI-et (§4.10).
 *
 * En tyngde, ikke en rotasjon: elever med nylig «tidlig» skyves mot senere
 * plasser og omvendt, men tilfeldigheten dominerer fortsatt. Uten det blir
 * køen forutsigbar på en annen måte enn den var.
 */
export function vektetRekkefolge(
  elevIder: string[],
  historikk: Map<string, Plassering[]>,
  tilfeldig: () => number = Math.random,
): string[] {
  const vekt = (id: string) => {
    const nyeste = historikk.get(id) ?? [];
    let sum = 0;
    // Bare de tre siste teller, og det nyeste tyngst.
    for (let i = 0; i < Math.min(3, nyeste.length); i++) {
      const styrke = 1 / (i + 1);
      if (nyeste[i] === "tidlig") sum += styrke;
      if (nyeste[i] === "sent") sum -= styrke;
    }
    return sum;
  };

  return [...elevIder]
    .map((id) => ({ id, tall: vekt(id) + tilfeldig() * 2 }))
    .sort((a, b) => a.tall - b.tall)
    .map((x) => x.id);
}

/**
 * Samtaledagene samlet i trekninger, så de kan finnes igjen.
 *
 * En trekning er dagene som deler fag — eller mangelen på fag, som er
 * mentorsamtalen. Uten dette er en trekning bare synlig hvis man tilfeldigvis
 * står på riktig modus og fag når skjermen åpnes.
 */
export type Trekning = {
  skolearFagId: string | null;
  fagKode: string | null;
  dager: Samtaledag[];
  antall: number;
  forste: string;
  siste: string;
};

export function grupperTrekninger(dager: Samtaledag[]): Trekning[] {
  const kart = new Map<string, Samtaledag[]>();
  for (const d of dager) {
    const nokkel = d.skolearFagId ?? "";
    kart.set(nokkel, [...(kart.get(nokkel) ?? []), d]);
  }

  return [...kart.values()]
    .map((gruppe) => {
      const sortert = [...gruppe].sort((a, b) => a.dato.localeCompare(b.dato));
      const medDato = sortert.filter((d) => d.dato !== "");
      return {
        skolearFagId: sortert[0].skolearFagId,
        fagKode: sortert[0].fagKode,
        dager: sortert,
        antall: sortert.reduce((n, d) => n + d.antall, 0),
        forste: medDato[0]?.dato ?? "",
        siste: medDato[medDato.length - 1]?.dato ?? "",
      };
    })
    .sort((a, b) => (b.forste || "").localeCompare(a.forste || ""));
}

/**
 * Dagens samtaler, som en setning.
 *
 * Sier hva som venter deg, ikke bare at noe skjer: hvem du begynner med, når,
 * hvor mange som står igjen og når du er ferdig. Har dagen begynt, teller den
 * fra den neste — ikke fra den første, som kan være unnagjort for to timer
 * siden.
 */
export function dagenssetning(
  samtaler: { fornavn: string; klokkeslett: string; varighetMin: number }[],
  na: string,
  erMentor: boolean,
): string | null {
  if (samtaler.length === 0) return null;

  const sortert = [...samtaler].sort((a, b) =>
    a.klokkeslett.localeCompare(b.klokkeslett),
  );
  const sisteSlutt = sortert.reduce(
    (m, s) => Math.max(m, tilMin(s.klokkeslett) + s.varighetMin),
    0,
  );
  const hva = erMentor ? "Mentorsamtaler" : "Samtaler";

  const igjen = sortert.filter((s) => s.klokkeslett >= na);
  if (igjen.length === 0) {
    return `${hva} i dag. Alle ${sortert.length} er unnagjort.`;
  }

  const neste = igjen[0];
  const etter = igjen.length - 1;
  const start = `${hva} i dag. Du ${
    igjen.length === sortert.length ? "begynner" : "fortsetter"
  } med ${neste.fornavn} kl. ${neste.klokkeslett}`;

  if (etter === 0) return `${start}, og det er den siste.`;
  return `${start}, før du har ${etter} ${
    etter === 1 ? "elev" : "elever"
  } fram til kl. ${tilKlokke(sisteSlutt)}.`;
}

/** Samtalene på en gitt dato, på tvers av fag og mentorgruppe. */
export async function hentSamtalerPaDato(
  skolearId: string,
  dato: string,
): Promise<
  {
    fornavn: string;
    etternavn: string;
    klokkeslett: string;
    varighetMin: number;
    erMentor: boolean;
  }[]
> {
  return hent(
    `SELECT e.fornavn, e.etternavn,
            s.klokkeslett,
            s.varighet_min AS varighetMin,
            (d.skolear_fag_id IS NULL) AS erMentor
       FROM samtale s
       JOIN samtaledag d ON d.id = s.samtaledag_id AND d.slettet IS NULL
       JOIN elev e ON e.id = s.elev_id AND e.slettet IS NULL
      WHERE d.skolear_id = $1 AND d.dato = $2
        AND s.slettet IS NULL AND s.motte = 1
      ORDER BY s.klokkeslett`,
    [skolearId, dato],
  );
}

// ------------------------------------------------------------------ eksport

export type Eksportdag = {
  dato: string;
  lunsj: { fra: string; til: string } | null;
  rader: {
    navn: string;
    tema: string | null;
    fra: string;
    til: string;
    motte: boolean;
  }[];
};

function langDato(dato: string): string {
  if (!dato) return "Dato ikke satt";
  const d = new Date(`${dato}T00:00:00`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/**
 * Trekningen som markdown.
 *
 * Følger modus på samme måte som Teams-eksporten: oppgavekolonnen utelates i
 * mentorsamtale. HTML-verktøyet skrev den ut uansett, og det var en
 * inkonsekvens, ikke et valg.
 */
export function somMarkdown(dager: Eksportdag[], medTema: boolean): string {
  const ut: string[] = [];

  for (const dag of dager) {
    ut.push(`## ${langDato(dag.dato)}`, "");
    ut.push(medTema ? "| # | Navn | Oppgave | Tid |" : "| # | Navn | Tid |");
    ut.push(medTema ? "|---|------|---------|-----|" : "|---|------|-----|");

    let nr = 0;
    for (const rad of medLunsj(dag)) {
      if (rad.type === "lunsj") {
        ut.push(
          medTema
            ? `| — | *Lunsj* | — | ${rad.fra}–${rad.til} |`
            : `| — | *Lunsj* | ${rad.fra}–${rad.til} |`,
        );
        continue;
      }
      nr++;
      const navn = rad.motte ? rad.navn : `${rad.navn} (møtte ikke)`;
      ut.push(
        medTema
          ? `| ${nr} | ${navn} | ${rad.tema ?? ""} | ${rad.fra}–${rad.til} |`
          : `| ${nr} | ${navn} | ${rad.fra}–${rad.til} |`,
      );
    }
    ut.push("");
  }
  return ut.join("\n");
}

/** Trekningen som tabell-HTML, til å lime inn i Teams. */
export function somTeamsHtml(dager: Eksportdag[], medTema: boolean): string {
  const rom = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let ut = '<meta charset="utf-8">';
  for (const dag of dager) {
    ut += `<p><strong>${rom(langDato(dag.dato))}</strong></p><table><thead><tr><th>#</th><th>Navn</th>`;
    if (medTema) ut += "<th>Oppgave</th>";
    ut += "<th>Tid</th></tr></thead><tbody>";

    let nr = 0;
    for (const rad of medLunsj(dag)) {
      if (rad.type === "lunsj") {
        ut += `<tr><td>—</td><td><em>Lunsj</em></td>${medTema ? "<td>—</td>" : ""}<td>${rad.fra}–${rad.til}</td></tr>`;
        continue;
      }
      nr++;
      const navn = rad.motte ? rad.navn : `${rad.navn} (møtte ikke)`;
      ut += `<tr><td>${nr}</td><td>${rom(navn)}</td>`;
      if (medTema) ut += `<td>${rom(rad.tema ?? "")}</td>`;
      ut += `<td>${rad.fra}–${rad.til}</td></tr>`;
    }
    ut += "</tbody></table><br>";
  }
  return ut;
}

export type Eksportrad =
  | ({ type: "samtale" } & Eksportdag["rader"][number])
  | { type: "lunsj"; fra: string; til: string };

/** Radene med lunsjen satt inn på sin plass. */
export function medLunsj(dag: Eksportdag): Eksportrad[] {
  const rader = dag.rader.map((r) => ({ type: "samtale" as const, ...r }));
  if (!dag.lunsj) return rader;

  const etter = rader.findIndex((r) => r.fra >= dag.lunsj!.til);
  const lunsj = { type: "lunsj" as const, ...dag.lunsj };
  if (etter < 0) return [...rader, lunsj];
  return [...rader.slice(0, etter), lunsj, ...rader.slice(etter)];
}

// ------------------------------------------------------------------ databasen

export type Samtaledag = {
  id: string;
  skolearId: string;
  skolearFagId: string | null;
  fagKode: string | null;
  vurderingId: string | null;
  /**
   * Økta dagen ligger i. Da er øktas start og slutt rammen, og timene er
   * allerede talt som økt. null = en egen dag, eller økta er slettet.
   */
  oktId: string | null;
  dato: string;
  fra: string;
  til: string;
  lunsjFra: string | null;
  lunsjMin: number | null;
  /** hvor mange samtaler som er trukket på dagen */
  antall: number;
};

export type Samtale = {
  id: string;
  samtaledagId: string;
  elevId: string;
  fornavn: string;
  etternavn: string;
  klokkeslett: string;
  varighetMin: number;
  tema: string | null;
  motte: boolean;
};

export async function hentSamtaledager(
  skolearId: string,
): Promise<Samtaledag[]> {
  return hent<Samtaledag>(
    `SELECT d.id,
            d.skolear_id     AS skolearId,
            d.skolear_fag_id AS skolearFagId,
            f.kode           AS fagKode,
            d.vurdering_id   AS vurderingId,
            o.id             AS oktId,
            d.dato, d.fra, d.til,
            d.lunsj_fra      AS lunsjFra,
            d.lunsj_min      AS lunsjMin,
            (SELECT COUNT(*) FROM samtale s
              WHERE s.samtaledag_id = d.id AND s.slettet IS NULL) AS antall
       FROM samtaledag d
       LEFT JOIN skolear_fag sf ON sf.id = d.skolear_fag_id AND sf.slettet IS NULL
       LEFT JOIN fag f ON f.id = sf.fag_id AND f.slettet IS NULL
       -- Er økta slettet, blir dagen en vanlig samtaledag igjen.
       LEFT JOIN okt o ON o.id = d.okt_id AND o.slettet IS NULL
      WHERE d.skolear_id = $1 AND d.slettet IS NULL
      ORDER BY d.dato, d.fra`,
    [skolearId],
  );
}

export async function hentSamtaler(samtaledagId: string): Promise<Samtale[]> {
  const rader = await hent<Omit<Samtale, "motte"> & { motte: number }>(
    `SELECT s.id,
            s.samtaledag_id AS samtaledagId,
            s.elev_id       AS elevId,
            e.fornavn, e.etternavn,
            s.klokkeslett,
            s.varighet_min  AS varighetMin,
            s.tema, s.motte
       FROM samtale s
       JOIN elev e ON e.id = s.elev_id AND e.slettet IS NULL
      WHERE s.samtaledag_id = $1 AND s.slettet IS NULL
      ORDER BY s.klokkeslett`,
    [samtaledagId],
  );
  return rader.map((r) => ({ ...r, motte: r.motte === 1 }));
}

export async function opprettSamtaledag(
  skolearId: string,
  felter: {
    skolearFagId: string | null;
    vurderingId?: string | null;
    dato: string;
    fra: string;
    til: string;
    lunsjFra: string | null;
    lunsjMin: number | null;
  },
): Promise<string> {
  return settInn("samtaledag", {
    skolear_id: skolearId,
    skolear_fag_id: felter.skolearFagId,
    vurdering_id: felter.vurderingId ?? null,
    okt_id: null,
    dato: felter.dato,
    fra: felter.fra,
    til: felter.til,
    lunsj_fra: felter.lunsjFra,
    lunsj_min: felter.lunsjMin,
  });
}

/**
 * Legger en samtaledag i en økt, SPEC §4.10.
 *
 * Øktas klokkeslett og varighet er rammen, og det er ingen lunsj: økta er
 * allerede en blokk i timeplanen. Hører trekningen til en vurdering, knyttes
 * vurderingen til økta, så den står der i årsplanen.
 *
 * En økt uten klokkeslett har ingen ramme å legge samtalene i — da gjøres
 * ingenting, og null kommer tilbake.
 */
export async function leggDagIOkt(
  skolearId: string,
  oktId: string,
  vurderingId: string | null,
): Promise<string | null> {
  const [o] = await hent<{
    skolearFagId: string;
    dato: string;
    klokkeslett: string | null;
    varighetMin: number;
  }>(
    `SELECT skolear_fag_id AS skolearFagId, dato, klokkeslett,
            varighet_min AS varighetMin
       FROM okt WHERE id = $1 AND slettet IS NULL`,
    [oktId],
  );
  if (!o?.klokkeslett) return null;

  const id = await settInn("samtaledag", {
    skolear_id: skolearId,
    skolear_fag_id: o.skolearFagId,
    vurdering_id: vurderingId,
    okt_id: oktId,
    dato: o.dato,
    fra: o.klokkeslett,
    til: tilKlokke(tilMin(o.klokkeslett) + o.varighetMin),
    lunsj_fra: null,
    lunsj_min: null,
  });
  if (vurderingId) await knyttOkt(vurderingId, oktId);
  return id;
}

/**
 * Tar samtaledagen ut av økta igjen: dagen og samtalene på den forsvinner,
 * og vurderingen løses fra økta.
 */
export async function fjernDagFraOkt(samtaledagId: string): Promise<void> {
  const [d] = await hent<{ oktId: string | null; vurderingId: string | null }>(
    `SELECT okt_id AS oktId, vurdering_id AS vurderingId
       FROM samtaledag WHERE id = $1`,
    [samtaledagId],
  );
  await slettSamtaledag(samtaledagId);
  if (d?.oktId && d.vurderingId) await losOkt(d.vurderingId, d.oktId);
}

/**
 * Bytter vurderingen trekningen hører til, for alle dagene. Dager som ligger
 * i en økt, flytter koblingen med seg: den gamle vurderingen løses fra økta,
 * den nye knyttes.
 */
export async function settTrekningensVurdering(
  dager: Samtaledag[],
  vurderingId: string | null,
): Promise<void> {
  for (const d of dager) {
    if (d.oktId && d.vurderingId) await losOkt(d.vurderingId, d.oktId);
    await oppdater("samtaledag", d.id, { vurdering_id: vurderingId });
    if (d.oktId && vurderingId) await knyttOkt(vurderingId, d.oktId);
  }
}

export async function endreSamtaledag(
  id: string,
  felter: Record<string, unknown>,
): Promise<void> {
  await oppdater("samtaledag", id, felter);
}

export async function slettSamtaledag(id: string): Promise<void> {
  const rader = await hent<{ id: string }>(
    "SELECT id FROM samtale WHERE samtaledag_id = $1 AND slettet IS NULL",
    [id],
  );
  for (const r of rader) await slett("samtale", r.id);
  await slett("samtaledag", id);
}

/**
 * Skriver en trekning til en dag.
 *
 * **Raden gjenbrukes når eleven er med videre.** En elev som bare bytter
 * klokkeslett beholder sin `samtale.id`, og da oppdateres kalenderhendelsen
 * i stedet for å bli slettet og lagt inn på nytt (§8.1) — ellers ville en
 * omstokking fått hendelser til å forsvinne og dukke opp igjen i kalenderen
 * til alle som abonnerer.
 *
 * Samtaler der eleven ikke møtte blir stående urørt: de er en opplysning om
 * hva som skjedde, ikke en del av planen som trekkes om.
 */
export async function lagreTrekning(
  samtaledagId: string,
  samtaler: {
    elevId: string;
    klokkeslett: string;
    varighetMin: number;
    tema: string | null;
  }[],
): Promise<void> {
  const gamle = await hent<{ id: string; elevId: string; motte: number }>(
    `SELECT id, elev_id AS elevId, motte
       FROM samtale WHERE samtaledag_id = $1 AND slettet IS NULL`,
    [samtaledagId],
  );

  const ledige = new Map<string, string>();
  for (const g of gamle) {
    if (g.motte === 1 && !ledige.has(g.elevId)) ledige.set(g.elevId, g.id);
  }

  const brukt = new Set<string>();
  for (const s of samtaler) {
    const finnes = ledige.get(s.elevId);
    if (finnes) {
      brukt.add(finnes);
      await oppdater("samtale", finnes, {
        klokkeslett: s.klokkeslett,
        varighet_min: s.varighetMin,
        tema: s.tema,
      });
      continue;
    }
    await settInn("samtale", {
      samtaledag_id: samtaledagId,
      elev_id: s.elevId,
      klokkeslett: s.klokkeslett,
      varighet_min: s.varighetMin,
      tema: s.tema,
      motte: 1,
    });
  }

  // Elever som ikke er med i den nye trekningen faller ut.
  for (const g of gamle) {
    if (g.motte === 1 && !brukt.has(g.id)) await slett("samtale", g.id);
  }
}

/** Markerer at eleven ikke møtte, uten at noe annet flyttes (§4.10). */
export async function settMotte(id: string, motte: boolean): Promise<void> {
  await oppdater("samtale", id, { motte: motte ? 1 : 0 });
}

/**
 * Historikken per elev i året, nyeste først.
 *
 * Samtaler der eleven ikke møtte teller ikke: hen var ikke der, og
 * plasseringen sier da ingenting om når hen faktisk måtte møte — samme
 * prinsipp som `teller_ikke` i §5.1.
 */
export async function hentHistorikk(
  skolearId: string,
): Promise<Map<string, Plassering[]>> {
  const rader = await hent<{
    elevId: string;
    dagId: string;
    dato: string;
    klokkeslett: string;
  }>(
    `SELECT s.elev_id AS elevId, d.id AS dagId, d.dato, s.klokkeslett
       FROM samtale s
       JOIN samtaledag d ON d.id = s.samtaledag_id AND d.slettet IS NULL
      WHERE d.skolear_id = $1 AND s.slettet IS NULL AND s.motte = 1
      ORDER BY d.dato DESC, s.klokkeslett`,
    [skolearId],
  );

  // Plasseringen regnes innen dagen, så radene grupperes per dag først.
  const perDag = new Map<string, { elevId: string; klokkeslett: string }[]>();
  const rekkefolge: string[] = [];
  for (const r of rader) {
    if (!perDag.has(r.dagId)) {
      perDag.set(r.dagId, []);
      rekkefolge.push(r.dagId);
    }
    perDag.get(r.dagId)!.push({ elevId: r.elevId, klokkeslett: r.klokkeslett });
  }

  const ut = new Map<string, Plassering[]>();
  for (const dagId of rekkefolge) {
    const dagens = perDag
      .get(dagId)!
      .sort((a, b) => a.klokkeslett.localeCompare(b.klokkeslett));
    dagens.forEach((s, i) => {
      const p = plassering(i, dagens.length);
      if (!p) return;
      ut.set(s.elevId, [...(ut.get(s.elevId) ?? []), p]);
    });
  }
  return ut;
}
