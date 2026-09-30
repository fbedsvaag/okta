# Status

Kort status pr. 2026-09-30, versjon 0.1.2. Skrevet mot SPEC.md slik den er nå.
Denne fila eies fritt — oppdater den løpende, i motsetning til SPEC.md.

**372 tester, alle grønne. `tsc --noEmit` er ren. `npm run build` går
gjennom. 16 migrasjoner.**

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
- **`⌘K`-søk (§4.4).** Står i tastetabellen, finnes ikke. Eieren vil ha det
  som et globalt søk som åpner elevvisningen — prioritert opp.
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

- **§4.2-navigasjon.** Spec beskriver ett fag om gangen med en visningsbryter;
  koden har globale lister og en egen per-fag-skjerm.
- **Serieopprettelse av økter** finnes, mot et eksplisitt forbud i §4.2.
  Eieren har sagt at spec-en er utdatert her: færrest mulig klikk er et
  overordnet prinsipp.
- **§4.9 Utskrift** beskriver ett ark med dato, ukedag, varighet og tema.
  Koden har mer: kompetansemål, faglærer, rom, fritekst, lekse, vurdering og
  fire eksportformater.
- **§3.6 «Samtaledagen er ikke en økt»** stemmer bare delvis: en
  samtaledag kan nå ligge i en økt (`samtaledag.okt_id`), og §4.10s
  «Samtaledager — ett kort per dag med dato» er i fagmodus erstattet av
  avkrysning av økter. §3.4 har `vurdering.okt_id`; koden bruker
  koblingstabellen `vurdering_okt`, og kolonnen står ubrukt.
- **§4.10 Manuell justering** sier at rader bare dras innenfor en dag.
  Eieren vil kunne dra en elev til en annen dag (typisk «sist»), nå som
  samtalene går over flere økter. Koden: settes inn når måldagen har
  plass, bytter plass med eleven det slippes på når den er full.
- **§3.2/§3.3** mangler de nye feltene fra migrasjon 014: `okt.lekse` og
  `skolear_fag.rom`, `laerer`, `kompetansemal`, `arknotat`. Og
  innstillingen `laerer_navn` står ikke i tabellen i §4.8.
- **Årsoversikt-widgeten på §4.1** er et villet unntak fra §13.
- **§4.8s fem deler** stemmer ikke: fagbank og «fag i år» ligger i Fag.
- **§11 Byggerekkefølge** er utdatert og hører hjemme i ARBEIDSLISTE.md.
- **§13 Visuell retning** er erstattet av DESIGN.md, men står fortsatt.

Disse er notert, ikke rettet. Beslutningen om spec skal oppdateres eller koden
rettes tilbake, ligger hos eieren.

## Tester

21 testfiler, 372 tester, alle grønne. `tsc` ren.

Dekningen er tung i datalaget og tynn i skjermlaget. Migrasjonene testes ved å
kjøre dem i to omganger med data imellom — kjørt mot en tom base ville en
datamigrering ikke hatt noe å flytte. Testbasen er ekte SQLite i minnet med de
ekte migrasjonene, ikke en etterlikning.
