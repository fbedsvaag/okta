# Klassekart og gruppegenerator — spec og oppskrift

Status: del A er lagt inn i SPEC.md som §4.11 (06.10.2026). Del B er
oppskriften til Claude Code. Skjermene er tegnet i lerretet «Økta —
redesign», runde 7, og markupen ligger som referanse i `docs/lerret/`
(`Klassekart.dc.html`, `KlassekartGrupper.dc.html`, `KlassekartRom.dc.html`).

Bestemt av eieren 06.10: kjønn blir et valgfritt felt på eleven; ingen import
fra det gamle BPG Klassekart; alt bygges i én bolk.

---

## A. Spec

### Hva og hvorfor

Klassekart plasserer elevene i et rom, og gruppegeneratoren deler dem i
grupper. Begge bruker det Økta allerede vet: elevene i faget, klassen eller
mentorgruppa, bildene, innsatsen fra trafikklyset og hvem som har sittet
sammen før. Ingen lister limes inn.

### Begreper

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

### Personvern

- Kjønn er valgfritt (`elev.kjonn`: `j`, `g` eller tomt). Det brukes bare til
  blanding, vises bare i elevkortet, og går aldri ut: ikke i eksport,
  utskrift, Teams, CalDAV, arkiv eller oppsettfil.
- Innsatsfarge på pultene vises bare på skjermen, aldri i utskrift eller Teams.
- Elevbilder vises i appen, men er ikke med i utskrift eller Teams.
- Utskrift og Teams viser fornavn og etternavnets forbokstav.

### Rom (rediger rom)

- Start fra en mal: **Par i rader** (15 dobbeltpulter), **Hestesko**,
  **Grupper á 4**, **Enkeltpulter**. Malen kan justeres etterpå.
- Dra inn: enkeltpult, dobbeltpult, gruppebord (4), gruppebord (6),
  kateter, tavle, dør, vinduer. Rutenett på 20 px; delene fester seg.
- Valgt del får en liten verktøylinje: Roter, Dupliser, Slett. Tastene
  ⌘D, ⌫, R og piltaster (én rute).
- Plassene nummereres automatisk forfra (nærmest tavla) og fra venstre.
- Et rom som brukes av kart, kan ikke slettes uten å spørre; endres det,
  beholder kartene plasseringene sine der plassnummeret fortsatt finnes.

### Plasser

- Rommet tegnes med tavle øverst. Bryteren **Fra kateteret / Fra elevene**
  snur tegningen (for utskrift til elevene).
- Hver plass viser bilde (eller initialer), fornavn og etternavn. Ledige
  plasser vises tonet.
- **Lås:** klikk på en plass låser eleven der. Låste blir sittende når det
  stokkes. **Dra** en elev til en annen plass bytter dem.
- **Ikke til stede i dag:** elever dras dit og får ingen plass denne gangen.
  Gjelder bare til kartet lukkes; lagres ikke som fravær.
- **Stokk på nytt** (⌘R) fordeler alle som ikke er låst.

### Fordeling (felles for Plasser og Grupper)

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

### Grupper

- Antall grupper med − og +, størrelsen regnes ut («á 4–5»). Går det ikke
  opp, blir noen grupper én større — ingen står alene.
- Gruppene vises som kort med svak farge og nummer; navnet kan skrives om.
- Elever dras mellom gruppene. **Unngå samme grupper som sist** bruker
  gruppehistorikken.
- Kopier til Teams (én liste per gruppe) og skriv ut.

### Sidemenyen og navigasjon

Klassekart (G K) står i sidemenyen. Under det, som undermeny (DESIGN §6):
kartene for skoleåret (fagfirkant, kilde, rom og antall) og «+ Nytt kart».
Klikk på selve «Klassekart» gir en oversikt over kart og rom.

### Data

Migrasjon 024:

```
ALTER TABLE elev ADD COLUMN kjonn TEXT;          -- 'j' | 'g' | NULL
ALTER TABLE elev ADD COLUMN kjonn_kilde TEXT;    -- 'gjettet' | 'satt' | NULL

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

---

## B. Oppskrift for Claude Code

Ett steg om gangen; test, bygg, vis eieren, commit. Se lerret-markupen i
`docs/lerret/` for utseendet, og DESIGN.md for tokens og komponenter.

1. **Data.** Migrasjon 024 og `src/data/klassekart.ts` med lesing og
   skriving av rom, kart, plasseringer og regler. Tester mot testbasen.
2. **Kjønn på eleven.** Feltet i elevkortet (Jente / Gutt / Ikke satt), og
   en valgfri kolonne i lim-inn-forhåndsvisningen. Test at det ikke er med i
   noen eksport.
3. **Fordelingen.** `src/data/fordeling.ts`: ren funksjon som tar elever,
   plasser (eller antall grupper), låser, regler, innsats, kjønn, historikk,
   modus og frø, og gir plassering + liste over regler som ikke ble holdt.
   Grundige tester: låser holdes, «hold fra hverandre» holdes alltid,
   Spre/Samle gir forventet mønster, samme frø gir samme svar.
4. **Rom-editoren** (lerretets `KlassekartRom`): maler, dra inn, rutenett,
   roter/dupliser/slett, nummerering av plasser.
5. **Plasser** (`Klassekart`): rommet med elever, lås, dra for å bytte,
   «Ikke til stede i dag», panelet til høyre, Stokk (⌘R), Fra kateteret /
   Fra elevene, Bruk (lagrer), utskrift og Teams.
6. **Grupper** (`KlassekartGrupper`): antall, kort, dra, navn, Stokk,
   Teams og utskrift. Lagres som gruppesett.
7. **Sidemenyen og oversikten.** Klassekart (G K) tilbake i sidemenyen med
   kartene som undermeny; oversikt over kart og rom; «+ Nytt kart» med
   valg av kilde og rom.
8. **STATUS.md og ARBEIDSLISTE §8** oppdateres og krysses av.
