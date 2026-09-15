# Status

Kort status pr. 2026-09-15, versjon 0.1.2. Skrevet mot SPEC.md slik den er nå.
Denne fila eies fritt — oppdater den løpende, i motsetning til SPEC.md.

## Hva som virker

Skjerm for skjerm (§4), med tilstand:

- **Førstegangsoppsett (§4.0)** — ferdig. Tre steg, lagrer underveis, kan avbrytes.
- **I dag (§4.1)** — ferdig, men med ett villet avvik: en «Årsoversikt»-widget er
  lagt til på forsiden etter eksplisitt beslutning (kommentert i koden), stikk i
  strid med §13 («ingen grafer på forsiden») og §10 (dashbord skal komme senere).
- **Årsplan (§4.2)** — halvferdig i den forstand at alt innhold finnes
  (liste, kalender, perioder, timeregnskap), men strukturert annerledes enn
  spec beskriver: spec vil ha ett fag om gangen med en liste/kalender/periode-
  bryter; koden har i stedet globale (alle fag) liste- og kalendervisninger
  under «Økter», periodene under egen fane, og en per-fag-portal i «Fag».
  I tillegg er serieopprettelse av økter bygget (`NySerie.tsx`), noe spec
  eksplisitt sier ikke skal finnes i v1.
- **Elever (§4.3)** — halvferdig. Tabell, søk, filter, manuell innlegging og
  lim inn virker. Klasseopprykk mangler helt — ingen kode leser klassenavn og
  foreslår opprykk til neste år.
- **Økt — skåring (§4.4)** — halvferdig. Tallene 0–3, autoadvansering, notat
  og pil/tab-navigasjon virker. `⌘K`-søk (hopp til elev) fra tastetabellen i
  spec finnes ikke.
- **Elev — heatmap (§4.5)** — ferdig, bortsett fra at «åpne oppfølgingspunkter»
  ikke vises (fordi §4.7 ikke har noen UI, se under).
- **Vurderinger (§4.6)** — ferdig. Samme tastemønster som skåringsflyten.
- **Oppfølging (§4.7)** — påbegynt kun i databasen. Tabellen finnes og telles i
  noen slette-bekreftelser, men det finnes ingen skjerm for å opprette, se
  eller lukke et oppfølgingspunkt.
- **Innstillinger (§4.8)** — halvferdig. Skoleår, skalaer, kalenderpublisering
  og sikkerhetskopi er her. Fagbank og «fag i år» — som spec plasserer i
  Innstillinger — ligger i stedet i `Fag.tsx`.
- **Utskrift av årsplan (§4.9)** — ferdig. Print-stylesheet med fag per side,
  perioder som overskrifter.

Datalaget (§3, §12) følger spec godt: UUID + opprettet/endret/slettet overalt,
`PRAGMA foreign_keys = ON` håndheves i frontend, `teller_ikke=1` er filtrert
konsekvent i spørringene, soft-slettede rader gjenbrukes riktig mot
UNIQUE-indekser, og ingenting spør `fag_id` direkte — alt henger på
`skolear_fag`.

## Hva som ikke er bygget av det SPEC.md lover

- Klasseopprykk (§4.3/§4.8)
- Oppfølging som brukbar skjerm (§4.7) — kun tabellen finnes
- `⌘K`-søk i skåringsflyten (§4.4)
- Findelt karakterskala med 24 verdier (§5.2) — riktig, spec sier den skal
  vente til §10
- Skalabygger (§5.3) — ikke sjekket i detalj i denne runden, men nevnes ikke
  blant det som er bygget; anta ikke bygget før noen bekrefter det

## Hva som er i stykker eller irriterer

Jeg har ikke kjørt appen manuelt i denne runden, så dette er ikke en full
feilsøk — bare det som er synlig fra koden:

- Ingen tester i det hele tatt på `OktPanel.tsx`, skåringsflyten spec selv
  kaller «den viktigste enkeltbeslutningen». Tastelogikk, autoadvansering og
  notatlagring er kun manuelt verifisert, aldri automatisk.
- Samme mangel på `ElevPanel.tsx` (heatmap) og `VurderingPanel.tsx`.
- `caldav.ts` sin kjernelogikk (retry, avbrutt-håndtering, kontrollsum) er
  utestet — kun feltbyggingen den deler med kalenderstrømmen er dekket.

## Hvor SPEC.md ikke stemmer med koden lenger

- **§4.2-navigasjon**: spec beskriver ett fag om gangen med en visningsbryter;
  koden har globale lister/kalender pluss en separat per-fag-skjerm.
- **Serieopprettelse av økter** er bygget (`NySerie.tsx`), mot et eksplisitt
  forbud i §4.2.
- **Udir Grep-integrasjon (§10, «Senere»)** er fullt bygget og koblet inn:
  søkbar fagvelger, 808 fag og 10 802 kompetansemål seedet, kobling mellom
  periode og kompetansemål. Spec plasserer dette utenfor v1.
- **§4.8s fem deler** stemmer ikke: Fagbank og «Fag i år» ligger i `Fag.tsx`,
  ikke i Innstillinger.
- **Årsoversikt-widgeten på §4.1** er et villet unntak fra §13, ikke reflektert
  i spec-teksten.

Ingen av disse er rettet i denne runden — de er notert, ikke endret. Beslutning
om spec skal oppdateres eller koden rettes tilbake, ligger hos deg.

## Tester og typesjekk

10 testfiler, 123 tester, alle grønne. `tsc --noEmit` er ren, ingen feil.

Dekningen er ujevn: importparser, duplikatgjenkjenning, arkiv-eksport, iCal og
periodelogikk er testet. De tre skjermene med mest tastaturlogikk og mest
brukertid — skåring, heatmap, vurderingspanel — har ingen tester.
