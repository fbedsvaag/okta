# Elevtracking — spesifikasjon

Lokal desktop-app for undervisningsplanlegging og elevoppfølging.
Bygges fra scratch. Ingen migrering, ingen eksisterende data.

---

## 1. Formål

Verktøyet har tre likestilte jobber, i den rekkefølgen de brukes gjennom året:

1. **Planlegge skoleåret.** Periodisere hvert fag — hvilket tema jobber jeg med
   når — og legge ut øktene med dato, varighet og innhold. Dette gjøres i august
   og justeres gjennom året. Årsplanen skal kunne skrives ut.
2. **Skåre elevene underveis.** Trafikklys per elev per økt, ført mens økta går.
3. **Se eleven over tid.** Heatmap og vurderinger samlet, slik at standpunkt
   settes på grunnlag av dokumentert utvikling og ikke på hukommelse.

Ingen av de tre er sekundær. Punkt 1 er hovedbruken i oppstarten av året,
punkt 2 er den daglige bruken, punkt 3 er bruken før standpunkt og elevsamtaler.

**Alt innhold opprettes av brukeren.** Skoleår, fag, klasser og elever legges inn
av læreren selv i appen. Ingen fagkoder, klassenavn eller fagbeskrivelser er
hardkodet — `MFL1`, `EBU1`, `ENG1` og resten er bare tekst brukeren skriver.
Verktøyet skal virke like godt for en lærer i realfag som for en i økonomifag.

Eksempeloppsettet i denne spec-en er MFL1, MFL2, ENG1 og engelsk VG1, men det er
et eksempel, ikke en konfigurasjon som skal bygges inn.

Skoleår og fag konfigureres av brukeren ved oppsett — ingenting er hardkodet.
Fagene ligger i en fagbank som er uavhengig av år, og hvert skoleår velger inn
de fagene læreren faktisk har (§3.2). Øktene legges inn manuelt, én dato om
gangen, så fleksibel eller forskjøvet skolestart er et ikke-problem.

### To bærende prinsipper

**Planleggingen skal gi oversikt, ikke bare lagring.** Poenget med å periodisere
er å se om året henger sammen: om en periode er overbooket, om et tema har fått
for få timer, om det er hull i november. En årsplan man ikke kan overskue på én
skjerm løser ikke problemet.

**Skåringen skal ta under 20 sekunder for hele klassen.** Ingen modaler, ingen
dropdowns, ingen lagre-knapp, ingen musbruk. Ett tastetrykk per elev, og markøren
flytter seg selv.

### Ikke-mål

- **Ingen karakterer i standpunktforstand.** Vurderingsresultater i appen er
  underveisvurdering og arbeidsdokumentasjon. Standpunkt settes i InSchool.
- **Ingen fraværsføring mot InSchool.** «Ikke i økta» finnes som
  skåringsalternativ og betyr at eleven ikke var der å vurdere. Den er en
  markering i lærerens eget arbeidsmateriale, ikke en fraværsregistrering.
- **Ingen timeplanimport i v1.** Øktene opprettes manuelt, én om gangen (§4.2).
  Rundt 40 økter per fag i året er overkommelig, og planleggingen er en del av
  jobben. Kalender- og InSchool-import står i §10.
- Ingen synk i v1. Se §9 for hva som likevel forberedes.
- Ingen nettverkskall overhodet i v1, bortsett fra publisering av
  timeplanen til brukerens egen kalenderserver (§8.1). Av som standard.

---

## 2. Stack

- **Tauri 2** — bundle på ~10 MB, ingen native-rebuild av SQLite-driver
- **`tauri-plugin-sql`** med SQLite — databasefil i appens data-dir
- **Vite + React + TypeScript**
- **Tailwind**
- Ingen state-bibliotek. React state og et tynt query-lag mot SQL holder.

Rust-koden begrenses til plugin-registrering og migrasjoner. All logikk i frontend.

Appen skal starte på under ett sekund fra kaldstart. Det er et krav, ikke et ønske.

---

## 3. Datamodell

### 3.1 Nøkler og felles felter

**Alle tabeller bruker `TEXT`-UUID som primærnøkkel**, ikke autoincrement.
Alle tabeller har `opprettet`, `endret` og `slettet` (nullable ISO-tidspunkt,
soft delete). Dette koster ingenting nå og er det som gjør synk mulig senere
uten en vond migrering. Se §9.

Alle spørringer må filtrere på `slettet IS NULL`.

### 3.2 Konfigurasjon

```sql
CREATE TABLE skolear (
  id        TEXT PRIMARY KEY,
  navn      TEXT NOT NULL,              -- "2026/27"
  start     TEXT NOT NULL,              -- ISO-dato, settes av bruker
  slutt     TEXT NOT NULL,
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);
```

Hvilket skoleår som er aktivt ligger i `innstilling.aktivt_skolear` (§4.8) og
ingen andre steder. Ett år er aktivt om gangen.

**`fag` er en fagbank, ikke noe som hører til ett år.** Faget defineres én gang —
kode, navn, farge, beskrivelse — og hvert skoleår *plukker* de fagene læreren
underviser i. Koblingen `skolear_fag` er faget slik det ser ut det året, og det
er den perioder, økter, vurderinger og elevkoblinger henger på. Uten det skillet
blander ENG1 i 2026/27 seg med ENG1 i 2027/28.

Det som kan variere fra år til år ligger på koblingen, ikke på banken:
årstimetall, skåringsskala og standard øktvarighet.

```sql
CREATE TABLE fag (
  id           TEXT PRIMARY KEY,
  kode         TEXT NOT NULL,           -- "MFL1"
  navn         TEXT NOT NULL,           -- "Markedsføring og ledelse 1"
  farge        TEXT,                    -- hex, fargestrek i venstremarg
  beskrivelse  TEXT,                    -- fritekst i v1, se §10
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

CREATE TABLE skolear_fag (
  id           TEXT PRIMARY KEY,
  skolear_id   TEXT NOT NULL REFERENCES skolear(id),
  fag_id       TEXT NOT NULL REFERENCES fag(id),
  skaringsskala_id TEXT REFERENCES skala(id),  -- default: trafikklys
  standard_varighet_min INTEGER,        -- overstyrer global standard, NULL = arv
  arstimetall  INTEGER,                 -- for timeregnskapet i §4.2
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT,
  UNIQUE(skolear_id, fag_id)
);

CREATE TABLE innstilling (
  nokkel  TEXT PRIMARY KEY,             -- se §4.8
  verdi   TEXT NOT NULL,                -- JSON eller ren tekst
  endret  TEXT NOT NULL
);

CREATE TABLE klasse (
  id         TEXT PRIMARY KEY,
  navn       TEXT NOT NULL,             -- "1STC"
  skolear_id TEXT NOT NULL REFERENCES skolear(id),
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

CREATE TABLE elev (
  id         TEXT PRIMARY KEY,
  fornavn    TEXT NOT NULL,
  etternavn  TEXT NOT NULL,
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

CREATE TABLE elev_klasse (
  id         TEXT PRIMARY KEY,
  elev_id    TEXT NOT NULL REFERENCES elev(id),
  klasse_id  TEXT NOT NULL REFERENCES klasse(id),
  skolear_id TEXT NOT NULL REFERENCES skolear(id),  -- = klasse.skolear_id
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT,
  UNIQUE(elev_id, skolear_id)
);

CREATE TABLE elev_fag (
  id             TEXT PRIMARY KEY,
  elev_id        TEXT NOT NULL REFERENCES elev(id),
  skolear_fag_id TEXT NOT NULL REFERENCES skolear_fag(id),
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT,
  UNIQUE(elev_id, skolear_fag_id)
);
```

`elev_klasse.skolear_id` gjentar det som allerede står på klassen. Det er med
vilje: det er den som gjør «én klasse per elev per skoleår» til en regel basen
selv håndhever, ikke noe koden må huske på.

**Eleven lever på tvers av skoleår.** Tony Soprano går i `1STA` i 2026/27,
`2STA` i 2027/28 og `3STA` i 2028/29 — samme elevrad hele veien, med skåringer
og vurderinger fra alle tre årene. Endrer du klassen hans for 2027/28 til
`2STB`, rører det ikke året før. Etter tredje året står han uten klassekobling
i nye år; det er det uteksaminert betyr her, og det trenger ikke noe eget felt.

**Klasse og fag er to uavhengige dimensjoner, med ulik kardinalitet.**

- **Én elev har én klasse per skoleår.** `1STC` eller `3STB`, ikke begge samme år.
  Klassen er elevens hjemmeklasse det året.
- **Én elev har mange fag samme år.** MFL1, ENG1, EBU1 — så mange læreren
  følger hen i, uten øvre grense.
- **Ett fag henter elever fra flere klasser.** Fagpuljen er ikke en klasse.

Ingen av delene utledes av den andre. En elev uten klasse er lovlig og skal ikke
blokkere noe.

At klassen er entydig innenfor året gjør den til et nyttig signal i
duplikatgjenkjenningen (§7.1): to elever med samme navn i to forskjellige
klasser samme år er nesten alltid to personer.

### 3.3 Perioder, økter og skåring

`periode.start` og `periode.slutt` er **planlagt** spenn — brukerens intensjon.
Det faktiske spennet utledes av øktene som er knyttet til perioden. Begge vises
i årsplanen, og avvik mellom dem er nyttig informasjon, ikke en feil å skjule.

En økt uten `periode_id` er lovlig og vises som uplassert.

```sql
CREATE TABLE periode (
  id             TEXT PRIMARY KEY,
  skolear_fag_id TEXT NOT NULL REFERENCES skolear_fag(id),
  navn           TEXT NOT NULL,         -- "Markedsanalyse"
  rekkefolge     INTEGER NOT NULL,      -- sortering innen faget
  start          TEXT,                  -- planlagt startdato
  slutt          TEXT,                  -- planlagt sluttdato
  kompetansemal  TEXT,
  notat          TEXT,                  -- markdown
  farge          TEXT,
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

CREATE TABLE okt (
  id             TEXT PRIMARY KEY,
  skolear_fag_id TEXT NOT NULL REFERENCES skolear_fag(id),
  periode_id     TEXT REFERENCES periode(id),  -- NULL = ikke plassert ennå
  dato           TEXT NOT NULL,         -- ISO-dato
  klokkeslett    TEXT,                  -- "09:15"
  varighet_min   INTEGER NOT NULL,      -- minutter; forhåndsutfylles fra §4.8
  kode           TEXT,                  -- "2608-ENG1-3", se under
  tema           TEXT,
  kompetansemal  TEXT,
  plan           TEXT,                  -- markdown, hva som skal skje
  logg           TEXT,                  -- markdown, hvordan det gikk
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

CREATE TABLE skaring (
  id            TEXT PRIMARY KEY,
  elev_id       TEXT NOT NULL REFERENCES elev(id),
  okt_id        TEXT NOT NULL REFERENCES okt(id),
  skalaverdi_id TEXT NOT NULL REFERENCES skalaverdi(id),
  notat         TEXT,                   -- valgfri fritekst
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT,
  UNIQUE(elev_id, okt_id)
);
```

`okt.kode` er en lesbar identifikator på formen `YYMM-fagkode-#`, der `#` teller
øktene i det faget den måneden. `2608-ENG1-3` er tredje engelsktime i august
2026. Den er til for å kunne snakke om og søke opp en økt, ikke for sortering —
sorteringen skjer alltid på `dato` og `klokkeslett`.

Én rad per elev per økt. Skåres eleven på nytt, oppdateres raden — det lages
ikke historikk. `notat` er valgfritt og fylles sjelden.

**Økta er avholdt så snart minst én elev er skåret.** Det utledes, det er ikke
et felt. I en avholdt økt har hver elev en verdi mellom `0` og `3`: de du har
trykket på har den verdien du satte, resten er `0`. Bare det du faktisk trykker
lagres — resten fylles ut ved visning, slik at en økt ikke legger igjen 30 rader
som bare sier at ingenting skjedde.

Skåringen peker på `skalaverdi` (§3.4), ikke på en hardkodet farge. Skalaen som
brukes ligger på faget (`fag.skaringsskala_id`) og er trafikklyset som standard.
Det betyr at en bruker som heller vil skåre 1–6 eller 1–10 bare velger en annen
skala — ingen ny kode. Se §5.1.

### 3.4 Vurdering

Vurderingen er en **oppgave som tilhører faget**. Resultatene henger under, ett
per elev. Skalaen er data, ikke kode — nye skalaer kan legges til uten å bygge
appen på nytt.

```sql
CREATE TABLE skala (
  id          TEXT PRIMARY KEY,
  navn        TEXT NOT NULL,
  bruksomrade TEXT NOT NULL,            -- skaring | vurdering | begge
  innebygd    INTEGER NOT NULL DEFAULT 0,
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

CREATE TABLE skalaverdi (
  id          TEXT PRIMARY KEY,
  skala_id    TEXT NOT NULL REFERENCES skala(id),
  kode        TEXT NOT NULL,            -- "4/3", "Godkjent", "Grønn"
  etikett     TEXT,                     -- lengre forklaring, vises som hjelpetekst
  rang        INTEGER NOT NULL,         -- sortering, høyere = bedre
  farge       TEXT,                     -- gronn | gul | rod | NULL
  bestatt     INTEGER,                  -- 1 / 0 / NULL der det ikke gir mening
  teller_ikke INTEGER NOT NULL DEFAULT 0  -- 1 = utelates fra heatmap og statistikk
);

CREATE TABLE vurdering (
  id        TEXT PRIMARY KEY,
  skolear_fag_id TEXT NOT NULL REFERENCES skolear_fag(id),
  okt_id    TEXT REFERENCES okt(id),    -- valgfri kobling til en økt
  skala_id  TEXT NOT NULL REFERENCES skala(id),
  tittel    TEXT NOT NULL,              -- "Fagartikkel: markedsanalyse"
  type      TEXT,                       -- muntlig | skriftlig | praktisk
  frist     TEXT,
  beskrivelse TEXT,
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

CREATE TABLE vurderingsresultat (
  id            TEXT PRIMARY KEY,
  vurdering_id  TEXT NOT NULL REFERENCES vurdering(id),
  elev_id       TEXT NOT NULL REFERENCES elev(id),
  skalaverdi_id TEXT REFERENCES skalaverdi(id),
  levert        INTEGER NOT NULL DEFAULT 0,
  kommentar     TEXT,                   -- markdown
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT,
  UNIQUE(vurdering_id, elev_id)
);
```

### 3.5 Oppfølging

```sql
CREATE TABLE oppfolging (
  id        TEXT PRIMARY KEY,
  elev_id   TEXT NOT NULL REFERENCES elev(id),
  skolear_fag_id TEXT REFERENCES skolear_fag(id),
  status    TEXT NOT NULL,              -- se §5
  tekst     TEXT,
  frist     TEXT,
  lukket    TEXT,                       -- NULL = åpen
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);
```

### 3.6 Indekser

```sql
CREATE INDEX idx_skaring_okt   ON skaring(okt_id)   WHERE slettet IS NULL;
CREATE INDEX idx_skaring_elev  ON skaring(elev_id)  WHERE slettet IS NULL;
CREATE INDEX idx_okt_fag_dato  ON okt(skolear_fag_id, dato) WHERE slettet IS NULL;
CREATE INDEX idx_okt_periode   ON okt(periode_id)    WHERE slettet IS NULL;
CREATE INDEX idx_sfag_skolear  ON skolear_fag(skolear_id) WHERE slettet IS NULL;
CREATE INDEX idx_klasse_skolear ON klasse(skolear_id) WHERE slettet IS NULL;
CREATE INDEX idx_elev_klasse   ON elev_klasse(klasse_id) WHERE slettet IS NULL;
CREATE INDEX idx_klasse_elev   ON elev_klasse(elev_id, skolear_id) WHERE slettet IS NULL;
CREATE INDEX idx_elev_fag      ON elev_fag(skolear_fag_id) WHERE slettet IS NULL;
CREATE INDEX idx_fag_elev      ON elev_fag(elev_id) WHERE slettet IS NULL;
CREATE INDEX idx_periode_fag   ON periode(skolear_fag_id, rekkefolge) WHERE slettet IS NULL;
CREATE INDEX idx_vurd_fag      ON vurdering(skolear_fag_id) WHERE slettet IS NULL;
CREATE INDEX idx_res_elev      ON vurderingsresultat(elev_id) WHERE slettet IS NULL;
CREATE INDEX idx_oppf_apen     ON oppfolging(lukket) WHERE lukket IS NULL AND slettet IS NULL;
```

---

## 4. Skjermbilder

Appen er de fire arkene fra Excel-versjonen, gjort om til ordentlige skjermer:

| Excel-fane | Skjerm |
|------------|--------|
| Årsplan | §4.2 — liste med økter per fag |
| Elever | §4.3 — alle elever og hvilke fag de har |
| Tracking | §4.4 — elevlista for én økt, med skåring |
| *(fantes ikke)* | §4.5 — eleven over tid, matet av §4.4 |

Resten (§4.6–4.8) er støtteskjermer. Bygg de fire første først.

### 4.0 Førstegangsoppsett

Appen starter helt tom. Første gang den åpnes møter brukeren en veiviser med tre
steg, i denne rekkefølgen fordi hvert steg avhenger av det forrige:

1. **Opprett skoleåret** — navn, startdato, sluttdato. Det blir det aktive.
2. **Velg fagene du har i år.** Fagene ligger i en fagbank (§3.2) og velges inn
   i skoleåret. Er banken tom, eller mangler faget, opprettes det her med kode,
   navn og farge — `MFL1`, `EBU2`, `Norsk`, hva brukeren nå enn underviser i.
   Neste år velges de samme fagene inn på nytt uten å skrives inn igjen.
3. **Legg inn klasselister i fagene.** Ett fag om gangen: lim inn lista (§7)
   eller skriv navnene manuelt (§4.3). Klassen (`1STC`, `3STB`) settes i
   forhåndsvisningen og opprettes der hvis den ikke finnes fra før.

Klasser opprettes altså underveis, ikke som eget steg. En elev går i én klasse
per skoleår og har mange fag samme år — de to dimensjonene settes på hvert sitt
sted, og ingen av dem utledes av den andre.

Fra og med skoleår nummer to er steg 3 som regel unødvendig: elevene rykker opp
fra fjorårets klasser (§4.3) i stedet for å limes inn på nytt.

Fra og med fag nummer to slår duplikatgjenkjenningen inn (§7.1): kjenner appen
igjen et navn fra et fag du allerede har fylt, spør den om det er samme elev.

Veiviseren skal kunne avbrytes og gjenopptas. Hvert steg lagrer med en gang. Etter
oppsettet er alt tilgjengelig fra §4.3 og §4.8 — veiviseren er en snarvei gjennom
skjermer som finnes uansett, ikke en egen kodesti.

**Tomme tilstander ellers:** hver skjerm som kan være tom skal si hva som mangler
og lenke dit man fikser det. «Ingen økter i dette faget ennå — opprett den
første» er riktig; et blankt panel er ikke.

### 4.1 I dag (startskjerm)

Dagens økter basert på systemdato, kronologisk. Hver økt er ett kort: fag,
klokkeslett, tema, og hvor mange av elevene som er skåret.

Nærmeste økt i tid er alltid forhåndsvalgt. **Enter** åpner den i §4.4.

Ingen økter i dag: vis de tre neste kommende, med lenke til årsplanen.

### 4.2 Årsplan — økter per fag

Ett fag om gangen, innenfor det aktive skoleåret. Tre visninger som veksles med
en bryter øverst: liste, kalender, periode.

#### Listevisning (standard)

Øktene kronologisk nedover, gruppert under sin periode. Per rad: dato, ukedag,
klokkeslett, varighet, tema, og om det henger en vurdering på økta.

Klikk åpner økta for redigering: tema, kompetansemål, plan, varighet, periode.

Dette er visningen du står i når du planlegger. Den skal tåle å bli scrollet
gjennom et helt år uten å bli tung.

#### Kalendervisning

Samme økter lagt ut i en uke- eller månedskalender. **Bare mandag til fredag** —
lørdag og søndag tar plass uten å inneholde noe.

Kalenderen er for å se hvordan uka faktisk ser ut: fire økter i uka er det
normale, noen uker flere. Klikk på en dag oppretter en økt der; klikk på en økt
åpner den for redigering.

#### Periodevisning

Året som en vannrett tidslinje, med periodene som liggende felt. Under hvert
felt: antall økter og sum timer.

```
  aug        sep        okt        nov        des        jan
|----------|----------|----------|----------|----------|--------
| Grunnleggende marked | Markedsanalyse      | Merkevare | ...
| 8 økter · 24 t       | 11 økter · 33 t     | 6 · 18 t  |
```

Perioder opprettes, navngis og endres i lengde her. Økter uten periode vises i
et eget felt under tidslinja, så de ikke blir usynlige.

#### Opprett ny økt

Én økt om gangen, med en pluss-knapp. Dato, klokkeslett, varighet, tema og
periode. Varighet forhåndsutfylles etter arvekjeden i §4.8; standard er 180
minutter.

Ingen serieopprettelse i v1. Det er rundt 40 økter i året per fag, og punchingen
er en del av planleggingen — læreren skal kjenne øktene sine. Automatisk
utfylling fra timeplan hører hjemme i §10, når det finnes en timeplan å hente
fra.

#### Timeregnskap

Alltid synlig øverst i faget: antall planlagte økter, sum timer, og sum per
periode. Er årstimetall lagt inn på faget (§4.8), vises differansen.

Det svarer på om en periode er overbooket mens det ennå er tid til å endre den.

### 4.3 Elever — alle elever, klasser og fag

Motstykket til Elever-fanen i Excel, og limet mellom alt annet. Én tabell med
alle elever på tvers av klasser og fag, for det aktive skoleåret:

```
Navn                    Klasse    Fag                 Økter   Siste
Tony Soprano            1STC      MFL1, ENG1           24      2 d
Carmela Soprano         1STC      MFL1, ENG1, EBU1     24      2 d
Phil Harris             1STC      MFL1, EBU1           31      1 d
Jennifer Melfi          2STA      MFL2                 19      5 d
+ Legg til elev …
```

- **Klassekolonnen har én verdi** — elevens klasse dette skoleåret. Klikk åpner
  en nedtrekksliste over klassene i året, med «Ny klasse …» nederst og «Ingen
  klasse» som gyldig valg. Å endre den rører ikke tidligere år.
- **Fagkolonnen viser flere verdier**, kommaseparert. Klikk åpner en kompakt
  flervalgsliste over opprettede fag, med «Nytt fag …» nederst. Det er slik
  `elev_fag` vedlikeholdes.
- **Økter** er antall skåringer registrert, **Siste** er hvor lenge siden. Sammen
  avslører de hull: en elev med påfallende få skåringer er som regel en du har
  oversett, ikke en som har vært mye borte.
- Filter på klasse og på fag, uavhengig av hverandre. Sortering på hvilken som
  helst kolonne. Søk øverst.
- Klikk på navnet åpner §4.5.

#### Manuell innlegging

Nederst i tabellen står alltid en tom rad: **+ Legg til elev**. Skriv navnet,
trykk Enter, og raden lagres samtidig som en ny tom rad dukker opp under. Klasse
og fag arves fra det filteret som er aktivt — står du og ser på 1STC i MFL1, blir
nye elever lagt i 1STC og koblet til MFL1 uten at du må sette det.

Skriver du inn et navn som allerede finnes, gjelder §7.1 også her: appen spør om
det er samme elev, i stedet for å opprette en ny i stillhet.

Dette er hovedveien inn for en lærer som ikke har en liste å lime inn. Den skal
være like rask som lim-inn: skriv, Enter, skriv, Enter. Ingen dialogvindu, ingen
lagre-knapp.

Navneparsingen er den samme som i §7, slik at `La Cerva, Adriana` og
`Adriana La Cerva` gir samme resultat.

#### Lim inn liste

Knapp øverst. Åpner lim-inn-feltet beskrevet i §7, med forhåndsvisning og
duplikathåndtering. Elever som allerede finnes kobles til det valgte faget i
stedet for å opprettes på nytt.

#### Klasser

Egen fane på samme skjerm: opprett, gi nytt navn, se antall elever per klasse.
Å gi en klasse nytt navn skal ikke røre elevradene — det er derfor klassen er en
egen tabell og ikke et tekstfelt på eleven.

Sletting av en klasse med elever i skal ikke slette elevene. De blir stående uten
klasse, og appen sier hvor mange det gjelder før den utfører slettingen.

#### Klasseopprykk

Ved starten av et nytt skoleår skal elevene kunne rykke opp uten å limes inn på
nytt: alle i en `1`-klasse går over i tilsvarende `2`-klasse, `2` blir `3`, og
`3`-klassene rykker ikke videre — de er ferdige med videregående.

Regelen leser det første tegnet i klassenavnet og beholder resten: `1STA` →
`2STA`, `1STC` → `2STC`. Klassenavn er fritekst (§1), så navn som ikke begynner
med `1`, `2` eller `3` kan ikke rykkes opp automatisk. De listes opp for
manuell plassering i stedet for å bli gjettet på.

Opprykket vises alltid som en forhåndsvisning før det utføres — hvilke klasser
som blir til hva, hvor mange elever hver av dem har, og hvem som ikke får plass
automatisk. Ingenting skrives før du bekrefter.

Fagene følger ikke med. Hvilke fag du har en elev i, avgjør du per skoleår.

Denne skjermen er der du bruker en time i august og fem minutter i måneden etter.

### 4.4 Økt — elevlista med skåring

Motstykket til Tracking-fanen, og den daglige bruken. Full skjerm, minimal ramme.

Øverst en kompakt topplinje: fag, dato, tema, periode, og planen for økta
sammenklappet — ett trykk for å utvide.

Under: elevlista for faget, alfabetisk på fornavn, én rad per elev.

```
    Anna Reistad              ●  ○  ○  ○
 ▸  Alexander Eikås           ○  ○  ○  ○        ← markør
    Benjamin Holm             ○  ○  ●  ○
    Cecilie Vang              ○  ○  ○  ●   ikke i økta
```

| Tast | Handling |
|------|----------|
| `1` | Rød — og hopp til neste elev |
| `2` | Gul — og hopp til neste elev |
| `3` | Grønn — og hopp til neste elev |
| `0` | Ikke i økta — og hopp til neste elev |
| `↓` `↑` | Flytt uten å skåre |
| `⇥` `⇧⇥` | Flytt uten å skåre — samme som pil ned/opp |
| `N` | Åpne notatfelt for markert elev |
| `⌘K` | Søk på elevnavn, hopp dit |
| `⌫` | Fjern skåre på markert elev |

Tastene er ikke hardkodet — de utledes av skalaens rangering (§5.1), slik at en
annen skåringsskala virker uten kodeendring.

Autoadvansering er hele poenget. Du går nedover lista med tallrekka og er ferdig
med 30 elever på under 20 sekunder. Notat er unntaket, ikke regelen.

Har eleven skåringsnotat fra tidligere økter, vises det siste som grå
hjelpetekst under raden når markøren står der.

**Alle elever i en avholdt økt har en verdi mellom `0` og `3`.** Det finnes ingen
fjerde tilstand. De du ikke har trykket på er `0` — «ikke i økta» — og det
dekker både den som var borte og den du ikke rakk. `0` teller ikke i noen
sammenstilling (§5.1), så det forurenser ingenting.

Før du har trykket på noen som helst er økta ikke avholdt, og radene står tomme.

Talltasten setter verdi og flytter markøren videre; det er den flyten som gir
20 sekunder. Tab, Shift+Tab og piltastene flytter uten å skåre, så du kan gå
tilbake og rette. Den samme verdien kan også velges med musa fra en
nedtrekksliste på raden — tastene er snarveien, ikke den eneste veien.

Nederst: fritekstfelt for øktlogg — hvordan det gikk med klassen samlet.

**Ikke** vis løpende statistikk i denne visningen. Ingen teller på hvor mange
røde du har satt. Det påvirker skjønnet ditt mens du skårer.

### 4.5 Elev — heatmap og vurderinger

Det §4.4 mater. Skjermen skal svare på ett spørsmål: **hvordan har det gått med
denne eleven i år?**

Øverst: navn, og for hvert skoleår eleven har vært i — klassen det året og
fagene du hadde hen i. Tony Soprano viser `2026/27 · 1STA · MFL1, ENG1` og
`2027/28 · 2STA · MFL2` under hverandre.

**Ett klikk snevrer inn til inneværende skoleår**, og ett til viser alt igjen.
Inneværende år er det som vises når skjermen åpnes — det er det du trenger til
en elevsamtale i november. Hele historikken er det du trenger i vg3.

**Heatmapet.** Per fag, én rad av små fargede felt i kronologisk rekkefølge — ett
felt per økt, fra skolestart til i dag. Måneder markeres med tynne skillelinjer.

```
ENG1   ▪▪▪▪▪ ▪▪▪▪ │ ▪▪▪▪▪ ▪▪▪▪ │ ▪▪▪ ▫▪▪▪▪ │ ▪▪▪▪
       aug          sep          okt         nov
```

Verdier med `teller_ikke = 1` — «ikke i økta» — vises som tomt omriss, ikke som
farge. De teller ikke i noen sammenstilling og skal ikke kunne forveksles med
rødt.

Hold musepekeren over et felt: dato, tema for økta, og eventuelt notat.

**Vurderingene** ligger rett under heatmapet, i samme fag: oppgavetittel, dato,
resultat i skalaens egen notasjon, og kommentar. Slik ser man innsats over tid og
faktiske prestasjoner side om side, som er nettopp det som trengs når standpunkt
skal settes.

Under igjen: notater fra skåringer, og åpne oppfølgingspunkter.

Hele skjermen skal kunne eksporteres som én fil (§6).

### 4.6 Vurderinger

Per fag: liste over vurderingsoppgaver. Ved opprettelse velges skala fra §5.2.
Eksempel: faget ENG1, oppgaven «Essay om Animal Farm», skala «Karakter 1–6».

Åpne en vurdering → elevlista, én rad per elev, med markør som i §4.4.

Inputmetoden velges automatisk etter skalaens form:

**Skalaer med inntil ti verdier** (godkjent, lav–middels–høy, karakter 1–6):
knapperad per elev. Talltastene `1`–`n` velger direkte og markøren hopper videre.

Alle skalaene i v1 har inntil ti verdier, så knapperaden er den eneste
inputmetoden som trengs. Rutenettet for båndorganiserte skalaer hører til den
findelte karakterskalaen og bygges sammen med den — se §10.

Som i §4.4 er tastene en snarvei. Verdien kan alltid også velges med musa.

### 4.7 Oppfølging

Åpne punkter på tvers av fag, sortert på frist. Passert frist markeres tydelig.
Lukking med ett klikk.

### 4.8 Innstillinger

Globale valg lagres i `innstilling` som nøkkel/verdi. Ingenting av dette skal
være hardkodet i applikasjonskoden.

| Nøkkel | Betydning | Standard |
|--------|-----------|----------|
| `standard_varighet_min` | Forhåndsutfylt varighet på nye økter | `180` |
| `eksportmappe` | Hvor tekstfilene i §8 skrives | ikke satt |
| `aktivt_skolear` | Hvilket skoleår appen viser | første opprettede |

Etikettene på trafikklyset (§5.1) ligger på `skalaverdi.etikett` og redigeres
der, ikke som en egen innstilling. Ett sted, ikke to.

Skjermen har fem deler:

- **Skoleår:** navn, start, slutt, hvilket som er aktivt. Nytt skoleår
  opprettes her, med klasseopprykk (§4.3) som neste steg.
- **Fagbank:** kode, navn, farge, beskrivelse. Fagene slik de er, uavhengig av
  år.
- **Fag i år:** hvilke fag fra banken du har i det aktive skoleåret, og for hvert
  av dem årstimetall, skåringsskala og standard varighet. Er varigheten satt,
  overstyrer den den globale.
- **Skalaer:** se og lage skåringsskalaer og vurderingsskalaer
- **Generelt:** standard varighet og eksportmappe

**Varighet arves i tre ledd:** global standard → fagets standard → øktas egen
verdi. Nye økter (§4.2) forhåndsutfylles fra fagets standard, og verdien kan
endres på den enkelte økta etterpå. Ingen av leddene skal kreve at man skriver
180 på nytt hver gang.

Fagets standard ligger på `skolear_fag`, ikke på fagbanken — varigheten kan
være en annen neste år uten at faget selv endres.

### 4.9 Utskrift av årsplan (sekundært)

Lav prioritet — bygges når §4.2–4.5 står. Egen utskriftsvisning, ikke utskrift av
skjermbildet, laget som en print-stylesheet slik at Cmd+P gir riktig resultat.

Ett fag per side. Fagnavn og skoleår i topptekst. Perioder som overskrifter med
spenn og timetall. Øktene i en tabell under: dato, ukedag, varighet, tema.
Lesbar i svart-hvitt.

---

## 5. Skalaer

Alle skalaer er data i basen, ikke kode. Rangeringen bruker tiere med luft mellom,
slik at nye verdier kan settes inn uten å renummerere.

Tastebindinger utledes av `rang` for skalaer med inntil ti verdier, etter én
regel som gjelder overalt i appen:

> **`rang = 0` gir tast `0`.** Det er alltid verdien som betyr «ingenting her» —
> ikke i økta, ikke levert, ikke vurderingsgrunnlag. De øvrige verdiene får
> `1` og oppover, stigende etter rang.

En kollega som lager en 1–6-skala for øktskåring får da tastene `1`–`6` uten at
noe bygges om.

`rang = 0` og `teller_ikke` er to forskjellige ting og skal ikke slås sammen.
Den første styrer hvilken tast verdien får, den andre om verdien inngår i
sammenstillinger. «Ikke levert» har `rang = 0` og teller likevel — det er en
opplysning om eleven. «Ikke i økta» har begge deler.

Tastene er alltid en snarvei. Enhver verdi skal også kunne velges med musa fra
en nedtrekksliste.

### 5.1 Øktskåring — trafikklys (standard)

`bruksomrade: skaring`. Skalaen ligger på faget, så den kan byttes per fag.

| Kode | Tast | Rang | Farge | teller_ikke |
|------|------|------|-------|-------------|
| Ikke i økta | `0` | 0 | — | 1 |
| Rød | `1` | 10 | rod | 0 |
| Gul | `2` | 20 | gul | 0 |
| Grønn | `3` | 30 | gronn | 0 |

**Fargen er innsats i den enkelte økta.** Det er den definisjonen appen skal vise
som hjelpetekst, og den som følger med eksporten (§8) slik at heatmapet er
tolkbart for andre enn deg selv.

Etikettene er redigerbare i innstillingene. Utgangspunkt:

- **Grønn** — jobbet med det som var planlagt
- **Gul** — delvis innsats, eller kom sent i gang
- **Rød** — ikke i gang med faget denne økta
- **Ikke i økta** — eleven var ikke der å vurdere

Andre skåringsskalaer kan opprettes i innstillingene (f.eks. 1–6 eller 1–10).
V1 seeder kun trafikklyset.

### 5.2 Vurderingsskalaer

`bruksomrade: vurdering`. De tre første seedes ved førstegangsoppsett. Den
findelte karakterskalaen er beskrevet her, men bygges ikke i v1 — se §10.

**Godkjent** — har farge, og vises med samme fargespråk som trafikklyset:

| Kode | Tast | Rang | Farge | Bestått |
|------|------|------|-------|---------|
| Ikke levert | `0` | 0 | rod | 0 |
| Ikke godkjent | `1` | 10 | gul | 0 |
| Godkjent | `2` | 20 | gronn | 1 |

**Lav–middels–høy:**

| Kode | Tast | Rang |
|------|------|------|
| Lav | `1` | 10 |
| Middels | `2` | 20 |
| Høy | `3` | 30 |

`bestatt` er `NULL` for alle tre — skalaen beskriver nivå, ikke bestått/ikke bestått.

**Karakter 1–6:** verdiene `1`, `2`, `3`, `4`, `5`, `6` med rang 10–60.
Talltastene tilsvarer karakteren direkte. `1` har `bestatt = 0`, resten `1`.

**Karakter findelt (ikke i v1, se §10)** — 24 verdier, stigende. Definisjonen
står her fordi den er vanskelig å rekonstruere riktig, ikke fordi den seedes nå:

| Kode | Rang | Bestått |
|------|------|---------|
| `IV` | 0 | NULL |
| `1` | 10 | 0 |
| `-2` | 18 | 1 |
| `2` | 20 | 1 |
| `2+` | 22 | 1 |
| `2/3` | 24 | 1 |
| `3/2` | 26 | 1 |
| `3-` | 28 | 1 |
| `3` | 30 | 1 |
| `3+` | 32 | 1 |
| `3/4` | 34 | 1 |
| `4/3` | 36 | 1 |
| `4-` | 38 | 1 |
| `4` | 40 | 1 |
| `4+` | 42 | 1 |
| `4/5` | 44 | 1 |
| `5/4` | 46 | 1 |
| `5-` | 48 | 1 |
| `5` | 50 | 1 |
| `5+` | 52 | 1 |
| `5/6` | 54 | 1 |
| `6/5` | 56 | 1 |
| `6-` | 58 | 1 |
| `6` | 60 | 1 |

Skalaen er organisert i **bånd rundt hver hele karakter**, ikke i intervaller
mellom dem. Ett bånd er `n/(n−1)`, `n−`, `n`, `n+`, `n/(n+1)` — fem verdier som
alle betyr «i praksis en n»:

```
6/5   6-   6
5/4   5-   5   5+   5/6
4/3   4-   4   4+   4/5
3/2   3-   3   3+   3/4
-2    2    2+  2/3
1     (stryk)
IV    (ikke grunnlag)
```

Dette er den grupperingen som skal brukes i UI, hjelpetekst og eksport. `3-`
hører til treeren, ikke til toppen av toeren — en elev på `3-` skal ikke leses
som «egentlig en toer».

To bånd er ufullstendige, og begge deler er bevisst:

- **Toeren har fire verdier.** `-2` står der `2/1` ellers ville stått. Grunnen er
  pedagogisk: `1` er stryk, `-2` er den første beståtte karakteren, og
  mellomtrinn som `1/2` eller `2/1` gir ikke mening over den grensen.
- **Sekseren har tre verdier.** Det finnes ingenting over.

Ikke «rett opp» dette til et symmetrisk mønster.

Merk også notasjonen: `-2` skrives med minus foran tallet, mens `3-`, `4-`, `5-`
og `6-` skrives med minus bak. Kodene lagres nøyaktig slik.

`IV` (ikke vurderingsgrunnlag) har `rang = 0`, `bestatt = NULL` og
`teller_ikke = 1`. Den er ikke en dårlig karakter — den er fravær av grunnlag, og
skal aldri inngå i snitt, heatmap eller annen sammenstilling.

Når skalaen bygges, skal både rutenettet med båndene og et skrivefelt som
validerer mot kodene virke. Merk plasseringen av `-2`: den hører hjemme rett
under `2`, ikke i en `2/1`-posisjon, for den finnes ikke.

### 5.3 Skalabygger

Bygges ikke ennå — den kommer etter rammeverket (§4.0, §4.3, §4.2).

Brukeren skal kunne lage egne skalaer selv, uten hjelp. Skalabyggeren ligger i
innstillingene og fungerer omtrent som når man lager en egen vurderingsskala i
Microsoft Teams.

**Opprett:** navn, bruksområde (skåring eller vurdering), og en rad per verdi.
Per verdi: kode (det som vises), etikett (valgfri forklaring), farge (valgfri),
og om verdien regnes som bestått.

**Rekkefølgen settes ved å dra radene.** `rang` beregnes automatisk til 10, 20,
30 og så videre. Brukeren skal aldri se eller skrive et rangtall.

**Dupliser en eksisterende skala** som utgangspunkt. De innebygde skalaene kan
dupliseres og endres, men ikke slettes.

#### Endring av skalaer som er i bruk

| Endring | Lov? |
|---------|------|
| Navn, etikett, farge | Ja — rører ingen resultater |
| Rekkefølge | Ja — `rang` omberegnes |
| Legge til en verdi | Ja |
| Slette en verdi som er i bruk | **Nei.** Appen sier hvor mange resultater som bruker den, og tilbyr å flytte dem først |
| Slette en hel skala som er i bruk | **Nei.** Arkiver i stedet |

Grunnen er at et vurderingsresultat peker på en skalaverdi. Forsvinner verdien,
står det et resultat i basen som ikke betyr noe lenger, og det oppdages først
når noen ser på eleven i mars.

### 5.4 Oppfølgingsstatus

- `folg_med` — ingen tiltak, men noe å holde øye med
- `tiltak` — noe er satt i gang
- `varsel` — formelt varsel er relevant eller sendt

---

## 6. Innsyn og eksport av elevdata

Innholdet er lærerens eget arbeidsmateriale — underveisvurdering og
observasjoner som ligger til grunn for standpunkt. To praktiske krav følger:

1. **Elevvisningen (§4.5) skal kunne eksporteres i sin helhet** som én fil, slik
   at et innsynsspørsmål kan besvares uten manuelt arbeid.
2. **Definisjonen av skalaene skal følge med eksporten.** Et heatmap uten
   forklaring på hva fargene betyr er ikke tolkbart for noen andre.

Ingenting om helse, hjemmeforhold eller andre særlige kategorier hører hjemme i
notatfeltene. Legg en kort påminnelse i førstegangsoppsettet.

Appen gjør ingen nettverkskall utover publiseringen i §8.1, som brukeren
selv slår på og som bare sender timeplanen. Ingen telemetri, ingen
oppdateringssjekk.

---

## 7. Import av elever

Ingen filimport i v1. Lim inn. Klasselistene lages som `.md`-filer.

Ett tekstfelt, én elev per linje. Parseren skal tåle:

```
Reistad, Anna
Anna Reistad
Anna	Reistad
Anna Reistad;1STC
- Anna Reistad
* Anna Reistad
1. Anna Reistad
```

Regler:

- Markdown-listemarkør (`-`, `*`, `+`) og nummerering (`1.`) strippes først.
- Overskriftslinjer (`#`, `##`) og tomme linjer hoppes over.
- Komma betyr `Etternavn, Fornavn`.
- **Semikolon skiller navn fra klasse:** `Anna Reistad;1STC`.
- **Tab er tvetydig og løses på innhold.** Lista over viser både `Anna⇥Reistad`
  (tab mellom navnedelene, slik InSchool skriver dem) og tab som feltskille mot
  klasse. Regelen: et tab-felt som inneholder et siffer er en klasse, alt annet
  hører til navnet. Klassenavn i videregående har et trinnsiffer, elevnavn har
  ikke siffer i seg.
- Flerdelte etternavn må gjenkjennes: en linje som slutter på et etternavn med
  partikkel skal ikke splittes på siste ord alene. Bruk en liste over vanlige
  partikler (La, Le, De, Di, Da, Del, Della, Van, Von, Mc, Mac, O') og slå dem
  sammen med ordet etter. `Adriana La Cerva` skal gi etternavn `La Cerva`.
- Ellers: siste ord er etternavn, resten fornavn.
- Ikke normaliser store bokstaver midt i navn (DeTrolio, DiMeo, McDuck).
- Duplikatsjekk skjer på hele navnet, ikke på etternavn alene — flere elever kan
  dele etternavn.

Etter parsing: forhåndsvisning med redigerbare felter *før* noe skrives til
databasen.

## 7.1 Duplikatgjenkjenning

En lærer har ofte samme elev i flere fag. Når en liste limes inn i fag nummer to,
skal appen kjenne igjen navn den har sett før og spørre om det er samme person.

**Grunnprinsippet: å slå sammen to forskjellige elever er verre enn å splitte én.**
Slås to sammen, blandes skåringer og vurderinger for to personer, og det oppdages
kanskje ikke før i mars. Splittes én, ser man det med en gang og kan slå sammen
manuelt. Automatikken skal derfor helle mot «ny elev» når den er usikker.

### Regler

Sammenlikning skjer mot elever i det aktive skoleåret, på normalisert navn
(trimmet, sammenslåtte mellomrom, ufølsom for store og små bokstaver — men
lagringen beholder original skrivemåte).

To signaler peker hver sin vei, og de må veies mot hverandre:

- **Samme navn i et annet fag peker mot samme elev.** Det er den normale
  situasjonen: en lærer har ofte samme elev i to eller tre fag. Dette er
  hovedgrunnen til at duplikatgjenkjenningen finnes.
- **Ulik klasse peker mot to personer.** Klassen er entydig (§3.2), så to som
  heter det samme i 1STC og 3STB er nesten alltid to.

**Slår begge inn samtidig, vinner klassesignalet.** Kostnaden ved feil
sammenslåing er høyere enn ved feil splitting, og splitting kan rettes etterpå.

| Situasjon | Forslag | Forhåndsvalgt |
|-----------|---------|---------------|
| Samme navn, samme klasse, **annet fag** | Samme elev | Ja |
| Samme navn, klasse mangler på én av dem, annet fag | Samme elev | Ja |
| Samme navn, samme klasse, **samme fag** | Allerede importert — hopp over linja | Hopp over |
| Samme navn, **ulik** klasse | Spør | Nei — ny elev |
| Nær match (Levenshtein ≤ 2, eller likt etternavn og samme forbokstav) | Spør | Nei — ny elev |
| Flere eksisterende elever matcher | Vis liste, la brukeren velge | Nei |
| Ingen match | Ny elev | — |

Rad tre er verdt å bygge riktig: limer man samme liste inn i samme fag to ganger,
skal ingenting dupliseres og ingenting overskrives. Linjene merkes som allerede
registrerte og hoppes over.

Nær match er tenkt på skrivefeil og varianter: `Cristopher` mot `Christopher`,
`Silvio Dante` mot `Silvio Dantè`.

### Visning

I forhåndsvisningen får hver linje en statusetikett. Match vises med
opplysningene som trengs for å avgjøre — klasse og hvilke fag eleven allerede
står i:

```
Tony Soprano          ✓ Finnes i 1STC · MFL1, ENG1     [ Samme elev ▾ ]
Carmela Soprano       ✓ Finnes i 1STC · MFL1           [ Samme elev ▾ ]
Cristopher Moltisanti ? Ligner Christopher Moltisanti  [ Ny elev ▾ ]
                        (1STC · MFL1)
Jason Parisi            Ny elev                        [ Ny elev ▾ ]
```

Nedtrekkslista har alltid «Ny elev» og de matchende elevene. Brukeren kan endre
hver linje. Ingenting skrives før importen bekreftes.

**«Samme elev» legger til fag, ikke klasse.** Eleven kobles til faget som
importeres. Står Phil Harris fra før i 1STC med MFL1, og du importerer ham i
EBU1, ender han i 1STC med MFL1 og EBU1.

Klassen røres ikke automatisk, siden en elev bare har én. Sier importen en annen
klasse enn den eleven allerede står i, skal appen si fra i stedet for å velge
selv:

```
Phil Harris   ? Finnes i 1STC · MFL1 — importen sier 3STB
                [ Ny elev ▾ ]   ( ) behold 1STC   ( ) bytt til 3STB
```

Ulik klasse er uansett det sterkeste signalet om at det er to forskjellige
personer, så forhåndsvalget er «ny elev».

Er alle linjene nye, hoppes bekreftelsessteget over — det skal ikke koste et
ekstra klikk å importere en helt fersk klasse.

### Slå sammen etterpå

§4.3 skal ha en «slå sammen»-handling: velg to elever, bekreft hvilken som er
hovedposten, og alle skåringer, vurderinger, oppfølgingspunkter og fagkoblinger
flyttes over. Den tapte posten soft-slettes.

Dette er sikkerhetsnettet som gjør at automatikken trygt kan være forsiktig.

---

## 8. Lagring, eksport og backup

Appen skiller mellom **arbeidsfil** og **arkiv**. Dette avgjør om dataene
overlever et år.

### Arbeidsfil

`elevtracking.sqlite` i appens data-mappe
(`~/Library/Application Support/elevtracking/`). Skal **aldri** ligge i iCloud
Drive, Dropbox eller annen synkmappe — synktjenester kan evakuere og delvis
skrive tilbake filer, og en åpen SQLite-database blir korrupt uten forvarsel.

### Arkiv

Ved hver appavslutning, og manuelt via knapp, skrives hele databasen ut som
lesbare tekstfiler til en mappe brukeren velger:

```
<valgt mappe>/
  README.md                  ← definisjon av trafikklys og skalaer
  elever/
    anna-reistad.md
  fag/
    mfl1.md                  ← årsplan med alle økter
    mfl1-skaring.csv
    mfl1-vurderinger.csv
  oppfolging.md
```

Elevfilene har YAML-frontmatter (navn, klasse, fag) og innhold kronologisk under.
Skal kunne åpnes i Obsidian uten videre behandling.

Denne mappa kan legges hvor som helst, inkludert i en skytjeneste — det er vanlige
tekstfiler som ingenting skriver til samtidig.

Eksporten er automatisk, ikke manuell. En eksport man må huske på er ikke backup.

### 8.1 Publisering av timeplanen (CalDAV)

Årsplanen kan publiseres til en kalenderserver brukeren selv velger, slik at
den kan abonneres på fra telefon, nettbrett og andre maskiner — og deles med
elever som en offentlig lenke.

Dette er det **eneste** unntaket fra §1. Det er avgrenset med vilje:

- **Av som standard.** Ingenting sendes før brukeren har lagt inn en adresse
  og slått funksjonen på.
- **Én adresse.** Én CalDAV-samling, oppgitt av brukeren. Ingen oppdagelse av
  tjenere, ingen forhåndsvalgte leverandører.
- **Fem felter, ikke flere:** fagkode, tittel, dato, klokkeslett og sted.
- **Aldri:** elevnavn, skåringer, skåringsnotater, vurderinger,
  vurderingsresultater, oppfølging, `okt.plan` eller `okt.logg`.
- **Enveis.** Appen skriver. Den leser aldri noe tilbake fra serveren, og en
  kompromittert server kan derfor ikke påvirke databasen.
- **Passordet lagres i systemets nøkkelring**, ikke i databasen — basen
  kopieres til `backup/` og skal kunne deles uten å lekke legitimasjon.

Hendelsene identifiseres med øktas UUID (§9), så en økt som flyttes blir
oppdatert framfor duplisert. Slettede økter fjernes fra serveren ved neste
publisering.

Feltlista er en del av spesifikasjonen, ikke en implementasjonsdetalj. Skal
den utvides, er det en spec-endring.

### Rullerende kopi

Kopi av `.sqlite`-fila til lokal `backup/`-undermappe ved appstart, én gang per
døgn, behold de siste 30.

---

## 9. Forberedt for synk (bygges ikke i v1)

Synk mellom maskiner, og senere mellom kolleger, er et uttalt mål på sikt. Tre
ting gjøres derfor riktig fra dag én, fordi de er dyre å rette i ettertid:

1. **UUID-primærnøkler** — to baser kan slås sammen uten nøkkelkollisjon
2. **`endret`-tidsstempel på alt** — grunnlaget for konfliktløsning
3. **Soft delete** — en slettet rad må kunne propageres, ikke bare forsvinne

Ikke bygg synklaget nå. Ikke legg inn `laerer_id` heller — det kan utledes når
det blir aktuelt.

Når det blir aktuelt: en selvhostet backend på egen NAS er den personvernmessig
ryddige veien for elevdata delt mellom kolleger, framfor en tredjeparts skytjeneste.
Deling av elevdata mellom lærere krever uansett avklaring med skolen som
behandlingsansvarlig, uavhengig av hvor det ligger.

---

## 10. Senere (ikke v1)

- **Dashboard.** §4.1 dekker grunnbehovet: åpner du appen tirsdag, står tirsdagens
  økt der forhåndsvalgt. Et rikere dashboard kommer senere og bør da vise: hvilke
  økter som mangler skåring, elever uten skåring de siste to ukene, vurderinger
  med frist som nærmer seg, og hvor langt hver periode har kommet mot planen.
  Bygg det ikke før §4.2–4.5 har vært i bruk noen uker — da vet du hva du faktisk
  savner, i stedet for å gjette.
- **Fagpresets og kompetansemål fra Udir.** Når læreren oppretter et fag i §4.0,
  skal hen kunne søke opp det offisielle faget og få fagkode, navn,
  fagbeskrivelse og kompetansemål ferdig utfylt.

  **Ikke skrap nettsidene.** Udir publiserer Grep — den nasjonale databasen for
  fag, læreplaner og opplæringstilbud — som REST-API på `data.udir.no`, med både
  LK06- og LK20-læreplaner, fagkoder og vurderingsordninger. Det finnes også et
  SPARQL-endepunkt. Dokumentasjonen ligger i Udirs egne GitHub-wikier.

  Lisens: dataene er lagt ut under NLOD, som tillater kopiering, endring,
  videreformidling og kommersiell bruk. Det er avklart for App Store-sporet.

  **Hent på byggetidspunktet, ikke i appen.** Et lite skript henter Grep-dataene
  og skriver dem til en JSON-fil som følger med installasjonen. Appen leser fila
  lokalt. Da beholdes null nettverkskall (§1), brukerne trenger ingen API-nøkkel,
  og Udirs rate limiting og API-nøkkelkrav — innført 1. september 2026, med
  anonyme kall begrenset til rundt 100 per 60 sekunder — treffer bare byggesteget.

  Datamodell når det blir aktuelt: `kompetansemal(id, grep_kode, kode, tekst)`
  som egen tabell, junction mot `okt` og `periode`, og `grep_kode` som nytt felt
  på `fag`. I v1 er `okt.kompetansemal`, `periode.kompetansemal` og
  `fag.beskrivelse` fritekst, og migreringen er udramatisk så lenge de feltene
  ikke struktureres på egen hånd.

  **Fritekst må fortsatt virke.** Presets er et hjelpemiddel, ikke et krav. Fag
  uten treff i Grep — lokale valgfag, private tilbud, noe læreren setter opp selv
  — skal kunne opprettes med kode og navn skrevet for hånd, akkurat som i v1.
- **Findelt karakterskala.** De 24 verdiene og båndinndelingen står ferdig
  beskrevet i §5.2. Det som gjenstår er å seede skalaen og bygge rutenettet i
  §4.6. Ingen datamodellendring — skalaer er data.
- **Kalenderintegrasjon.** Import av øktene fra en ekstern kalender, i første
  omgang iCal/`.ics`, slik at timeplanen ikke må punches inn for hånd.

  Dette er det som gjør serieopprettelse overflødig i stedet for savnet. Filen
  leses lokalt fra disk — det er ikke et nettverkskall og bryter ikke §1.
- **InSchool.** Det egentlige målet: å hente timeplan og klasselister fra
  skolens eget system i stedet for å skrive dem inn på nytt. Visma InSchool
  eksponerer i dag ikke lærerens egne timeplandata på en måte som gjør det
  mulig. At dette verktøyet finnes, og at all punching gjøres manuelt, er i seg
  selv dokumentasjon av hva den mangelen koster.

  Ingenting her bygges på spekulasjon. Skulle et brukbart API bli tilgjengelig,
  er importsteget det eneste som må endres — datamodellen står som den er.
- Distribusjon utenfor egen maskin — krever signering, notarisering og en reell
  vurdering av behandlingsansvar.

---

## 11. Byggerekkefølge

| Dag | Innhold | Ferdig når |
|-----|---------|------------|
| 1 | Scaffold, schema, migrasjoner, seeding av skalaer, innstillinger | Fire skalaer ligger i basen, og du kan opprette skoleår, fag og klasse |
| 2 | §4.0 veiviser, §4.3 Elever, §7 import med duplikatgjenkjenning | Samme elev i to fag, gjenkjent og koblet |
| 3 | §4.2 Årsplan: opprett økt, listevisning | En hel termin MFL1 finnes |
| 4 | §4.2 Kalendervisning, perioder, tidslinje, timeregnskap | MFL1 er periodisert for hele året |
| 5–6 | §4.4 Skåringsflyten med full tastaturnavigasjon | 30 elever på under 20 sek |
| 7 | §4.5 Elevskjerm med heatmap | Klar for elevsamtale |
| 8 | §4.6 Vurderinger og resultatføring | Karakter 1–6 kan føres på en oppgave |
| 9 | Eksport og backup, §4.7 oppfølging | Markdown ut av appen |
| 10 | Test med fiktiv økt, §4.9 utskrift hvis tid | Du stoler på den |

Klasseopprykk (§4.3) og flerårsvisningen i §4.5 hører til første gang et nytt
skoleår opprettes, altså august 2027. Datamodellen bærer dem fra dag 1;
skjermene kan komme senere.

Glipper det: dag 1–4 er det du trenger i august, dag 5–7 er det du trenger i
uke 1. Vurderinger, eksport og utskrift kan komme i uke 3.

---

## 12. Til den som bygger

- Migrasjoner som nummererte SQL-filer fra dag én, ikke ad hoc
  `CREATE TABLE IF NOT EXISTS`. Schemaet endrer seg i uke 2.
- Bygg skåringsflyten mot seed-data med 30 elever før UI-et er pent.
  Tastaturflyt og autoadvansering avdekkes bare med realistisk radantall.
- `PRAGMA foreign_keys = ON` ved hver tilkobling. SQLite har det av som standard.
- Datoer som `YYYY-MM-DD`, tidspunkt som lokal ISO. Tidssoner er ikke et problem
  denne appen trenger å ha.
- UUID-generering i frontend (`crypto.randomUUID()`), ikke i SQL.
- Skriv `endret` ved hver UPDATE. Legg det i query-laget, ikke i hver kallsted.
- Seed skalaene i en migrasjon, ikke i applikasjonskode. De skal ha faste UUID-er
  slik at to installasjoner har samme id-er for de innebygde skalaene — det gjør
  senere synk og sammenslåing enklere.
- Ingen aggregering skal noensinne inkludere verdier med `teller_ikke = 1`.
  Legg filteret i selve spørringslaget, ikke i hver visning.
- **Soft delete og `UNIQUE` krangler.** En soft-slettet rad opptar fortsatt
  plassen sin i en unik indeks. Slettes en skåring og settes på nytt, skal den
  gamle raden gjenbrukes — `slettet = NULL` og ny verdi — ikke settes inn på
  nytt. Gjelder `skaring`, `vurderingsresultat`, `elev_fag`, `elev_klasse` og
  `skolear_fag`. Legg det i query-laget én gang.
- **Ingenting spør etter `fag_id` direkte.** Økter, perioder, vurderinger og
  elevkoblinger henger på `skolear_fag`. Skal du vise fagkoden, join deg fram.
  Det er den ene feilen som gjør at to skoleår blander seg.

---

## 13. Visuell retning

Referansen er den norske klassejournalen — linjert, tett, uten pynt. Et
arbeidsverktøy som blir sett på i sekunder om gangen, i et lyst klasserom, ofte
mens noen snakker til deg.

- **Palett:** blekksvart tekst på papirhvit flate. Én kald blå for markert rad og
  fokus. Fag skilles med tynne fargestreker i venstremarg, ikke med flater.
- **Trafikklyset:** dette er det eneste stedet i appen med mettet farge, og det er
  grunnen til at alt annet må være nedtonet. Bruk former som skiller seg fra
  hverandre i tillegg til farge — fylt, halvfylt, tom — så det er lesbart uten
  fargesyn og på avstand.
- **Type:** en smal grotesk til elevnavn og UI, tabulærsifre til datoer og tall.
- **Tetthet:** radhøyde stram nok til at 30 elever får plass uten scrolling på en
  14-tommer. Dette er den viktigste enkeltbeslutningen i hele UI-et.
- **Bevegelse:** nesten ingen. Markørflytting kan ha 80 ms. Resten er umiddelbart.
- **Mørk modus:** ja, men lav prioritet. Klasserom er lyse.

Motstå impulsen til å gjøre dette til et dashboard. Ingen kort med store tall,
ingen grafer på forsiden, ingen sammendragswidget. Appen har én jobb om gangen.
