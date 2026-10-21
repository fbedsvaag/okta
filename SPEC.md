# Økta — spesifikasjon

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
de fagene læreren faktisk har (§3.2). Øktene legges inn manuelt — én og én,
eller mange på en gang (§4.2) — så fleksibel eller forskjøvet skolestart er et
ikke-problem.

### To bærende prinsipper

**Planleggingen skal gi oversikt, ikke bare lagring.** Poenget med å periodisere
er å se om året henger sammen: om en periode er overbooket, om et tema har fått
for få timer, om det er hull i november. En årsplan man ikke kan overskue på én
skjerm løser ikke problemet.

**Skåringen skal ta under 20 sekunder for hele klassen.** Ingen modaler, ingen
dropdowns, ingen lagre-knapp, ingen musbruk. Ett tastetrykk per elev, og markøren
flytter seg selv.

**Færrest mulig klikk.** Det gjelder hele appen, ikke bare skåringen. Det som
allerede er kjent, fylles ut av seg selv (fagets rom, lærerens navn, økta på
fristdagen), og det som skal gjøres mange ganger, skal kunne gjøres på én gang.

### Ikke-mål

- **Ingen karakterer i standpunktforstand.** Vurderingsresultater i appen er
  underveisvurdering og arbeidsdokumentasjon. Standpunkt settes i InSchool.
- **Ingen fraværsføring mot InSchool.** «Ikke i økta» finnes som
  skåringsalternativ og betyr at eleven ikke var der å vurdere. Den er en
  markering i lærerens eget arbeidsmateriale, ikke en fraværsregistrering.
- **Ingen timeplanimport i v1.** Øktene opprettes manuelt i appen, én om gangen
  eller som en serie (§4.2). Kalender- og InSchool-import står i §10.
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
årstimetall, skåringsskala, standard øktvarighet, standard rom, faglærer og
teksten på årsplanarket.

**Aliaset er lærerens eget navn på faget.** SAM3045 er ofte «MFL1» i egne
dokumenter og filnavn. Faget kan søkes opp på begge (§4.4), og aliaset er
det som vises — i appen, i kalenderen (§8.1) og i Teams-kopien. Årsplanarket
viser begge: «MFL1 (SAM3045) — Markedsføring og ledelse 1». Øktkodene
(`2608-SAM3045-3`) bruker den offisielle koden, så de står fast.

**Standard rom gjelder også øktene som finnes.** Settes eller endres rommet på
faget, får økter uten rom — og de som hadde det gamle standardrommet — det nye.
Et rom satt for hånd på én økt står.

```sql
CREATE TABLE fag (
  id           TEXT PRIMARY KEY,
  kode         TEXT NOT NULL,           -- "MFL1"
  navn         TEXT NOT NULL,           -- "Markedsføring og ledelse 1"
  farge        TEXT,                    -- hex, fargestrek i venstremarg
  beskrivelse  TEXT,                    -- fritekst i v1, se §10
  grep_kode    TEXT,                    -- Udirs fagkode, f.eks. SAM3045
  alias        TEXT,                    -- lærerens eget navn, f.eks. "MFL1"
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
  rom          TEXT,                    -- standard rom; fyller ut okt.sted
  laerer       TEXT,                    -- faglærer; NULL = lærernavnet (§4.8)
  kompetansemal TEXT,                   -- fritekst, for fag uten Udir-kode
  arknotat     TEXT,                    -- fritekst øverst på årsplanarket (§4.9)
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
  mentor     INTEGER NOT NULL DEFAULT 0,  -- 1 = min mentorelev dette året
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

**Mentorgruppa er en delmengde av klassen, ikke en egen enhet.** Læreren er
kontaktlærer for kanskje seksten av trettito i `1STC`. Det er `mentor` på
koblingen som sier hvilke seksten, og siden koblingen allerede er per skoleår,
følger gruppa året uten at noe mer trengs. Neste år er det en annen gruppe, og
fjorårets står urørt.

Fordi flagget ligger på klassekoblingen, må en mentorelev ha en klasse. Det
stemmer med begrepet, men betyr også at merket følger med når klassen fjernes.

En mentorelev trenger ikke være i noe fag. Det er det vanlige tilfellet: du er
kontaktlærer for elever du ikke underviser. Spørringer som forutsetter minst én
fagkobling er derfor feil — se §4.3 og §7.

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

**Perioden står på økta.** `okt.periode_id` bestemmer, alltid. Perioden er en
merkelapp: man markerer økter i lista og trykker P (§4.2). `periode.start` og
`periode.slutt` følger øktene: første og siste økt i perioden. En ny økt som
legges midt i en periode, får perioden med én gang.

Perioden utledes ikke av datoene. Gjorde den det, kunne en økt ikke tas ut av
en periode uten å flytte periodegrensene.

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
  farge          TEXT,                  -- settes når perioden lages, fra en fast rekke
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
  kompetansemal  TEXT,                  -- fritekst, for fag uten Udir-kode
  sted           TEXT,                  -- rom; forhåndsutfylt fra faget
  agenda         TEXT,                  -- skrevet for eleven; går ut i kalenderen
  lekse          TEXT,                  -- på årsplanarket; aldri i kalenderen
  plan           TEXT,                  -- markdown, lærerens egne notater
  logg           TEXT,                  -- markdown, hvordan det gikk
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

-- Kompetansemål fra Udir på én økt, utover dem perioden dekker. Samme
-- mønster som periode_kompetansemal: bare koden lagres, teksten ligger i
-- grep-fag.json. Økta arver periodens mål; de står ikke her.
CREATE TABLE okt_kompetansemal (
  id         TEXT PRIMARY KEY,
  okt_id     TEXT NOT NULL REFERENCES okt(id),
  kode       TEXT NOT NULL,
  opprettet  TEXT NOT NULL,
  endret     TEXT NOT NULL,
  slettet    TEXT,
  UNIQUE(okt_id, kode)
);

CREATE TABLE skaring (
  id            TEXT PRIMARY KEY,
  elev_id       TEXT NOT NULL REFERENCES elev(id),
  okt_id        TEXT NOT NULL REFERENCES okt(id),
    skalaverdi_id TEXT NOT NULL REFERENCES skalaverdi(id),
  notat         TEXT,                   -- leses ikke lenger, se oktnotat
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT,
  UNIQUE(elev_id, okt_id)
);

-- Notatet på en elev i en økt. Egen tabell, så det lagres også når eleven
-- ikke er skåret (skalaverdi_id er NOT NULL, og en skåringsrad uten verdi
-- skal ikke finnes). skaring.notat ble flyttet hit i migrasjon 022.
CREATE TABLE oktnotat (
  id         TEXT PRIMARY KEY,
  elev_id    TEXT NOT NULL REFERENCES elev(id),
  okt_id     TEXT NOT NULL REFERENCES okt(id),
  tekst      TEXT NOT NULL,
  opprettet  TEXT NOT NULL,
  endret     TEXT NOT NULL,
  slettet    TEXT,
  UNIQUE(elev_id, okt_id)
);
```

`okt.kode` er en lesbar identifikator på formen `YYMM-fagkode-#`, der `#` teller
øktene i det faget den måneden. `2608-ENG1-3` er tredje engelsktime i august
2026. Den er til for å kunne snakke om og søke opp en økt, ikke for sortering —
sorteringen skjer alltid på `dato` og `klokkeslett`.

Én rad per elev per økt. Skåres eleven på nytt, oppdateres raden — det lages
ikke historikk. Notatet på eleven i økta bor i `oktnotat`, ikke på
skåringsraden, og fjernes ikke når skåringen fjernes.

**Økta er avholdt så snart minst én elev er skåret.** Det utledes, det er ikke
et felt. I en avholdt økt har hver elev en verdi mellom `0` og `3`: de du har
trykket på har den verdien du satte, resten er `0`. Bare det du faktisk trykker
lagres — resten fylles ut ved visning, slik at en økt ikke legger igjen 30 rader
som bare sier at ingenting skjedde.

**Tellingen av avholdte økter går på dato.** I fagpanelet og årsoversikten er
en økt holdt når datoen er i dag eller passert, enten den er skåret eller
ikke. Regelen over gjelder skåringen: hvilke verdier elevene står med.

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
  okt_id    TEXT REFERENCES okt(id),    -- ubrukt; se vurdering_okt
  skala_id  TEXT NOT NULL REFERENCES skala(id),
  tittel    TEXT NOT NULL,              -- "Fagartikkel: markedsanalyse"
  type      TEXT,                       -- muntlig | skriftlig | praktisk
  frist     TEXT,
  beskrivelse TEXT,
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

CREATE TABLE vurdering_okt (
  id           TEXT PRIMARY KEY,
  vurdering_id TEXT NOT NULL REFERENCES vurdering(id),
  okt_id       TEXT NOT NULL REFERENCES okt(id),
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT,
  UNIQUE(vurdering_id, okt_id)
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

**En vurdering kan holdes i én eller flere økter.** En muntlig vurdering får
ikke alltid plass i én. Koblingen står i `vurdering_okt`; `vurdering.okt_id`
rommet bare én, og leses ikke lenger.

Koblingen skrives av seg selv i det vanlige tilfellet:

- når fristen faller på en dag der faget har nøyaktig én økt,
- når en økt legges inn på en dag der en vurdering i faget har frist,
- når samtaletrekkeren legges i økter (§4.10).

Den kan også settes og løses for hånd, fra vurderingen og fra økta. Knyttes en
vurdering uten frist til en økt, blir øktas dato fristen. Flyttes fristen,
følger økta med bare når koblingen var «økta på fristdagen» og den nye dagen
har en økt — en innlevering som gis ut i én time og leveres senere, beholder
timen sin.

### 3.5 Notater og møtelogg

```sql
CREATE TABLE elevnotat (
  id               TEXT PRIMARY KEY,
  elev_id          TEXT NOT NULL REFERENCES elev(id),
  skolear_id       TEXT NOT NULL REFERENCES skolear(id),
  skolear_fag_id   TEXT REFERENCES skolear_fag(id),  -- NULL = ikke knyttet til ett fag
  dato             TEXT NOT NULL,        -- når møtet eller observasjonen skjedde
  tekst            TEXT NOT NULL,        -- markdown
  skal_folges_opp  INTEGER NOT NULL DEFAULT 0,
  frist            TEXT,                 -- valgfri, også når skal_folges_opp = 1
  lukket           TEXT,                 -- NULL = åpent
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);
```

Notatet henger alltid på en elev og et skoleår. Fag er valgfritt — en
mentorsamtale har som regel ikke noe fag, en avtale om ekstra arbeid i MFL1
har det.

`dato` er når det skjedde, ikke når du skrev det. Man logger ofte i etterkant.

Denne tabellen tar over for både `oppfolging` og fritekstfeltet `elev.notat`.
Et felt som overskrives har ingen historikk å vise, og det var nettopp
historikken som manglet. Se §4.7.

```sql
-- Gjøremål som ikke hører til noen elev — «kopier prøvene til fredag».
-- Et gjøremål med elev er et elevnotat med skal_folges_opp = 1.
CREATE TABLE gjoremal (
  id         TEXT PRIMARY KEY,
  skolear_id TEXT NOT NULL REFERENCES skolear(id),
  tekst      TEXT NOT NULL,
  frist      TEXT,
  ferdig     TEXT,                       -- dato det ble krysset av; NULL = åpent
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);
```

Gjøremålene på forsiden (§4.1) har ingen egen kopi av noe: de leses fra
`elevnotat` (oppfølging og ukryssede `- [ ]`), fra øktloggene (`- [ ]`) og
fra `gjoremal`, og krysses av der de bor.

### 3.6 Samtaler

Muntlige samtaler med klokkeslett per elev — fagsamtaler og mentorsamtaler.
Se §4.10.

```sql
CREATE TABLE samtaledag (
  id             TEXT PRIMARY KEY,
  skolear_id     TEXT NOT NULL REFERENCES skolear(id),
  skolear_fag_id TEXT REFERENCES skolear_fag(id),  -- NULL = mentorsamtale
  vurdering_id   TEXT REFERENCES vurdering(id),    -- flere dager, samme vurdering
  okt_id         TEXT REFERENCES okt(id),          -- NULL = egen dag utenfor øktene
  dato           TEXT NOT NULL,
  fra            TEXT NOT NULL,        -- "08:30"
  til            TEXT NOT NULL,        -- "15:00", overstyrbar
  lunsj_fra      TEXT,                 -- "11:45". NULL = ingen lunsj
  lunsj_min      INTEGER,              -- 30
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

CREATE TABLE samtale (
  id             TEXT PRIMARY KEY,
  samtaledag_id  TEXT NOT NULL REFERENCES samtaledag(id),
  elev_id        TEXT NOT NULL REFERENCES elev(id),
  klokkeslett    TEXT NOT NULL,        -- "09:30"
  varighet_min   INTEGER NOT NULL,
  tema           TEXT,                 -- "Oppgave 4 · Markedsanalyse"
  motte          INTEGER NOT NULL DEFAULT 1,  -- 0 = eleven møtte ikke
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT,
  UNIQUE(samtaledag_id, elev_id, klokkeslett)
);
```

**Samtaledagen er ikke en økt.** Den likner — samme dato, samme fag, samme
elever — men den har klokkeslett per elev, og i mentormodus har den ikke noe
fag. `okt.skolear_fag_id` er `NOT NULL` og bærer timeregnskapet, kalenderen og
publiseringen; å gjøre den nullbar for denne ene tingens skyld ville berørt
hver spørring som antar at et fag finnes.

Prisen er at samtaledager må kobles inn i kalenderen (§4.2) og i det som
blokkerer undervisning med vilje. Det er en kjent kostnad, ikke en glipp.

**En samtaledag kan ligge i en økt.** Da er øktas klokkeslett og varighet
rammen, uten lunsj, og dagen følger økta hvis den flyttes eller endrer lengde.
Timene er allerede talt som økt, og telles ikke en gang til i timeregnskapet.
Slettes økta, blir dagen en vanlig samtaledag igjen.

**En gruppesamtale er flere samtalerader på samme klokkeslett** samme dag. Den
trenger ingen egen tabell: nøkkelen tillater det allerede, og plassen utledes
av klokkeslettet.

**`til` foreslås fra siste samtale, men kan overstyres.** Noen ganger settes
dagen av lenger enn samtalene varer, og da er det den avsatte tida som gjelder.

**Plasseringen i dagen lagres ikke.** Den utledes av `klokkeslett` sortert
innen dagen. Ett sted å skrive, ingen verdi som kan komme i utakt med klokka.

Nøkkelen er `(samtaledag_id, elev_id, klokkeslett)` og ikke bare de to første:
en elev som ikke møtte kan settes opp igjen senere samme dag, og da finnes hen
to ganger. Se §4.10.

### 3.7 Indekser

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
CREATE INDEX idx_mentor        ON elev_klasse(skolear_id) WHERE mentor = 1 AND slettet IS NULL;
CREATE INDEX idx_elevnotat      ON elevnotat(elev_id, dato) WHERE slettet IS NULL;
CREATE INDEX idx_elevnotat_apen ON elevnotat(skolear_id)
  WHERE skal_folges_opp = 1 AND lukket IS NULL AND slettet IS NULL;
CREATE INDEX idx_samtaledag_ar ON samtaledag(skolear_id, dato) WHERE slettet IS NULL;
CREATE INDEX idx_samtale_dag   ON samtale(samtaledag_id)       WHERE slettet IS NULL;
CREATE INDEX idx_samtale_elev  ON samtale(elev_id)             WHERE slettet IS NULL;
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

**Menyen er én rad:** I dag · Økter · Elever · Vurderinger · Samtaler · Fag, og
til høyre søk (⌘K), skoleåret og Innstillinger. Liste, Kalender og Perioder er
tre måter å se øktene på, og står som en bryter først i verktøylinja i Økter —
på samme sted i alle tre. Skoleruta (ferier og fridager) ligger under
Innstillinger.

### 4.0 Førstegangsoppsett

Appen starter helt tom. Første gang den åpnes møter brukeren en veiviser.
Første steg er **Velkommen**, med valget mellom å lese inn en oppsettfil fra
en kollega (§8.2) og å sette opp selv. Stegene er da Velkommen, Skoleåret,
Fagene dine, Elevene og Ferdig, i denne rekkefølgen fordi hvert steg avhenger
av det forrige:

1. **Opprett skoleåret** — navnet ditt, skoleårets navn, startdato, sluttdato.
   Det blir det aktive. Navnet ditt blir faglærer på årsplanen i alle fag
   (§4.8), og er utfylt fra før når neste skoleår opprettes.
2. **Velg fagene du har i år.** Fagene ligger i en fagbank (§3.2) og velges inn
   i skoleåret. Er banken tom, eller mangler faget, opprettes det her med kode,
   navn og farge — `MFL1`, `EBU2`, `Norsk`, hva brukeren nå enn underviser i.
   Neste år velges de samme fagene inn på nytt uten å skrives inn igjen.
3. **Legg inn klasselister i fagene.** Ett fag om gangen: lim inn lista (§7)
   (InSchool-PDF eller `fornavn etternavn; klasse`). Klassen (`1STC`, `3STB`) settes i
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

**Enkel og Full** (ARBEIDSLISTE 20.5, lerretet IDagOppsett). Bryteren øverst
til høyre, valget huskes; Enkel er standard. Innholdet står som fliser i et
rutenett med fire kolonner og faste rader, uten hull.

- **Enkel:** Dagens økter (stor), Følg opp i dag og Gjøremål.
- **Full:** i tillegg Uka over hele bredden, og under den Vurderingsfrister,
  Elever som glipper og Innsats over tid. Uka har bryteren Timer · Kompakt;
  Kompakt er én rad, og flisene under glir rolig opp.
- **Følg opp i dag:** per fag du har i dag, gruppert i Rød sist (med «to på
  rad»), Ikke sett sist og Borte sist, fra den siste avholdte økta. Bare
  fornavn og forbokstav.
- **Innsats over tid** (flisen): per fag, andelen grønn, gul, rød og grått
  (til stede, ikke sett), regnet av dem som var til stede.
- Timeregnskapet og innsatsen uke for uke står under rutenettet i Full.
- Flisene glir rolig til ny plass (360 ms, myk ut-kurve, ingen sprett).
  Tilpasning av fliser og størrelser kommer senere (ARBEIDSLISTE 21.2).

Øverst datoen, og under den **Dagens økter**. Under hver økt står notatet fra
forrige økt i faget, og det kan foldes ut. Et klikk åpner økta notatet ble
skrevet i.

Under: **uka** som kalender, fem dager med øktene på klokkeslettet sitt, blabar
uke for uke. En strek viser klokka nå — tydelig i dagens kolonne, svak bak
øktene resten av uka. En økt åpnes med et klikk, som et kort over forsiden.

Under igjen: **årsoversikten** — timeregnskap, **gjøremål**, vurderingsfrister og
elever som glipper (minst to røde blant de fem siste øktene, som i Elever;
lavest snitt først, på tvers av skalaer).

**Gjøremål** samler alt som venter: notater merket «skal følges opp» som ikke
er lukket, og ukryssede avkrysningsbokser (`- [ ]`) i elevnotater og
øktlogger. Fristene først. Krysses av rett på forsiden, og et klikk åpner
eleven eller økta. Et nytt gjøremål skrives øverst i bolken: tekst, og
valgfritt elev og frist. Med elev blir det et oppfølgingsnotat på eleven;
uten et eget gjøremål (§3.5).

Under de åpne står **Logg** — gjøremål og oppfølginger lukket de siste 14
dagene, gruppert per dag, med klokkeslett og «Angre» på det som nettopp ble
krysset av. Loggen leses fra `lukket`-tidspunktet; eldre står i arkivet og
på elevkortet.

**Innsats over tid** går over hele bredden nederst: én rad per fag, én
søyle per skoleuke, 100 % stablet grønn, gul, rød og fravær. Til høyre andelen
grønn de siste fire ukene med økter, og endringen mot de fire før i
prosentpoeng; ferie og uker som ikke har kommet, hoppes over, og «ikke i
økta» holdes utenfor andelen (§5.1). Holder man over en søyle, vises ukas tall;
et klikk åpner ukas økter.

Elever, vurderinger og fag fra forsiden åpnes også som kort over den.
**Økta åpnes som et ark** over forsiden (og over øktlista eller kalenderen
når den åpnes derfra), ikke som full skjerm — se §4.4.

### 4.2 Årsplan — økter per fag

Alle fag i én kronologisk liste, med fagfilter og søk i tema, innenfor det
aktive skoleåret. To visninger som veksles med en bryter øverst: **Liste |
Kalender**.

**Perioden er en merkelapp på økta**, ikke en fargelegging av datoer.
Periodene står som filtre over lista med antall økter og timer. Marker økter
og trykk P for å sette periode. Radene fargelegges ikke.

Med et fag valgt har Økter en fjerde inngang først: **Oversikt**, fagsiden.
Bryteren er da Oversikt | Økter | Kalender. Fagsiden viser timene mot
årstimetallet, neste økter, kommende vurderinger, klassen økt for økt,
elevene nå med fraværet, kompetansemålene med hvor langt de er dekket, og
øktloggene.

#### Året

Med et fag valgt er bryteren Oversikt | Året | Økter | Kalender (ARBEIDSLISTE
20.6, lerretet Arsplanlegger). Året er hele skoleåret som én stripe av
**økter** (ikke uker), med ferier skravert på ukedagene faget har, måneder,
«I dag» og vurderingene som gule merker.

- Periodene er felt på stripa. De dras inn fra lista, flyttes sidelengs og
  forlenges i begge ender, og hopper til økter; en boble viser spenn og antall
  mens man drar. Start og slutt ligger aldri i en ferie.
- **Perioden står fortsatt på økta (§3.3).** Å dra setter perioden på øktene i
  det nye spennet og tar den fra øktene som falt utenfor, i én omgang som kan
  angres. Perioder overlapper ikke: en ende som dras inn i naboen, flytter
  grensen (naboen beholder minst én økt), og en periode som flyttes, stopper
  mot naboene.
- Ny periode: dra over en tom del av stripa, skriv navn, velg farge, ↵. Et
  enkelt klikk gir åtte økter.
- Under stripa: periodene med øktene foldet ut (dato, vurderingsmerke, tema
  som skrives rett inn, ↵/↓ og ↑), og kompetansemålene. Med en periode valgt
  knyttes mål med et klikk; uten valg viser hvert mål «✓ Dekket» med
  periodeprikker, eller «Ikke dekket». «Gi N økter perioden» fyller hull.
- **Fjoråret som mal** («Hent fra i fjor …»): periodene legges på de samme
  ukene regnet fra skoleårets første uke, med datoene i fjor og i år og
  antall økter (+/−). Man velger perioder, kompetansemål, tema, plan og agenda
  (fylles bare der årets økt er tom) og vurderinger. Ingenting om elevene.
  Erstatter årets perioder og kan angres. Tilbys i Året når faget ikke har
  perioder i år.
  Vurderingene kommer som **utkast**: dempet ikon og «utkast» i Året, Økter
  og Vurderinger, og ikke blant fristene i I dag før de er bekreftet. «Bekreft»
  i vurderingen eller «Bekreft alle» over lista gjør dem vanlige.

#### Listevisning (standard)

Øktene kronologisk nedover, under månedsoverskrifter. Per rad: dato, ukedag,
klokkeslett, varighet, tema, og om det henger en vurdering på økta. Hvilke
kolonner som vises, velges.

**Temaet skrives rett i lista.** Feltet står åpent i hver rad; Enter lagrer og
hopper til neste rads tema, Shift+Enter til forrige, Esc angrer. En hel termin
kan skrives inn nedover uten å åpne noe.

Klikk ellers på raden åpner økta som et kort over lista — lista beholder
bredden og kolonnene sine under: dato, klokkeslett, varighet, tema, rom,
agenda (med «Kopier til Teams»), lekse, kompetansemål og vurdering, og over
øktloggen notatet fra forrige økt i faget. Plan vises bare der det allerede
står noe. Samme kortlogikk gjelder elever, vurderinger og fag (DESIGN.md §7).

**Periodisering er fargelegging.** Med ett fag i filteret står fagets perioder
som pensler over lista, og radenes periodefarge vises bare da. Velg én, og klikk eller dra over radene for å farge
dem; viskelæret tar perioden bort. «+ Ny periode» lager en og velger den, og
dobbeltklikk på en pensel gir perioden nytt navn. Er det krysset av for rader,
farges de med ett klikk. Radene har en svak tone i periodens farge.

Dette er visningen du står i når du planlegger. Den skal tåle å bli scrollet
gjennom et helt år uten å bli tung.

#### Kalendervisning

Samme økter lagt ut i en uke- eller månedskalender. **Bare mandag til fredag** —
lørdag og søndag tar plass uten å inneholde noe.

Kalenderen er for å se hvordan uka faktisk ser ut: fire økter i uka er det
normale, noen uker flere. Klikk på en dag oppretter en økt der; klikk på en økt
åpner den for redigering.

#### Opprett ny økt

Én økt med «+ Ny økt», eller mange på en gang med «+ Serie» — ukedager og
klokkeslett over et spenn, eller dager klikket fram i kalenderen. Varighet
forhåndsutfylles etter arvekjeden i §4.8; standard er 180 minutter. Rommet
forhåndsutfylles fra faget, og perioden fra en farget periode økta faller midt
i.

Mange økter samtidig er med vilje: færrest mulig klikk (§1). Flere kan også
slettes samtidig.

#### Timeregnskap

Alltid synlig øverst i faget: antall planlagte økter, sum timer, og sum per
periode. Er årstimetall lagt inn på faget (§4.8), vises differansen.

Det svarer på om en periode er overbooket mens det ennå er tid til å endre den.

Bare økter som ligger innenfor skoleårets spenn teller. En økt datert før
skolestart eller etter skoleslutt vises fortsatt i kalenderen, men tonet ned
som «utenfor» — og da kan den ikke samtidig telle mot årstimetallet.

**Samtaledager teller med, i faktiske timer.** Regnskapet svarer på om det er
tid nok til å komme gjennom det som skal gjennom, og en dag med muntlige
samtaler er en dag uten undervisning. Holdes de utenfor, planlegger man for
mye.

Timene regnes fra `fra` til `til`, **minus lunsjen**. 08:30–15:30 med 30
minutters lunsj er 6,5 timer. Går vurderingen over flere dager, summeres hver
dag for seg. Lunsjen trekkes bare fra når dagen faktisk er lang nok til å nå
den — ellers regnes kapasiteten for lavt.

Vist som egen linje, ikke blandet inn i samme sum:

```
SAM3045   123 av 140 timer, hvorav 6,5 til vurdering
```

Økter og samtaledager regnes dermed ulikt — økter i faste blokker,
samtaledager i faktisk tid. Det er greit så lenge de vises hver for seg.
Summen skjuler ikke at de to er ulike størrelser.

### 4.3 Elever — alle elever, klasser og fag

Motstykket til Elever-fanen i Excel, og limet mellom alt annet. En liste
med alle elevene i det aktive skoleåret, gruppert på klasse, fag eller
alfabetisk (valget huskes):

```
2STA  8 elever
  Artie Bucco         2STA   MFL1  MFL2   ▪▪▪▪▪▪▪▪▪▪   –
  Christopher Moltisanti M   MFL2  ENG1   ▪▪▪▪▪▪▪▪▪▪   ▬ 11 %   ●
```

- Per rad: bilde, fornavn og etternavn, M for mentorelev, klasse, fagene
  med fagfirkant, innsatsen de siste ti øktene som ruter, og fraværet i
  prosent av fagets timer med en liten stolpe mot 10 %-grensen (det
  høyeste faget; se §4.12). En rød prikk når eleven glipper: minst to
  røde blant de fem siste øktene.
- Filterpiller for fagene, «Uten fag» og Mentorelever, fritt kombinert.
  Søk i verktøylinja.
- Klikk åpner elevkortet (§4.5). **Eleven endres der:** klasse, fag,
  mentor, kjønn, bilde og sletting. Lista har ingen redigering i radene.
- Elever med et åpent, forfalt oppfølgingspunkt får et merke ved navnet.
  Merket sier bare at noe venter, aldri hva.
- **Endringer på mange elever samtidig** (merke flere og endre fag,
  klasse eller mentor, eller slette) skal tegnes i lerretet før det bygges.
- Sletter man en elev, forsvinner alt som hører til eleven: skåringer,
  vurderingsresultater, notater, samtaler og koblinger.

#### Elever inn i appen

Elevene kommer inn med **Lim inn liste** (§7): InSchool-PDF-en, eller en
liste skrevet som `fornavn etternavn; klasse`, én per linje. «Ny elev» i
verktøylinja lager én elev og åpner elevkortet. Det finnes ingen tom rad
for manuell innlegging nederst i lista.

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

Motstykket til Tracking-fanen, og den daglige bruken. Åpnes som et ark over
skjermen man kom fra; Esc lukker og alt er lagret. Pågår økta, står det
«Pågår · n min igjen» i toppen, og over lista hvor mange som er skåret.

Økta har **to moduser i samme ark**, med en bryter øverst til høyre:
**Skåring og logg** og **Planlegging**. Åpnes økta fra I dag, eller pågår
den eller er den ferdig, åpner den i skåring. Ligger den fram i tid, åpner
den i planlegging. ⌘← og ⌘→ blar til forrige og neste økt i faget.

Øverst: fag, tittel, når økta er («om 3 dager», «Pågår · 50 min igjen»),
dato, tid, rom og periode, og Ferdig (⌘↵).

**Skåring og logg.** Elevlista for faget, alfabetisk på fornavn, én rad per
elev (38 px). Trafikklyset står **først**, foran bildet (28 px) og navnet,
så blikket ikke må hoppe:

```
 ▸  ●  ○  ○  ○   Anna Reistad       2STB   notat fra økta
    ○  ○  ●  ○   Benjamin Holm      2STA
```

Til høyre: notatet fra forrige økt, planen med avkrysning og øktloggen.

Den dagen økta er, står planen live i høyre kolonne: hva som skal skje nå,
hvor langt man er kommet, og hvor mye tid som er igjen. En aktivitet
krysses av når tida for den er ute, eller med et klikk når man er ferdig
før tida (tidspunktet lagres). «+5 min» forlenger den som pågår, og resten
flytter seg; det som havner etter slutt, sies uten alarm. Oppdateres én
gang i minuttet, uten bevegelse: skåringen animeres aldri.

**Planlegging.** Dato, tid, rom, periode og vurdering; lekse og agenda til
elevene; planen med aktiviteter, pauser, minutter og en beskrivelse per
aktivitet, summen mot øktas lengde og en tidslinje man drar i; øktas
lengde endres aldri herfra. Kompetansemålene i økta med avkrysning, der
periodens mål er merket; resten er foldet sammen.

Planen lagres som markdown i `okt.plan`, lesbar i arkivet:
`- [ ] Gruppearbeid · 30 min`, beskrivelsen innrykket under, `- Pause ·
10 min`, og i skåringen `· +5 min` og `· ferdig 09:16`. Plan og
beskrivelse går aldri ut av appen.

**Øktplan: Enkel | Full** (Innstillinger › Generelt, standard Enkel).
Enkel er en liste med minutter («Film · 15 min» kan skrives inn) og én
linje om hva som skjer nå i skåringen. Full har tidslinjen, beskrivelser
og pauser. Det som er skrevet i Full, blir liggende i Enkel. Til høyre: forrige økt, «Følg opp i økta» (rød to ganger på rad,
borte sist, åpent oppfølgingspunkt; bare fornavn og grunn) og hvor i
perioden økta ligger.

Tastene i skåringen:

| Tast | Handling |
|------|----------|
| `1` | Rød — og hopp til neste elev |
| `2` | Gul — og hopp til neste elev |
| `3` | Grønn — og hopp til neste elev |
| `0` | Ikke i økta — og hopp til neste elev |
| `↓` `↑` | Flytt uten å skåre |
| `⇥` `⇧⇥` | Flytt uten å skåre — samme som pil ned/opp |
| `N` | Åpne notatfelt for markert elev |
| `⌘K` | Søk — se under |
| `⌫` | Fjern skåre på markert elev |

Tastene er ikke hardkodet — de utledes av skalaens rangering (§5.1), slik at en
annen skåringsskala virker uten kodeendring.

Autoadvansering er hele poenget. Du går nedover lista med tallrekka og er ferdig
med 30 elever på under 20 sekunder. Notat er unntaket, ikke regelen. Et notat
kan skrives på en elev som ikke er skåret, og står da i elevens tidslinje
(§4.7).

Notatet fra denne økta står i en egen kolonne på raden; N åpner feltet der.
Står markøren på en elev uten notat, vises siste skåringsnotat i grått i den
samme kolonnen.

**En elev du ikke har trykket på i en avholdt økt, var til stede, men ble ikke
sett** (ARBEIDSLISTE 19.4). Det er ikke fravær og teller ikke i noen
sammenstilling, heller ikke i innsatssnittet; det vises som en tom ring i
heatmap og elevkort. Bare `0` — «ikke i økta» — er fravær (§4.12). Ved Ferdig
sier en rolig linje fra hvor mange som ikke er skåret, uten å stoppe deg.
Filteret over lista har Alle · Til stede · Borte · Ikke sett, og «Følg opp i
økta» viser «Ikke sett sist».

Før du har trykket på noen som helst er økta ikke avholdt, og radene står tomme.

Talltasten setter verdi og flytter markøren videre; det er den flyten som gir
20 sekunder. Tab, Shift+Tab og piltastene flytter uten å skåre, så du kan gå
tilbake og rette. Den samme verdien kan også velges med musa fra en
nedtrekksliste på raden — tastene er snarveien, ikke den eneste veien.

Nederst: fritekstfelt for øktlogg — hvordan det gikk med klassen samlet.

#### ⌘K — søk i hele appen

⌘K åpner et søkefelt hvor som helst i appen, også her. Det finner elever (navn,
klasse, fag) og økter (tema, fagkode, fagnavn, alias og dato). Datoer kan
skrives som 2026-10-12 — det vanlige, også i filnavn — eller 12.10.2026,
12.10.26, 12.10, 12/10, og 2026-10 for en hel måned. Flere ord snevrer inn:
«mfl1 2026-10». Økter med ordet i temaet kommer først, deretter de nærmest i
dag.

Elevtreffene viser bildet, navnet og fagene eleven har hos deg. Enter på en
elev åpner elevkortet over hele skjermen, uten elevlista ved siden av. Enter
på en økt åpner den som et kort over der du står.

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

Under igjen: notater og møtelogg (§4.7).

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

### 4.7 Notater og møtelogg

Ikke en egen skjerm — en bolk nederst på elevsiden (§4.5), under heatmap og
vurderinger. Samme sted dekker faglige notater og oppfølging av
mentorelever: et notat henger alltid på en elev og et skoleår, men aldri
nødvendigvis på et fag. En mentorsamtale har som regel ikke noe fag; en
avtale om ekstra arbeid i MFL1 har det.

Kronologisk liste, nyeste øverst. **+ Nytt notat** åpner et felt: dato (i dag
som forvalg), fritekst, og en avkrysning «skal følges opp» som viser et
valgfritt fristfelt når den hakes av. Fristen er valgfri også når boksen er
hakt av — mye oppfølging har ingen dato, bare en tilstand: ikke gjort ennå.

Notater merket «skal følges opp» og ikke lukket ligger fast øverst i lista,
foran de kronologiske — uavhengig av dato. Har notatet en frist som er
passert, markeres det som forfalt. Har det ingen frist, ligger det bare
øverst, uten noen forfalt-markering — det er ingenting å sammenlikne mot.
Lukking er ett klikk, og notatet synker da ned til sin naturlige plass i
kronologien.

Notatene fra øktene (§4.4) står i samme tidslinje, flettet inn etter dato,
med skåringens farge på prikken og fag og tema som åpner økta. Et filter
øverst — Alle · Møtelogg · Fra øktene — skiller dem når det finnes begge
deler. Bolken kan legges sammen med et klikk på overskriften, og valget
huskes.

Åpne oppfølgingspunkter står også i Gjøremål på forsiden (§4.1).

Elever med et åpent, forfalt oppfølgingspunkt får et lite merke ved navnet i
elevtabellen (§4.3) — **merket sier bare at et punkt venter, aldri hva det
er.** Elevtabellen vises på skjerm i klasserommet og i møter; innholdet i et
notat skal aldri være synlig der uten at du selv åpner eleven.

### 4.8 Innstillinger

Globale valg lagres i `innstilling` som nøkkel/verdi. Ingenting av dette skal
være hardkodet i applikasjonskoden.

| Nøkkel | Betydning | Standard |
|--------|-----------|----------|
| `standard_varighet_min` | Forhåndsutfylt varighet på nye økter | `180` |
| `aktivt_skolear` | Hvilket skoleår appen viser | første opprettede |
| `laerer_navn` | Faglærer på årsplanen i alle fag. Spørres om når skoleåret opprettes (§4.0) | ikke satt |
| `arsplan_felt` | Hvilke felt som står på årsplanarket (§4.9) | se §4.9 |

Etikettene på trafikklyset (§5.1) ligger på `skalaverdi.etikett` og redigeres
der, ikke som en egen innstilling. Ett sted, ikke to.

**Arkivmappa (§8) er ikke i databasen.** Den velges i Innstillinger › Arkiv og
huskes av Rust-siden i `arkivmappe.txt` i appens datamappe. Ligger den i
databasen og sendes med fra vinduet, kan et skript i vinduet styre hvor filer
skrives (se §8, Sikkerhet).

Skjermen har disse delene:

- **Skoleår:** navn, start, slutt, hvilket som er aktivt, og inngangen til
  Skoleruta. Nytt skoleår opprettes her, med klasseopprykk (§4.3) som neste
  steg.
- **Fagbank og fag i år** ligger under Fag, ikke her: kode, navn, alias, farge,
  Udir-kode, og for året årstimetall, standard varighet, standard rom,
  faglærer, kompetansemål (fritekst for fag uten Udir-kode) og teksten på
  årsplanarket.
- **Skalaer:** se og lage skåringsskalaer og vurderingsskalaer
- **Generelt:** lærernavn og standard varighet
- **Arkiv:** mappa tekstfilene i §8 skrives til

**Varighet arves i tre ledd:** global standard → fagets standard → øktas egen
verdi. Nye økter (§4.2) forhåndsutfylles fra fagets standard, og verdien kan
endres på den enkelte økta etterpå. Ingen av leddene skal kreve at man skriver
180 på nytt hver gang.

Fagets standard ligger på `skolear_fag`, ikke på fagbanken — varigheten kan
være en annen neste år uten at faget selv endres.

### 4.9 Årsplanen ut av appen

Ett fag for ett år, på ett til tre ark — arket elevene får. «Årsplan …» i
Økter gjelder faget i filteret, eller alle fag (ett per side) når filteret
står på «Alle fag»:

- **Skriv ut / lagre som PDF** — egen utskriftsvisning, ikke skjermbildet.
  Flyter over så mange sider som trengs, med tabellhodet gjentatt.
- **Kopier som markdown**, eller **lagre som .md**
- **Lagre som Word (.docx)** — samme uttrykk som appen
- **Lagre som regneark (.csv)** — semikolon og BOM, slik norsk Excel vil ha det

Alle fire bygges av samme innhold, så de sier det samme.

PDF-en har egne A4-sider: toppen med fag, faglærer, rom, tid, timene per
periode, teksten om faget og kompetansemålene på første side; en smal
topplinje og «<periode> fortsetter» på de neste; «Side n av N» nederst.
Ferier står som egne linjer i kursiv.

**Øverst:** fag, skoleår, faglærer, rom, timeregnskap (økter og timer mot
årstimetallet, med samtaledager som egen hale), teksten på årsplanarket, og
kompetansemålene — fra Udir når faget har kode, ellers fritekstfeltet.

**Tabellen:** uke, dato, tema, lekse og vurdering; valgfritt også klokkeslett,
timer, rom, agenda og kompetansemål. Kompetansemålene i kolonnen er øktas
egne; periodens mål står under periodenavnet. Øktene kan grupperes under
periodene sine. Kolonner uten innhold utelates. Lesbar i svart-hvitt.
Arket kan skrives ut og lagres som Word liggende.

**Hvilke felt som står på arket, velges** under «Velg felt …», og huskes.
Plan og øktlogg kan ikke velges: de er lærerens egne notater.

### 4.10 Samtaletrekkeren

Trekker tema og rekkefølge for muntlige samtaler og legger dem ut som en
timeplan med klokkeslett per elev.

**Formen er én sammenhengende kolonne til venstre og resultatet til høyre.**
Ingen faner, ingen steg, ingen veiviser i oppsettet. Alt som styrer trekningen
er synlig samtidig, og resultatet oppdateres ved siden av.

#### Oppsettskolonnen, i rekkefølge

1. **Modus** — Fagsamtale eller Mentorsamtale, som to knapper.
2. **Grunninnstillinger** — antall elever, minutter per samtale, pause mellom
   samtaler, og om samtalene er enkeltvis eller i grupper (se under). Antallet
   fylles ut fra elevlista, men kan overstyres.
3. **Elever** — hentes fra faget (`elev_fag`) i fagsamtale, fra mentorelevene
   (§3.2) i mentorsamtale. Kan overstyres ved å lime inn en liste, for grupper
   som ikke er i appen.
4. **Oppgavenummer og tema** — bare i fagsamtale. Skjules helt i mentormodus;
   en mentorsamtale har ikke oppgavenummer. Ingen øvre grense på antall temaer.
5. **Samtaledager.** I fagsamtale: først vurderingen trekningen hører til,
   så fagets økter som en avkrysningsliste — hver økt som krysses av, blir en
   samtaledag med øktas klokkeslett som ramme (§3.6), og vurderingen knyttes
   til økta. Egne dager utenfor øktene går fortsatt. I mentorsamtale: ett kort
   per dag med dato, start, slutt og lunsj. Kapasiteten står fortløpende ved
   hver: «Maks 15 elever».
6. **Generer**, og under den **Trekk på nytt** med de to låsene.

#### Kapasitet

Tilgjengelig tid er `til − fra`, minus lunsjen **når dagen er lang nok til å nå
den**. Antallet som får plass er

```
floor((tilgjengelige minutter + pause) / (samtaletid + pause))
```

Pausen legges til i telleren fordi det ikke er pause etter siste samtale.
08:30–15:00 uten lunsj, 20 minutters samtaler og 5 minutters pause gir 15
elever.

Er samlet kapasitet lavere enn antall elever, står det over resultatet:

> Kapasiteten (14 elever) er lavere enn antall elever (24). Legg til flere
> dager, forleng øktene, eller reduser pausetiden.

Varselet oppdateres mens du endrer innstillingene, ikke bare ved generering.

#### Planlagte samtaler

Øverst i oppsettskolonnen står de planlagte trekningene, én per fag og én for
mentorsamtalene. En trekning slettes med sveip til venstre på raden, eller
med «Slett planen» over timeplanen. Appen sier hva som forsvinner og spør
først. Dager som lå i en økt, tas ut av den, og vurderingen løses fra økta.
Publiserte mentorsamtaler fjernes fra kalenderen ved neste publisering.

#### Gruppesamtaler

«Samtale» velges blant enkeltvis, i par, tre og tre, og opp til seks og seks,
og huskes per fag. En gruppe er én plass i timeplanen, med ett tema og én lås —
trekningen, låsene, dra-og-slipp og kapasiteten virker på gruppene akkurat som
på enkeltelever.

Gruppene settes sammen av den trukne rekkefølgen, og er dermed tilfeldige. Går
elevtallet ikke opp, blir de siste gruppene én større: 25 elever i par gir
elleve par og én trio. Ingen sitter igjen alene. Minuttene per samtale gjelder
hele gruppa.

Gruppene kan justeres for hånd: i timeplanen står navnene i en gruppe som
merkelapper, og et navn dras over på en annen gruppe. Temaet og låsen følger
plassen, og en gruppe som blir tom, forsvinner.

Den alfabetiske lista viser hver elev for seg. Notatfeltet vises bare på
enkeltsamtaler, siden notatet går til én elevs møtelogg.

#### Lunsj

**Foreslås på, 11:45 i 30 minutter.** Den vanlige dagen har lunsj, og
standardverdien er der for at den ikke skal måtte fylles inn hver gang. Ett
klikk slår den av.

**Lunsjen reserveres i trekningen, ikke bare i regnskapet.** Ingen elev
tildeles et tidspunkt i pausen. Den legges inn ved første samtalegrense på
eller etter det oppgitte tidspunktet — en samtale deles aldri i to — så en
pause satt til 11:45 kan i praksis begynne 11:55. Timeplanen viser det
faktiske tidspunktet.

Rekker dagen aldri fram til lunsjtidspunktet, legges det **ingen** lunsj inn.
En pause etter siste samtale er ikke en pause.

#### Trekningen

Temaene fordeles jevnt og tilfeldig, elevene fordeles på dagene etter
kapasitet, og rekkefølgen innen hver dag trekkes. **Plassnummeret løper
sammenhengende over alle dagene** — dag 2 fortsetter der dag 1 sluttet.

#### De to låsene

**Tema** og **Rekkefølge**, hver med av/på. Hva som skjer ved «Trekk på nytt»
står under knappene:

| Låst | Tekst |
|---|---|
| Ingen | *(ingenting)* |
| Tema | Temaer holdes — kun rekkefølge trekkes. |
| Rekkefølge | Rekkefølge holdes — kun tema trekkes. |
| Begge | Begge er låst — ingenting endres. |

#### Låsing av enkeltelever

Hver rad i timeplanen har sin egen lås. En låst elev **beholder både plassen og
temaet sitt** ved ny trekning, mens de andre trekkes om rundt hen. Låste rader
kan ikke dras.

Samspillet med de to hovedlåsene: elevlåsene virker innenfor det som faktisk
trekkes om. Er Tema låst globalt, endrer en elevlås ingenting for temaet — det
ligger fast for alle uansett.

**Generer nullstiller elevlåsene, men ikke de to hovedlåsene.** En ny trekning
er en ny start for enkeltvalgene, mens hovedlåsene er en arbeidsmåte man har
valgt og som skal stå til man selv slår den av.

#### Manuell justering

Rader kan dras om, innenfor en dag og til en annen dag — en elev som var
«tidlig» sist og havner først igjen, skal kunne dras sist. Nedre halvdel av en
rad betyr «etter denne».

**Dagene har hver sin kapasitet.** Har dagen det slippes på ledig plass, settes
eleven inn der. Er den full, bytter de to plass, og appen sier fra om hvem som
byttet — et drag som stille gjør noe annet enn man trodde, ser ut som at musa
glapp.

#### Når en elev ikke møter

Det vanligste som skjer på en samtaledag. Eleven som står 10:20 dukker ikke
opp, og de andre står på sine klokkeslett — ingenting kan flyttes.

Samtalen **markeres som ikke gjennomført**, og ingenting annet rører seg.
Raden blir stående med sitt klokkeslett, tonet ned og merket «møtte ikke». Tida
blir ubrukt, og det er riktig: de andre skal møte når de har fått beskjed om.

Samtalen kan **settes opp på nytt** senere — samme dag eller en annen. Da
lages en ny rad; den gamle blir stående som det den er, en avtale som ikke ble
noe av. Det er derfor nøkkelen i §3.6 også rommer klokkeslettet.

En samtale som ikke ble gjennomført **teller ikke i historikken** under. Eleven
var ikke der, og plasseringen sier da ingenting om når hen faktisk måtte møte —
samme prinsipp som `teller_ikke` i §5.1.

#### Historikk

Appen husker hvem som hadde hvilken plass sist, og hvilket tema. Det er dette
den kan som et løsrevet verktøy ikke kan. **Gjelder begge modus** — en elev som
alltid havner først, havner først i alle sammenhenger.

**Plassering regnes i tredjedeler av dagens egen rekke** — tidlig, midt, sent.
Et fast antall ville betydd ulike ting på en dag med seks og en med tolv. Dager
med under tre elever markeres ikke; der er det ingenting å sammenlikne.

**Plasseringen gjelder innen dagen, ikke i hele rekka.** En elev som er først
på dag tre møtte like tidlig som en som var først på dag én. Å alltid havne på
siste dag er noe annet, og hører eventuelt hjemme senere.

Merknaden står ved navnet i resultatet, og bare når det er noe å si:

```
09:30  Tony Soprano        Oppgave 4     tidlig 2× på rad
09:55  Carmela Soprano     Oppgave 1
10:20  Adriana La Cerva    Oppgave 7     sent sist
```

Ingen legende å lære, ingen farger å tolke. De fleste har ingenting stående, og
det er nettopp derfor de som har det er verdt å se på. Den samme oversikten
ligger i oppsettet, over Generer, så den er synlig mens du trekker og ikke bare
etterpå.

**Historikken er de andre trekningene.** Trekningen man står i, teller ikke
som «sist»: ellers ville merknaden beskrive plassen eleven nettopp fikk, og en
ny trekning vektes mot den forrige utgaven av seg selv.

**Vektingen er av som standard.** Ren tilfeldighet er normaltilstanden. Slås
den på, gjelder den både Generer og Trekk på nytt: den som var tidlig sist,
havner bak alle som ikke var det, og den som var sent sist, foran. Innenfor
hver gruppe er rekkefølgen tilfeldig, så køen er ikke en fast rotasjon. De to
plasseringene før det veier mindre. En gruppesamtale veier som snittet av
medlemmene.

**Merknadene vises uansett om vektingen er på.** De er opplysning om hva som
har skjedd, ikke en konsekvens av en innstilling.

#### De tre visningene

**Fordeling** — ett kort per elev i tidsrekkefølge på tvers av alle dagene, med
plassnummer, navn, oppgavenummer og temanavn. Over kortene en tegnforklaring
over temaene. Skjules i mentormodus.

**Timeplan** — én bolk per dag med ukedag, dato, `fra–til` og antall elever.
Under: én rad per samtale med plassnummer, oppgave, navn, temanavn,
klokkeslett og lås. Lunsjen står som egen rad: «Lunsj (30 min) 11:55–12:25».

**Alfabetisk** — tabell sortert på navn, med oppgave, klokkeslett og dag.
Oppgavekolonnene skjules i mentormodus.

#### Eksport

**Til Teams** kopieres en tabell per dag som formatert HTML, med ukedag og dato
som overskrift. Kolonnene er `#`, `Navn`, `Oppgave`, `Tid` i fagsamtale og `#`,
`Navn`, `Tid` i mentorsamtale. Lunsjen står som egen rad.

**Som markdown** samme innhold som ren tekst, med tabell per dag. **Markdown
følger modus på samme måte som Teams-eksporten** — oppgavekolonnen utelates i
mentorsamtale.

**Utskrift** velger mellom alle tre visningene, én av dem, eller den
alfabetiske lista alene.

Ingen av eksportene tar med skåringer eller vurderingsresultater — samme
feltgrense som §8.1.

---

### 4.11 Klassekart og gruppegenerator

Tegnet i lerretet (runde 7). Oppskriften står i `docs/klassekart.md`.

#### Hva og hvorfor

Klassekart plasserer elevene i et rom, og gruppegeneratoren deler dem i
grupper. Begge bruker det Økta allerede vet: elevene i faget, klassen eller
mentorgruppa, bildene, innsatsen fra trafikklyset og hvem som har sittet
sammen før. Ingen lister limes inn.

#### Begreper

- **Rom** — et klasserom tegnet én gang og brukt av mange kart: tavle,
  kateter, dør, vinduer og pulter på et rutenett. Fritt navn («Rom 214»).
  Rommet er felles for alle fag og skoleår.
- **Kart** — én elevgruppe i ett rom. Kilden er et fag (`skolear_fag`), en
  klasse eller en mentorgruppe. Et kart har to visninger: **Plasser** og
  **Grupper**.
- **Plassering** — hvem som sitter hvor i et kart. Når læreren trykker
  «Bruk» (eller kartet skrives ut / kopieres), lagres plasseringen med dato.
  De lagrede plasseringene er historikken.
- **Gruppesett** — en inndeling i grupper, lagret på samme måte.

#### Personvern

- Kjønn er valgfritt (`elev.kjonn`: `j`, `g` eller tomt; `elev.kjonn_kilde`:
  `gjettet` eller `satt`). Det gjettes ved import (§7), brukes bare til
  blanding og plassholderbildet, velges i elevkortet, og går aldri ut: ikke i eksport,
  utskrift, Teams, CalDAV, arkiv eller oppsettfil.
- Innsatsfarge på pultene vises bare på skjermen, aldri i utskrift eller Teams.
- Elevbilder vises i appen, men er ikke med i utskrift eller Teams.
- Utskrift og Teams viser fornavn og etternavnets forbokstav.

#### Rom (rediger rom)

- Start fra en mal: **Par i rader** (15 dobbeltpulter), **Hestesko**,
  **Grupper á 4**, **Enkeltpulter**. Malen kan justeres etterpå.
- Dra inn: enkeltpult, dobbeltpult, gruppebord (4), gruppebord (6),
  kateter, tavle, dør, vinduer. Rutenett på 20 px; delene fester seg.
- Valgt del får en liten verktøylinje: Roter, Dupliser, Slett. Tastene
  ⌘D, ⌫, R og piltaster (én rute).
- Plassene nummereres automatisk forfra (nærmest tavla) og fra venstre.
- Et rom som brukes av kart, kan ikke slettes uten å spørre; endres det,
  beholder kartene plasseringene sine der plassnummeret fortsatt finnes.

#### Plasser

- Rommet tegnes med tavle øverst. Bryteren **Fra kateteret / Fra elevene**
  snur tegningen (for utskrift til elevene).
- Hver plass viser bilde (eller initialer), fornavn og etternavn. Ledige
  plasser vises tonet.
- **Lås:** klikk på en plass låser eleven der. Låste blir sittende når det
  stokkes. **Dra** en elev til en annen plass bytter dem.
- **Ikke til stede i dag:** elever dras dit og får ingen plass denne gangen.
  Gjelder bare til kartet lukkes; lagres ikke som fravær.
- **Stokk på nytt** (⌘R) fordeler alle som ikke er låst.

#### Fordeling (felles for Plasser og Grupper)

- **Tilfeldig**, **Spre** (lav innsats ved siden av høy) eller **Samle**
  (lav innsats samlet foran, nær kateteret; i grupper: likt nivå sammen).
- Innsats = snitt av trafikklyset de siste 10 øktene i faget (for klasse og
  mentorgruppe: på tvers av fagene). `teller_ikke`-verdier teller ikke
  (§5.1). Elever uten skår regnes som midt.
- **Bland jenter og gutter:** prøv å unngå at to av samme kjønn sitter ved
  samme pult / er alene i en gruppe av samme kjønn. Elever uten kjønn er
  nøytrale.
- **Unngå dem som har sittet sammen:** straffer par som har delt pult eller
  gruppe i de lagrede plasseringene, mest de siste. Panelet viser det
  hyppigste paret («Meadow og Jackie, 3 ganger»).
- **Hold fra hverandre:** par som aldri skal dele pult eller gruppe. Regelen
  hører til kilden (faget/klassen) og gjelder i alle kart for den.
- Reglene er ønsker med vekt, ikke absolutte, bortsett fra låser og «hold
  fra hverandre», som alltid holdes. Går det ikke, sier appen hvilken regel
  som ikke kunne holdes.

Algoritme: tilfeldige forsøk (for eksempel 400) med straffepoeng for brudd
på ønskene; det beste forsøket velges. Tilfeldigheten får et frø, så
testene er deterministiske.

#### Grupper

- Antall grupper med − og +, størrelsen regnes ut («á 4–5»). Går det ikke
  opp, blir noen grupper én større — ingen står alene.
- Gruppene vises som kort med svak farge og nummer; navnet kan skrives om.
- Elever dras mellom gruppene. **Unngå samme grupper som sist** bruker
  gruppehistorikken.
- Kopier til Teams (én liste per gruppe) og skriv ut.

#### Sidemenyen og navigasjon

Klassekart (G K) står i sidemenyen. Under det, som undermeny (DESIGN §6):
kartene for skoleåret (fagfirkant, kilde, rom og antall) og «+ Nytt kart».
Klikk på selve «Klassekart» gir en oversikt over kart og rom.

#### Data

Migrasjon 024:

```
ALTER TABLE elev ADD COLUMN kjonn TEXT;          -- 'j' | 'g' | NULL

CREATE TABLE rom (
  id TEXT PRIMARY KEY, navn TEXT NOT NULL,
  oppsett TEXT NOT NULL,                         -- JSON: deler med type, x, y, rotasjon
  opprettet TEXT NOT NULL, endret TEXT NOT NULL, slettet TEXT
);
CREATE TABLE klassekart (
  id TEXT PRIMARY KEY, skolear_id TEXT NOT NULL REFERENCES skolear(id),
  kilde_type TEXT NOT NULL,                      -- fag | klasse | mentorgruppe
  kilde_id TEXT NOT NULL, rom_id TEXT REFERENCES rom(id),
  innstillinger TEXT,                            -- JSON: fordeling, bland, unngå, antall grupper
  opprettet TEXT NOT NULL, endret TEXT NOT NULL, slettet TEXT
);
CREATE TABLE plassering (                        -- én rad per elev per lagret oppsett
  id TEXT PRIMARY KEY, klassekart_id TEXT NOT NULL REFERENCES klassekart(id),
  oppsett_id TEXT NOT NULL,                      -- samme for alle rader i ett oppsett
  type TEXT NOT NULL,                            -- plass | gruppe
  elev_id TEXT NOT NULL REFERENCES elev(id),
  plass INTEGER, gruppe INTEGER, gruppenavn TEXT, last INTEGER NOT NULL DEFAULT 0,
  opprettet TEXT NOT NULL, endret TEXT NOT NULL, slettet TEXT
);
CREATE TABLE elevregel (                         -- «hold fra hverandre»
  id TEXT PRIMARY KEY, kilde_type TEXT NOT NULL, kilde_id TEXT NOT NULL,
  elev_a TEXT NOT NULL REFERENCES elev(id), elev_b TEXT NOT NULL REFERENCES elev(id),
  opprettet TEXT NOT NULL, endret TEXT NOT NULL, slettet TEXT
);
```

UUID, stempler og soft delete som resten (§3.1). Sletting av en elev tar
plasseringer og regler med. Ingen av tabellene er med i oppsettfila (§8.2).

### 4.12 Fravær mot 10 %-grensen

Fravær regnes i timer: summen av varigheten på de avholdte øktene der
eleven står som «ikke i økta», mot 10 % av fagets årstimetall (140 t gir
14 t). Har faget ikke årstimetall, regnes det av timene som er planlagt i
faget. Elever som kom inn i faget etter en økt, får ikke fravær for den.

Det vises i Elever (høyeste fag), på fagsiden (bolken «Fravær mot
10 %-grensen») og i elevkortet («Fravær i år», én rad per fag: prosent,
stolpe, «9 av 24 økter · 15,8 t»). Merker: Halvveis (minst 50 % av
grensen), Nær grensen (minst 75 %) og Over grensen.

Appen skiller ikke dokumentert fra udokumentert fravær. Teksten sier det:
«Udokumentert fravær over 10 % av timene i faget kan gi IV. InSchool er
fasit; her regnes «ikke i økta».»

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

**Trafikklyset har form**, så det kan leses uten fargesyn (ARBEIDSLISTE 20.1):
grønn er fylt, gul halvfylt, rød har et lite kryss, og `0` et større kryss på
mørk grunn. Ikke skåret er en tom ring. Én komponent tegner skåringen overalt
(skåring, heatmap, elevkort, filter, I dag).

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

Lim inn — eller les klasselista fra InSchool-utskriften (PDF), se under.

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

**Kjønn gjettes fra fornavnet** (§4.11). Appen har med en liten tabell fra
SSBs navnestatistikk (fornavn → andel jenter), lokalt — ingen nettverkskall.
Er ≥ 95 % av dem med navnet av samme kjønn, foreslås det, merket som gjettet
(`elev.kjonn_kilde = 'gjettet'`). Ellers står feltet tomt («Velg»). I
forhåndsvisningen kan forslaget byttes med ett klikk, og «Bekreft alle
gjettede» gjør dem til `satt`. Elever som finnes fra før beholder sitt.
Kjønn kan stå tomt; det betyr bare at eleven ikke telles med når
klassekartet blander. Kilde: SSB, «Navn» (CC BY 4.0) — navngis under Om.

**Faget er valgfritt ved import.** Limer du inn mentorgruppa di, er det ingen
fagkobling å lage — elevene skal bare finnes, med klasse og mentormerke.
Velger du «uten fag» i forhåndsvisningen, opprettes elevene og kobles til
klassen, og `elev_fag` røres ikke.

Duplikatgjenkjenningen virker som før. Den sammenlikner på navn og klasse
(§7.1), og ingen av delene forutsetter et fag. En elev som senere limes inn i
et fag, gjenkjennes og kobles — det er nettopp det gjenkjenningen er til for.

**Lista er hele faget.** Limes en liste inn fra et fag, kan den erstatte
klasselista: elevene i faget som ikke står på lista, tas ut av faget — de
slettes ikke, og kan velges bort én og én i forhåndsvisningen.

**InSchool-utskriften.** «Les fra InSchool-PDF» leser PDF-en skolen skriver
ut, lokalt med pdf.js som følger appen (ingen nettverkskall, §1): navn og
klasse fra tabellen fylles inn som `navn; klasse`, fagkoden i toppen velger
faget, og bildet til hver elev klippes ut av rutenettet. Resten er den vanlige
flyten med forhåndsvisning. Bildene lagres når importen bekreftes:

```sql
CREATE TABLE elevbilde (
  id         TEXT PRIMARY KEY,
  elev_id    TEXT NOT NULL REFERENCES elev(id),
  bilde      TEXT,                     -- gråtoner, JPEG som data-URL; NULL når slettet
  kilde      TEXT,                     -- «InSchool»
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT,
  UNIQUE(elev_id)
);
```

Bildet er personopplysning og går aldri ut av appen — ikke i kalenderen,
eksporten eller arkivet. Slettes bildet eller eleven, tømmes `bilde` før
raden soft-slettes. Looken (lilla tone og svakt korn) legges på ved visning.

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
| Lista har et **fullere navn**: samme fornavn, og alle ordene i navnet som finnes står i samme rekkefølge («Per Person» ⊂ «Per Johannes Persaune Person») | Samme elev, og foreslå navnet fra lista | Ja — med «bruk navnet fra lista» |
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
hovedposten, og alle skåringer, vurderinger, notater og fagkoblinger
flyttes over. Den tapte posten soft-slettes.

Dette er sikkerhetsnettet som gjør at automatikken trygt kan være forsiktig.

---

## 8. Lagring, eksport og backup

Appen skiller mellom **arbeidsfil** og **arkiv**. Dette avgjør om dataene
overlever et år.

### Arbeidsfil

`elevtracking.sqlite` i appens data-mappe
(`~/Library/Application Support/no.elevtracking.app/` på Mac,
`%APPDATA%\no.elevtracking.app\` på Windows; Innstillinger › Personvern viser
den faktiske). Skal **aldri** ligge i iCloud Drive, OneDrive, Dropbox eller
annen synkmappe — synktjenester kan evakuere og delvis
skrive tilbake filer, og en åpen SQLite-database blir korrupt uten forvarsel.

### Arkiv

Ved hver oppstart, og manuelt via knapp, skrives hele databasen ut som
lesbare tekstfiler til en mappe brukeren velger, og alltid også ved siden av
sikkerhetskopiene:

```
<valgt mappe>/
  README.md                  ← definisjon av trafikklys og skalaer
    oppfolging.md              ← gjøremål og oppfølgingspunkter, åpne først
  elever/
    anna-reistad.md         ← skåringer, vurderinger, notater og møtelogg
  fag/
    mfl1.md                  ← årsplan med alle økter
    mfl1-skaring.csv
    mfl1-vurderinger.csv
```

Elevene i året er de som står i et fag, i en klasse eller har et notat fra
året — mentorelever uten fag kommer med. Elevfilenes «Notater og møtelogg»
har både møteloggen (også fra samtaler) og notatene fra øktene, eldste
først. Elevbilder tas ikke med.

Elevfilene har YAML-frontmatter (navn, klasse, fag) og innhold kronologisk under.
Skal kunne åpnes i Obsidian uten videre behandling.

Denne mappa kan legges hvor som helst, inkludert i en skytjeneste — det er vanlige
tekstfiler som ingenting skriver til samtidig.

Eksporten er automatisk, ikke manuell. En eksport man må huske på er ikke backup.

### Sikkerhet

Webvisningen regnes som mindre betrodd enn Rust-siden. Skulle et skript
noen gang få kjøre i vinduet (en feil, en ødelagt pakke), skal det ikke
kunne skrive filer rundt på maskinen:

- **Streng CSP:** bare appens egne skript; bilder fra `data:` og `blob:`.
- **Rust eier filskrivingen.** Lagre-dialogen åpnes og fila skrives på
  Rust-siden; stien går aldri via vinduet, og bare kjente filtyper lagres.
  Arkivet skrives bare til mappa brukeren har valgt, eller ved siden av
  sikkerhetskopiene.
- **Skrivinger i flere steg er én transaksjon** (sletting av elev,
  samtaletrekning, import av oppsettfil): enten går alt gjennom, eller
  ingenting. De kjøres på én tilkobling på Rust-siden, siden tilkoblingene
  fra vinduet ligger i en pulje.

### 8.1 Publisering av timeplanen (CalDAV)

Årsplanen kan publiseres til en kalenderserver brukeren selv velger, slik at
den kan abonneres på fra telefon, nettbrett og andre maskiner — og deles med
elever som en offentlig lenke.

Dette er det **eneste** unntaket fra §1. Det er avgrenset med vilje:

- **Av som standard.** Ingenting sendes før brukeren har lagt inn en adresse
  og slått funksjonen på.
- **Én adresse.** Én CalDAV-samling, oppgitt av brukeren. Ingen oppdagelse av
  tjenere, ingen forhåndsvalgte leverandører.
- **Seks felter, ikke flere:** fagkode, tittel, dato, klokkeslett, sted og
  agenda. Mentorsamtaler er det ene unntaket — se under.
- **Agenda er skrevet for eleven.** Den vises som kommentar i kalenderen og
  leses av alle som abonnerer. Den er noe annet enn `okt.plan`, som er
  lærerens egne notater om hva som skal skje, og som aldri går ut.
- **Aldri:** etternavn, klasse, skåringer, skåringsnotater, vurderinger,
  vurderingsresultater, notater, oppfølging, `okt.plan` eller `okt.logg`.
- **Enveis.** Appen skriver. Den leser aldri noe tilbake fra serveren, og en
  kompromittert server kan derfor ikke påvirke databasen.
- **Passordet lagres i systemets nøkkelring**, ikke i databasen — basen
  kopieres til `backup/` og skal kunne deles uten å lekke legitimasjon.

Hendelsens tittel er «FAGKODE: tema», stedet blir `LOCATION` og agendaen
`DESCRIPTION`.

### Mentorsamtaler — det ene unntaket fra feltlista

Mentorsamtalene kan publiseres som egne hendelser, én per samtale. Da er det
**fornavn og klokkeslett** som går ut, og ingenting annet:

```
SUMMARY:Mentorsamtale med Vera
```

Klokkeslettet står i hendelsens start og slutt, ikke i tittelen.

Ingen `DESCRIPTION`, ingen `LOCATION`, intet etternavn, ingen klasse, ingen
fagkode. Feltgrensen håndheves ett sted i koden, i `lagSamtaleHendelse`, med
tester som slår ut hvis noe mer sniker seg inn.

**Fornavn og ikke fullt navn**, fordi et fornavn alene identifiserer langt
færre — og en kalender kan bli synkronisert videre til en telefon eller en
skytjeneste uten at man tenker over det.

**Egen bryter, av som standard.** Ikke en del av `caldav_pa`: et hakk man satte
i august skal ikke begynne å sende elevfornavn i november. Kalenderen oppgis
for seg, og er den tom sendes ingenting.

**En kalender med mentorsamtaler skal ikke deles.** Den er til eget bruk på
egne enheter. Den offentlige lenka over gjelder fagkalenderne.

**Fagsamtaler publiseres ikke slik.** De hører til en vurdering, og
oppgavefordelingen er ikke noe som skal ligge i en kalender.

Trekningen sendes når læreren sier fra, ikke automatisk ved hver endring —
en omstokking er ikke det samme som en beslutning om å publisere. Samtalens
UUID er hendelsens `UID`, og raden gjenbrukes når eleven bare bytter
klokkeslett, slik at hendelsen oppdateres framfor å bli slettet og lagt inn
på nytt.

Hendelsene identifiseres med øktas UUID (§9), så en økt som flyttes blir
oppdatert framfor duplisert. Slettede økter fjernes fra serveren ved neste
publisering.

Feltlista er en del av spesifikasjonen, ikke en implementasjonsdetalj. Skal
den utvides, er det en spec-endring.

### Rullerende kopi

Kopi av `.sqlite`-fila til lokal `backup/`-undermappe ved appstart, én gang per
døgn, behold de siste 30.

---

### 8.2 Oppsettfil

Flere detaljer og oppskriften til Claude Code står i `docs/oppsettfil.md`.

#### Hva og hvorfor

En lærer som allerede bruker Økta kan lage en **oppsettfil** og gi den til en
kollega. Kollegaen drar fila inn i første steg av oppsettet, og slipper å
skrive inn skoleåret, fridagene og faglista på skolen selv. Målet er at en
kollega som aldri har sett appen, kan sette den opp alene på ti minutter.

#### Personvern — det viktigste

Fila inneholder **aldri** noe om elever: ingen elever, klasser, fagvalg,
skåringer, vurderinger, resultater, notater, møtelogg, gjøremål, samtaler,
elevbilder eller elevkoder. Heller ikke øktene, øktlogger, planer eller
lærerens navn på fagene.

Dette sikres med en **hviteliste**, ikke en svarteliste: eksporten bygger
fila felt for felt fra en fast liste. Importen avviser fila hvis den har
nøkler som ikke står på lista. En test passer på at ingen elevtabell
noen gang leses under eksport.

#### Innhold

| Del | Felt | Kilde |
|---|---|---|
| Skoleår | `navn`, `start`, `slutt` | `skolear` (det aktive) |
| Fridager | `navn`, `type`, `fra`, `til` | `fridag` i det skoleåret |
| Fag | `kode`, `navn`, `alias`, `grep_kode` | `fag` |
| | `arstimetall`, `standard_varighet_min` | `skolear_fag` for samme år |
| Innstillinger | `standard_varighet_min` | `innstilling` |
| Skalaer (valgfritt) | `navn`, `bruksomrade`, `verdier[]` | `skala` + `skalaverdi`, bare ikke-innebygde |

Fargen på fagene er med vilje **ikke** med: den velges automatisk hos
mottakeren og er personlig. Rom er heller ikke med: rom er fritekst per fag
og lærer i dag (`skolear_fag.rom`), ikke en liste for skolen.

Fridager tar med `helligdag` når den typen finnes (ARBEIDSLISTE §5.9).

#### Format

Én fil, UTF-8, JSON, endelse `.okta`. Filnavn foreslås som
`<skole>-oppsett <skoleår>.okta`, for eksempel `BPG-oppsett 2026-27.okta`.

```json
{
  "format": "okta-oppsett",
  "versjon": 1,
  "laget": "2026-10-05T18:00:00+02:00",
  "laget_av": "Fredrik Bedsvaag",
  "skole": "BPG",
  "skolear": { "navn": "2026/27", "start": "2026-08-19", "slutt": "2027-06-18" },
  "fridager": [
    { "navn": "Høstferie", "type": "ferie", "fra": "2026-09-28", "til": "2026-10-02" }
  ],
  "fag": [
    { "kode": "MFL2", "navn": "Markedsføring og ledelse 2", "alias": null,
      "grep_kode": "MFL1Z03", "arstimetall": 140, "standard_varighet_min": 180 }
  ],
  "innstillinger": { "standard_varighet_min": 180 },
  "skalaer": []
}
```

- Ingen `id`-er i fila. Mottakeren lager nye UUID-er og stempler (§3.1).
- `laget_av` og `skole` er bare til visning («Fra Fredrik Bedsvaag»).
  `skole` skrives inn i eksportdialogen; den finnes ikke i basen.
- `versjon` økes bare når formatet endres. Importen avviser høyere
  versjoner enn den kjenner, med en forståelig melding.

#### Eksport (Innstillinger › Del oppsett)

Avkrysning for hver del (skoleår og fridager, fag, øktlengde, skalaer).
Elevlåsen står synlig under: «Elever, notater, skåringer og vurderinger blir
aldri med.» Knappen «Lag oppsettfil …» åpner lagre-dialogen og skriver fila
med den eksisterende `skriv_fil`-kommandoen.

#### Import (oppsettets første steg, og Del oppsett › «Les inn oppsettfil …»)

Fire trinn, i denne rekkefølgen:

1. **Les** fila (filvelger eller dra og slipp, File API i webview, slik
   InSchool-PDF-en leses i `LimInn.tsx`).
2. **Sjekk** den: riktig `format`, kjent `versjon`, bare kjente nøkler,
   gyldige ISO-datoer, `start` før `slutt`, fridager innenfor skoleåret,
   ingen like fagkoder. Feil vises på norsk med hva som er galt.
3. **Vis hva som skjer** før noe skrives: «Skoleåret 2026/27 opprettes.
   9 fridager. 22 fag legges i fagbanken, 3 finnes fra før.»
4. **Skriv** alt i én transaksjon. Går noe galt, skrives ingenting.

Regler for det som finnes fra før:

- **Skoleår** med samme `navn`: datoene endres ikke. Er de ulike, sies det i
  trinn 3. Bare fridager som mangler (samme `navn` + `fra`) legges til.
- **Fag** med samme `kode` (uten hensyn til store/små bokstaver) eller samme
  `grep_kode`: hoppes over, og nevnes i trinn 3.
- **Global øktlengde**: settes bare hvis den ikke er satt.
- **Skalaer** med samme `navn`: hoppes over.

Fagene havner i **fagbanken**, ikke automatisk i «fag i år». I oppsettet
(steg 3) står de som forslag mottakeren krysser av for.

Importen er trygg å kjøre to ganger: andre gang skjer ingenting.

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
  på `fag`. `grep_kode` og koblingene mot periode (`periode_kompetansemal`) og
  økt (`okt_kompetansemal`) finnes allerede, med bare koden lagret — teksten
  slås opp i JSON-fila. `okt.kompetansemal`, `periode.kompetansemal` og
  `fag.beskrivelse` er fortsatt fritekst, for fag uten Udir-kode.

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

Den opprinnelige tidagersplanen er bygget. Hva som gjenstår og i hvilken
rekkefølge, står i `ARBEIDSLISTE.md`.

Klasseopprykk (§4.3) og flerårsvisningen i §4.5 hører til første gang et nytt
skoleår opprettes, altså august 2027. Datamodellen bærer dem fra dag 1;
skjermene kan komme senere.

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

Den visuelle retningen står i `DESIGN.md`, som beskriver appen slik den er
bygget, og tegningene i `docs/lerret/` er fasit for det som er tegnet. Begge
følger appen.

Det som ikke skal fravikes:

- **Trafikklyset** er det eneste stedet med mettet farge.
- **Skåringen animeres aldri:** tastetrykk → farge → neste elev er null
  millisekunder.
- **Ingen kort med store tall og ingen grafer for grafenes skyld.** Forsidens
  årsoversikt er et villet unntak.
- **Utskriften er alltid lys.**
