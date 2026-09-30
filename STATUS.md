# Status

Kort status pr. 2026-09-30, versjon 0.1.3. Skrevet mot SPEC.md slik den er nå.
Denne fila eies fritt — oppdater den løpende, i motsetning til SPEC.md.

**402 tester, alle grønne. `tsc --noEmit` er ren. `npm run build` går
gjennom. 18 migrasjoner.**

## Hva som virker

Skjerm for skjerm (§4), med tilstand:

- **Førstegangsoppsett (§4.0)** — ferdig. Tre steg, lagrer underveis.
- **I dag (§4.1)** — ferdig. Dagens økter, ukelinje, årsoversikt, og en
  setning om dagens samtaler når det er noen. Årsoversikten er et villet
  avvik fra §13, kommentert i koden.
- **Årsplan (§4.2)** — ferdig, men strukturert annerledes enn spec beskriver:
  globale liste- og kalendervisninger under «Økter», perioder som egen fane,
  per-fag-portal under «Fag». Serieopprettelse finnes. Begge deler avviker
  fra spec-teksten, se under.
- **Elever (§4.3)** — ferdig, bortsett fra klasseopprykk. Batch-slett,
  mentorkolonne og -filter, AND/OR i fagfilteret, forfalt-merke ved navnet.
- **Økt — skåring (§4.4)** — ferdig bortsett fra `⌘K`-søk.
- **Elev — heatmap (§4.5)** — ferdig, og redigerbar: navn, klasse, mentorelev
  og fag endres i panelet. Møteloggen ligger nederst.
- **Vurderinger (§4.6)** — ferdig. Viser nå også hvilken oppgave eleven trakk,
  når vurderingen har en samtaletrekning knyttet til seg.
- **Notater og møtelogg (§4.7)** — ferdig. Erstattet den gamle
  oppfølgingsskjermen som aldri ble bygget.
- **Innstillinger (§4.8)** — ferdig. Fagbank og «fag i år» ligger i Fag-fanen,
  ikke her.
- **Utskrift og eksport av årsplan (§4.9)** — ferdig, og utvidet. Ett fag
  (eller alle) på papir/PDF, som Word, markdown (kopi eller fil) og CSV.
  Hodet har faglærer, rom, timeregnskap, fritekst og kompetansemålene fra
  Udir; tabellen har uke, dato, tema, lekse og vurdering. Feltene velges
  av og på under «Velg felt …» (også klokkeslett, timer, sted og agenda),
  og valget gjelder alle formatene. Utskriften kuttet
  før alt etter første side — rettet 30.09.
- **Vurdering knyttet til økt** — ferdig 30.09. Én vurdering kan ligge over
  flere økter (migrasjon 016, koblingstabell). Automatisk når fristen faller
  på en øktdag, og for hånd fra begge panelene.
- **⌘K-søk** — ferdig 30.09. Globalt, ikke bare i skåringsflyten som §4.4
  beskriver. Finner elever (navn, klasse, fag) og økter (tema, fag, alias,
  dato i ISO og norske formater). Fag kan ha et alias (migrasjon 018).
- **Samtaletrekkeren i økter** — ferdig 30.09. I fagmodus krysses fagets
  økter av i stedet for å legge inn datoer; øktas klokkeslett er rammen,
  uten lunsj. Vurderingen knyttes til hver økt. Egne dager utenfor øktene
  går fortsatt. Slike dager telles ikke dobbelt i timeregnskapet.
- **Samtaletrekkeren (§4.10)** — ferdig. To modus, trekning med låser,
  dra-og-slipp, tre visninger, tre eksporter, historikk på tidspunkt, og
  publisering av mentorsamtaler til kalenderserveren.

## Hva som ikke er bygget av det SPEC.md lover

- **Klasseopprykk (§4.3/§4.8).** Datamodellen bærer det, skjermen finnes ikke.
  Avventer — eieren er usikker på om det trengs.
- **Skalabygger (§5.3).** Spec sier selv at den kommer etter rammeverket.
- **Findelt karakterskala (§5.2).** Riktig — den hører til §10.

## Hva som er i stykker eller irriterer

- **Appen ser hjemmesnekra ut.** Eierens ord. Steg 1 av oppstrammingen er
  gjort 21.09 (typografi med serif-overskrifter, tetthet, fokus, knapper).
  DESIGN.md er ikke oppdatert etter det — den beskriver fortsatt
  utgangspunktet fra august. Eieren synes toppmenyen har for mange lister;
  det hører til neste steg.
- **Skjermkomponentene har ingen tester.** `OktPanel`, `ElevPanel`,
  `VurderingPanel` og `Samtaler` er utestet på komponentnivå. Datalaget under
  dem er godt dekket — all trekningslogikk, kapasitetsregning,
  lunsjplassering, historikk og eksport har egne tester — men tastaturflyten
  og selve rendringen er bare manuelt prøvd.
- **`caldav.ts` sin nettverksdel er utestet.** Feltgrensen i
  `lagSamtaleHendelse` og `ical.ts` er testet; retry, avbrudd og
  kontrollsummer er det ikke.
- **To elever mangler etternavn** i basen: «Per» fra 7. august og «Kåre» fra
  16. september. Begge uten skåringer. Panelet advarer nå om dem.
- **Tabellen `oppfolging` står igjen tom** og uten kallsteder, erstattet av
  `elevnotat`. Kan slippes i en senere migrasjon.

## Hvor SPEC.md ikke stemmer med koden lenger

SPEC.md ble oppdatert 30.09 med alt som ble bygget den dagen (meny, perioder
som fargelegging, tema i lista, serieopprettelse, årsplanarket og eksporten,
vurdering over flere økter, samtaledager i økter, gruppesamtaler, dra mellom
dager, ⌘K, alias, de nye feltene). Det som står igjen:

- **Årsoversikt-widgeten på §4.1** er et villet unntak fra §13.
- **§11 Byggerekkefølge** er utdatert og hører hjemme i ARBEIDSLISTE.md.
- **§13 Visuell retning** er erstattet av DESIGN.md, men står fortsatt — og
  DESIGN.md beskriver utgangspunktet fra august, ikke serif-overskriftene.

## Tester

23 testfiler, 402 tester, alle grønne. `tsc` ren.

Dekningen er tung i datalaget og tynn i skjermlaget. Migrasjonene testes ved å
kjøre dem i to omganger med data imellom — kjørt mot en tom base ville en
datamigrering ikke hatt noe å flytte. Testbasen er ekte SQLite i minnet med de
ekte migrasjonene, ikke en etterlikning.
