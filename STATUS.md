# Status

Kort status pr. 2026-09-21, versjon 0.1.2. Skrevet mot SPEC.md slik den er nå.
Denne fila eies fritt — oppdater den løpende, i motsetning til SPEC.md.

**319 tester, alle grønne. `tsc --noEmit` er ren. `npm run build` går
gjennom. 13 migrasjoner.**

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
- **Utskrift (§4.9)** — ferdig.
- **Samtaletrekkeren (§4.10)** — ferdig. To modus, trekning med låser,
  dra-og-slipp, tre visninger, tre eksporter, historikk på tidspunkt, og
  publisering av mentorsamtaler til kalenderserveren.

## Hva som ikke er bygget av det SPEC.md lover

- **Klasseopprykk (§4.3/§4.8).** Datamodellen bærer det, skjermen finnes ikke.
  Trengs første gang et nytt skoleår opprettes, altså august 2027.
- **`⌘K`-søk i skåringsflyten (§4.4).** Står i tastetabellen, finnes ikke.
- **Skalabygger (§5.3).** Spec sier selv at den kommer etter rammeverket.
- **Findelt karakterskala (§5.2).** Riktig — den hører til §10.
- **Å knytte en vurdering til økta den ble holdt i.** `vurdering.okt_id`
  finnes og leses, men ingenting skriver den. Koblingen virker i dag bare
  ved at fristen tilfeldigvis er samme dato som økta.

## Hva som er i stykker eller irriterer

- **Appen ser hjemmesnekra ut.** Eierens ord, og det er den største åpne
  saken nå. DESIGN.md er skrevet som et designoppdrag, men aldri utført —
  paletten i `index.css` er tatt i bruk, resten av briefen ikke.
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
- **Årsoversikt-widgeten på §4.1** er et villet unntak fra §13.
- **§4.8s fem deler** stemmer ikke: fagbank og «fag i år» ligger i Fag.
- **§11 Byggerekkefølge** er utdatert og hører hjemme i ARBEIDSLISTE.md.
- **§13 Visuell retning** er erstattet av DESIGN.md, men står fortsatt.

Disse er notert, ikke rettet. Beslutningen om spec skal oppdateres eller koden
rettes tilbake, ligger hos eieren.

## Tester

19 testfiler, 319 tester, alle grønne. `tsc` ren.

Dekningen er tung i datalaget og tynn i skjermlaget. Migrasjonene testes ved å
kjøre dem i to omganger med data imellom — kjørt mot en tom base ville en
datamigrering ikke hatt noe å flytte. Testbasen er ekte SQLite i minnet med de
ekte migrasjonene, ikke en etterlikning.
