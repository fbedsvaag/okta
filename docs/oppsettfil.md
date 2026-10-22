# Oppsettfil — spec og oppskrift

Status: **del A står i SPEC.md som §8.2** (lagt inn 06.10.2026 etter eierens ønske).
Del B er oppskriften til Claude Code.

Tegnet i lerretet «Økta — redesign»: Innstillinger › Del oppsett, og første
steg i førstegangsoppsettet.

---

## A. Spec

### Hva og hvorfor

En lærer som allerede bruker Økta kan lage en **oppsettfil** og gi den til en
kollega. Kollegaen drar fila inn i første steg av oppsettet, og slipper å
skrive inn skoleåret, fridagene og faglista på skolen selv. Målet er at en
kollega som aldri har sett appen, kan sette den opp alene på ti minutter.

### Personvern — det viktigste

Fila inneholder **aldri** noe om elever: ingen elever, klasser, fagvalg,
skåringer, vurderinger, resultater, notater, møtelogg, gjøremål, samtaler,
elevbilder eller elevkoder. Heller ikke øktene, øktlogger, planer eller
lærerens navn på fagene.

Dette sikres med en **hviteliste**, ikke en svarteliste: eksporten bygger
fila felt for felt fra en fast liste. Importen avviser fila hvis den har
nøkler som ikke står på lista. En test passer på at ingen elevtabell
noen gang leses under eksport.

### Innhold

| Del | Felt | Kilde |
|---|---|---|
| Skoleår | `navn`, `start`, `slutt` | `skolear` (det aktive) |
| Fridager | `navn`, `type`, `fra`, `til` | `fridag` i det skoleåret |
| Fag | `kode`, `navn`, `alias`, `grep_kode` | `fag` |
| | `arstimetall`, `standard_varighet_min` | `skolear_fag` for samme år |
| Innstillinger | `standard_varighet_min` | `innstilling` |
| Skalaer (valgfritt) | `navn`, `bruksomrade`, `verdier[]` | `skala` + `skalaverdi`, bare ikke-innebygde |
| Rubrikker (med skalaene) | `navn`, `nivaer[]`, `kriterier[]` (`tekst`, `celler[]`) | `rubrikkmal`; bare tekstene, ingen id-er |

Fargen på fagene er med vilje **ikke** med: den velges automatisk hos
mottakeren og er personlig. Rom er heller ikke med: rom er fritekst per fag
og lærer i dag (`skolear_fag.rom`), ikke en liste for skolen.

Fridager tar med `helligdag` når den typen finnes (ARBEIDSLISTE §5.9).

### Format

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
  "skalaer": [],
  "rubrikker": [
    { "navn": "Muntlig drøfting", "nivaer": ["Lav", "Middels", "Høy"],
      "kriterier": [{ "tekst": "Drøfter", "celler": ["Nevner én side", "Fordeler og ulemper", "Veier sidene opp"] }] }
  ]
}
```

`rubrikker` kom i 0.6 og mangler i eldre filer; da leses den som tom. En
rubrikk med samme navn som en mal mottakeren har, hoppes over.

- Ingen `id`-er i fila. Mottakeren lager nye UUID-er og stempler (§3.1).
- `laget_av` og `skole` er bare til visning («Fra Fredrik Bedsvaag»).
  `skole` skrives inn i eksportdialogen; den finnes ikke i basen.
- `versjon` økes bare når formatet endres. Importen avviser høyere
  versjoner enn den kjenner, med en forståelig melding.

### Eksport (Innstillinger › Del oppsett)

Avkrysning for hver del (skoleår og fridager, fag, øktlengde, skalaer).
Elevlåsen står synlig under: «Elever, notater, skåringer og vurderinger blir
aldri med.» Knappen «Lag oppsettfil …» åpner lagre-dialogen og skriver fila
med den eksisterende `skriv_fil`-kommandoen.

### Import (oppsettets første steg, og Del oppsett › «Les inn oppsettfil …»)

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

---

## B. Oppskrift for Claude Code

Kjør i Terminal fra `~/okta` (eller der repoet ligger), med `claude`.
Én ting om gangen, og commit hver av dem.

**Steg 0 — spec inn.** Bestem selv om del A skal inn i SPEC.md (forslag:
ny §8.2 «Oppsettfil»). Lim den inn for hånd. Claude Code skriver ikke i
SPEC.md.

**Steg 1 — datalaget.** Lim inn:

> Les SPEC.md §8.2 og docs/oppsettfil.md. Lag `src/data/oppsettfil.ts` med
> fire rene funksjoner: `lagOppsett(db, valg)` som bygger objektet fra en
> hviteliste, `lesOppsett(tekst)` som parser og validerer og returnerer
> enten et gyldig oppsett eller en liste norske feilmeldinger,
> `planleggImport(db, oppsett)` som returnerer hva som blir lagt til og hva
> som hoppes over uten å skrive noe, og `importerOppsett(db, plan)` som
> skriver alt i én transaksjon. Følg reglene i §3.1 (UUID, stempler) og
> §8.2. Ikke lag UI ennå. Forklar valgene dine underveis.

**Steg 2 — testene.** Lim inn:

> Lag `src/data/oppsettfil.test.ts` mot testbasen i `src/db/testbase.ts`.
> Dekk minst: rundtur (eksport fra én base, import i en tom base, samme
> skoleår, fridager og fag), at importen er idempotent (to ganger = én
> gang), at eksisterende fag og skoleår hoppes over etter reglene, at en
> ukjent nøkkel avviser fila, at feil versjon avvises, at ugyldige datoer
> avvises med norsk melding, og en personverntest: legg inn elever,
> skåringer, notater og elevbilder i kildebasen, eksporter, og bekreft at
> ingen elevnavn, elevkoder eller notattekst finnes noe sted i JSON-teksten.
> Kjør `npm test` og vis meg resultatet.

**Steg 3 — eksport i Innstillinger.** Lim inn:

> Lag seksjonen «Del oppsett» i Innstillinger slik DESIGN.md §10 og
> docs/oppsettfil.md beskriver: avkrysning per del, feltet for skolenavn,
> elevlåsen, og «Lag oppsettfil …» som bruker `save` fra plugin-dialog og
> den eksisterende `skriv_fil`-kommandoen, slik `Arsplanmeny.tsx` gjør.
> Kjør `npm run build` til slutt.

**Steg 4 — import.** Lim inn:

> Legg «Les inn oppsettfil …» i Del oppsett, og valget «Jeg har fått en
> oppsettfil fra en kollega» i første steg av veiviseren (`Veiviser.tsx`).
> Begge går gjennom de fire trinnene i docs/oppsettfil.md: les, sjekk, vis
> hva som skjer, skriv. Feilmeldinger på norsk, med hva brukeren kan gjøre.
> I veiviserens fag-steg skal importerte fag stå som forslag å krysse av.
> Kjør `npm test` og `npm run build`.

**Steg 5 — prøv selv.** Lag en oppsettfil fra din egen base. Start appen med
en tom base (ny brukerprofil eller kopi), og gå gjennom oppsettet som om du
var Eva. Åpne `.okta`-fila i en teksteditor og les den: står det noe der som
ikke burde vært der?

**Steg 6 — oppdater STATUS.md og kryss av ARBEIDSLISTE §5.13.**
