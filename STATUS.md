# Status

Pr. 2026-10-13, versjon 0.3.0 (beta, utgitt 13.10 som pre-release). Beskriver hvor appen faktisk står, ikke hva
den skal bli. Fila eies fritt, i motsetning til SPEC.md.

**645 tester i `npm test` og 25 i `cargo test`, alle grønne på Mac.
`tsc --noEmit` er ren. `npm run build` går gjennom. 24 migrasjoner.**

Utseendet står i `DESIGN.md`, som beskriver appen slik den er bygget.
Lerretet (`docs/lerret/`) er fasit for det som er tegnet.

## Siste runde (07.10, ARBEIDSLISTE §10 og §11)

Prøvd i `npm run tauri dev`, skjerm for skjerm mot lerretet.

- **Bevegelse:** ark, elevkort, ⌘K og menyer kommer inn uten sprett og
  uten blink (glass tones aldri med opacity). Hover er én glassflate som
  glir. Zoom med ⌘+ ⌘− ⌘0.
- **Glass:** fargeteppet som i lerretet, menyene og alle arkene i glass.
- **Elever:** ny oversikt med gruppering, innsats siste 10 og fravær mot
  10 %. Tabellen med avkrysning og skjemaet er borte.
- **Fagsiden:** Oversikt | Økter | Kalender i Økter.
- **Økta:** to moduser, Skåring og logg | Planlegging. Trafikklyset står
  først i raden.
- **Årsplanen som PDF:** egne A4-sider med sidetall og «fortsetter».
- **Fravær** regnes i timer mot 10 % av fagets årstimetall, i lista, på
  fagsiden og i elevkortet.

## Hva som virker

- **Førstegangsoppsett (§4.0):** veiviser med fem steg, lagrer underveis.
- **I dag (§4.1):** dagens økter, uka som kalender med nå-strek,
  gjøremål med logg, vurderingsfrister, elever som glipper, innsats over
  tid og timeregnskap. Økta åpnes i skåring herfra.
- **Økter (§4.2):** liste med tema rett i raden, perioder som merkelapper
  (P setter periode), utfoldet økt; kalender med Uke | Måned der måned
  ruller gjennom hele året; fagsiden. Serieopprettelse finnes.
- **Elever (§4.3):** oversikten over. Eleven endres i elevkortet. Klasser
  bak ⋯. Lim inn liste og InSchool-PDF med bilder og kjønn gjettet fra
  SSBs navneliste.
- **Økt (§4.4):** skåring med tastene fra skalaen, notat på raden,
  planlegging med sjekkliste og kompetansemål. ⌘← ⌘→ blar.
- **Elev (§4.5):** elevkort med heatmap for hele året, vurderinger,
  fravær per fag, klassekart og tidslinje med notater og møtelogg.
- **Vurderinger (§4.6), notater (§4.7), innstillinger (§4.8):** ferdig,
  med mørk modus, seks paletter, glass av/på og bevegelse.
- **Årsplanen ut (§4.9):** PDF, Word, markdown og CSV fra samme innhold.
- **Samtaletrekkeren (§4.10):** ferdig, med notat fra samtalen og
  publisering av mentorsamtaler.
- **Klassekart (§4.11):** rom, plasser, grupper, fordeling og historikk.
- **CalDAV (§8.1), arkiv og sikkerhetskopi (§8):** ferdig.

## Beta 0.3.0 og Windows (13.10, ARBEIDSLISTE §12–14)

- **Innsats over tid** (12.1) har erstattet prikkene på I dag.
- **Gi tilbakemelding** (13.1) står over Innstillinger, men er skjult til
  lenka i `src/tilbakemelding.ts` er fylt inn. Kopierer versjon, system og
  skjermnavn (aldri innhold) og åpner skjemaet i nettleseren.
- **Dmg-en** (13.2) får testheftet `betatest.pdf` og den oppdiktede
  klasselista ved siden av guiden. Releaseoppskriften står i
  `docs/release.md`. Releasen er ikke laget.
- **Windows** (§14) bygges bare på GitHub Actions
  (`.github/workflows/windows.yml`): `npm test` og `cargo test` på
  Windows, så NSIS-installer per bruker. Ingen har kjørt appen på en
  Windows-maskin ennå; det som er sjekket, er det testene dekker:
  hurtigtaster (⌘/Ctrl, og at WebView2 ikke tar Ctrl+P/F/R/W),
  Windows legitimasjonsbehandling for kalenderpassordet, `.okta` som
  argument og fra en ny prosess, Windows-ord i Innstillinger, og at
  databasen og kopiene ligger i samme mappe.
- **Mac er uendret** for brukeren: ⌘ vises, ⌘K, ⌘, og G-snarveiene
  virker. Én liten forskjell: Ctrl+tast på Mac utløser ikke lenger
  ⌘-snarveiene (Ctrl+E i et tekstfelt flytter markøren, som i andre
  Mac-apper).

## Test-dmg til kolleger (0.2.0)

- **Oppsettfila (§8.2, 5.13):** bygget, men ikke prøvd i appen ennå.
  Innstillinger › Del oppsett lager og leser inn; veiviseren har «Bruk en
  oppsettfil fra en kollega» med fagene som forslag; dobbeltklikk på
  `.okta` åpner Økta (egen filtype `no.elevtracking.oppsett`).
- **`npm run dmg`** bygger for Apple-brikke og Intel, signert lokalt (uten
  Apple-konto), minst macOS 13, og legger `guide_read_me.pdf` i dmg-en ved
  siden av appen. Resultatet havner i `dist-dmg/`. Kollegene må trykke
  «Åpne likevel» første gang; guiden viser hvordan.
- Ikke prøvd ennå: en tom brukerkonto, fra installasjon til første økt.
- Testene låser tidssonen til Europe/Oslo (`vite.config.ts`), så de gir
  samme svar på GitHub Actions, som går på UTC.
- Rust-binæren har kildestier med brukernavnet i seg (vanlig for Rust),
  ingen data. Kan vaskes med `--remap-path-prefix` om ønskelig.

## Hva som ikke er bygget

- **Masseredigering i Elever:** merke flere og endre fag, klasse eller
  mentor samtidig. Skal tegnes i lerretet først.
- **Klasseopprykk (§4.3):** avventer; eieren er usikker på om det trengs.
- **Skalabygger (§5.3)** og **findelt karakterskala (§5.2):** hører til
  §10 i spec-en.
- **Klassekart med gruppefarger og logg, vurderinger som kalender:**
  tegnes i neste runde.

## SPEC.md og DESIGN.md

Følger appen; arbeidet er iterativt (CLAUDE.md). SPEC.md ble oppdatert
13.10: Elever (§4.3), økta med to moduser (§4.4), fagsiden (§4.2), PDF-en
(§4.9), fravær mot 10 % (ny §4.12), arkivmappa (§4.8 og §8) og en ny bolk
om sikkerhet i §8.

## Kjent

- **Issues fra Torbjørn (GitHub):** #1–#9 og #11–#13, #15, #16 er rettet
  13.10. Det som merkes for brukeren:
  - Arkivmappa må velges på nytt én gang (Innstillinger › Arkiv); den
    huskes nå i `arkivmappe.txt`, ikke i databasen (#1).
  - Kalenderstrømmen har ny adresse med en hemmelig nøkkel
    (`/<nøkkel>/arsplan.ics`), og et eksisterende abonnement må legges inn
    på nytt (#11).
  - CalDAV godtar bare `https://` (#9).
  - `sql:allow-execute` står fortsatt åpen; andre skrivinger med flere
    steg kan flyttes til `transaksjon` etter hvert (#2).
- **Åpent:** #10 signering (venter, koster penger; workflowen er låst og
  delt i test og bygg) og #14 (Samtaler.tsx og ElevPanel.tsx er store;
  deles opp litt om gangen).
- **Under utvikling** (`tauri dev`) kan vinduet bli blankt etter at koden
  er endret mens appen kjører. Lukk og start vinduet på nytt. Den ferdige
  appen er ikke berørt.
- **Skjermkomponentene har ingen tester.** Datalaget er godt dekket.
- **`caldav.ts` sin nettverksdel er utestet**; feltgrensen er testet.
- **Tabellen `oppfolging` står igjen tom**, erstattet av `elevnotat`.

## Tester

Testbasen er ekte SQLite i minnet med de ekte migrasjonene. Dekningen er
tung i datalaget og tynn i skjermlaget.
