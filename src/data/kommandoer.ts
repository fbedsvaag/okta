/**
 * ⌘K som kommandolinje og hjelp (ARBEIDSLISTE 29.3, lerretet
 * Kommandolinje). Kommandoene og hjelpetekstene ligger her, i appen: ingen
 * nettverk. Søket er det samme som for elever og økter: hvert ord må passe.
 */

export type Kommandogruppe = "Gjør" | "Gå til" | "Innstillinger";

export type Kommando = {
  id: string;
  gruppe: Kommandogruppe;
  navn: string;
  /** liten tekst til høyre for navnet */
  hint?: string;
  /** hurtigtasten, når det finnes en */
  tast?: string;
  /** andre ord folk bruker om det samme */
  ord?: string;
  gjor: () => void;
};

/** Små bokstaver, ett mellomrom. */
const norm = (s: string) =>
  s.toLocaleLowerCase("nb-NO").replace(/\s+/g, " ").trim();

/**
 * Kommandoene som passer søket: hvert ord må stå i navnet, hintet eller de
 * andre ordene. De der navnet begynner med søket, kommer først.
 */
export function sokKommandoer(
  tekst: string,
  kommandoer: Kommando[],
  maks = 8,
): Kommando[] {
  const ord = norm(tekst).split(" ").filter(Boolean);
  if (ord.length === 0) return [];
  return kommandoer
    .map((k, i) => ({
      k,
      i,
      t: norm(`${k.navn} ${k.hint ?? ""} ${k.ord ?? ""}`),
    }))
    .filter(({ t }) => ord.every((o) => t.includes(o)))
    .sort(
      (a, b) =>
        (norm(b.k.navn).startsWith(ord[0]) ? 1 : 0) -
          (norm(a.k.navn).startsWith(ord[0]) ? 1 : 0) || a.i - b.i,
    )
    .slice(0, maks)
    .map(({ k }) => k);
}

/** «hvordan …», «hjelp», eller et spørsmål: da er det hjelp man vil ha. */
export function erHjelp(tekst: string): boolean {
  const t = norm(tekst);
  return (
    t.startsWith("hvordan") ||
    t.startsWith("hjelp") ||
    t.startsWith("hva er") ||
    t.startsWith("kan jeg") ||
    t.endsWith("?")
  );
}

/** «?» alene viser alle hurtigtastene. */
export const erTasteliste = (tekst: string) => tekst.trim() === "?";

export type Hjelp = {
  sporsmal: string;
  svar: string;
  /** teksten på knappen som gjør det */
  knapp: string;
  /** kommandoen knappen kjører */
  kommando: string;
  /** ord som peker hit */
  ord: string;
};

/**
 * Hjelpetekstene. Korte svar på norsk, med en knapp som gjør det. Står det
 * noe her som ikke stemmer med appen, er det her det rettes.
 */
export const HJELP: Hjelp[] = [
  {
    sporsmal: "Hvordan lager jeg grupper uten klassekart?",
    svar: "Gå til Plasser og grupper → Grupper. Velg klassen, antall grupper, og trykk Stokk (⌘R). Du trenger ikke rom eller kart.",
    knapp: "Lag grupper nå",
    kommando: "ga:klassekart",
    ord: "grupper gruppe stokk gruppesett",
  },
  {
    sporsmal: "Hvordan flytter jeg en økt?",
    svar: "I Økter-lista: dra ⋮⋮ til en annen økt. Innholdet bytter plass, datoene står.",
    knapp: "Åpne Økter",
    kommando: "ga:okter",
    ord: "flytt flytte økt bytte dato dra",
  },
  {
    sporsmal: "Hvordan fører jeg en skriftlig prøve?",
    svar: "Åpne vurderingen i Vurderinger og samtaler og velg «Én og én» eller «Tabell». Trykk 1–6 for karakter, ⌘↵ for neste elev.",
    knapp: "Åpne vurderinger",
    kommando: "ga:vurderinger",
    ord: "føre føring prøve karakter skriftlig innlevering",
  },
  {
    sporsmal: "Hvordan setter jeg opp en muntlig vurdering?",
    svar: "+ Ny → Muntlig vurdering. Under Planlegg legger du til dager, minutter per elev og pause, og trykker 🎲 Trekk rekkefølge. Oppgavekort og rubrikk står under.",
    knapp: "Åpne vurderinger",
    kommando: "ga:vurderinger",
    ord: "muntlig samtale tidsplan trekk rekkefølge rubrikk oppgave",
  },
  {
    sporsmal: "Hvordan lager jeg mentorsamtaler?",
    svar: "Vurderinger og samtaler → + Ny → Mentorsamtaler. Legg til dager under Planlegg; notatene er bare dine og går aldri ut av appen.",
    knapp: "Åpne vurderinger og samtaler",
    kommando: "ga:vurderinger",
    ord: "mentor mentorsamtale kontaktsamtale samtale foresatt",
  },
  {
    sporsmal: "Hvordan setter jeg halvårskarakter?",
    svar: "Gå til faget → Karakterer. Trykk 1–6 for eleven som er markert, ↓ for neste. Klikk karakteren for å bruke forslaget fra snittet.",
    knapp: "Åpne Økter",
    kommando: "ga:okter",
    ord: "halvår halvårskarakter standpunkt karakter snitt vekt",
  },
  {
    sporsmal: "Hvordan skårer jeg en økt?",
    svar: "Åpne økta og trykk 1, 2 eller 3 for rød, gul eller grønn, 0 for «ikke i økta». Pilene flytter mellom elevene.",
    knapp: "Gå til I dag",
    kommando: "ga:idag",
    ord: "skåre skåring innsats trafikklys fravær borte",
  },
  {
    sporsmal: "Hvordan legger jeg inn en ny klasseliste?",
    svar: "Elever → Lim inn. Lim klasselista rett fra Excel, Visma eller Teams; appen kjenner igjen navnene.",
    knapp: "Lim inn elever",
    kommando: "ga:liminn",
    ord: "klasseliste lim inn elever ny elev import",
  },
  {
    sporsmal: "Hvordan tar jeg sikkerhetskopi?",
    svar: "Appen tar kopi hver dag av seg selv. Vil du ta en nå, for eksempel før du oppdaterer appen, gjør du det her.",
    knapp: "Ta sikkerhetskopi nå",
    kommando: "kopi",
    ord: "sikkerhetskopi backup kopi oppdatere",
  },
  {
    sporsmal: "Hvordan endrer jeg fargen på et fag?",
    svar: "Gå til faget og trykk ⚙ øverst til høyre. Fargen, dagene, rommet og skalaene står der.",
    knapp: "Åpne Innstillinger → Fag",
    kommando: "innst:fag",
    ord: "farge fagfarge fag rom dager skala",
  },
  {
    sporsmal: "Hvordan angrer jeg?",
    svar: "⌘Z angrer det siste du gjorde, også på tvers av skjermene. ⇧⌘Z gjør det om igjen.",
    knapp: "Vis hurtigtastene",
    kommando: "taster",
    ord: "angre angring tilbake feil",
  },
  {
    sporsmal: "Hvordan skriver jeg ut årsplanen?",
    svar: "Gå til Økter og trykk «Årsplan …» i verktøylinja. Velg fagene, og så «Skriv ut / lagre som PDF».",
    knapp: "Åpne Økter",
    kommando: "ga:okter",
    ord: "skriv ut utskrift årsplan pdf",
  },
];

/** Hjelpen som passer spørsmålet best; alle når det ikke sier noe mer. */
export function finnHjelp(tekst: string, hjelp = HJELP, maks = 4): Hjelp[] {
  const fyll = new Set([
    "hvordan",
    "hjelp",
    "jeg",
    "en",
    "et",
    "å",
    "kan",
    "lager",
    "lage",
    "gjør",
    "hva",
    "er",
    "på",
    "i",
    "til",
    "med",
  ]);
  const ord = norm(tekst.replace(/[?.,!]/g, " "))
    .split(" ")
    .filter((o) => o && !fyll.has(o));
  if (ord.length === 0) return hjelp.slice(0, maks);
  const poeng = (h: Hjelp) => {
    const t = norm(`${h.sporsmal} ${h.ord}`);
    // Ord som begynner likt teller: «grupper» finner «gruppe».
    return ord.filter((o) =>
      t
        .split(/[^a-zæøå0-9]+/)
        .some(
          (w) =>
            w.length > 2 && (w.startsWith(o.slice(0, 5)) || o.startsWith(w)),
        ),
    ).length;
  };
  return hjelp
    .map((h, i) => ({ h, i, p: poeng(h) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .slice(0, maks)
    .map((x) => x.h);
}

/** Alle hurtigtastene, til «?». */
export const TASTER: [string, string][] = [
  ["⌘K", "Kommandolinje og hjelp"],
  [
    "G D · G Ø · G E · G V · G P",
    "I dag, Økter, Elever, Vurderinger og samtaler, Plasser og grupper",
  ],
  ["⌘1–9", "Fagene under Økter"],
  ["⌘,", "Innstillinger"],
  ["1 2 3 · 0", "Skår rød, gul, grønn · ikke i økta"],
  ["1–6", "Karakter i en vurdering, halvårskarakter i Karakterer"],
  ["⌘↵", "Neste elev i en vurdering eller samtale"],
  ["K", "Klassekartet i økta"],
  ["⌘R", "Stokk grupper eller plasser"],
  ["⌘Z · ⇧⌘Z", "Angre · gjør om igjen"],
  ["⌘[ · ⌘]", "Tilbake · fram"],
  ["Esc", "Lukk det øverste arket"],
  ["?", "Vis alle hurtigtaster"],
];
