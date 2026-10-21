# Status

Pr. 2026-10-20, versjon 0.4.0 (utgitt 20.10). Beskriver hvor appen faktisk står, ikke hva
den skal bli. Fila eies fritt, i motsetning til SPEC.md.

**740 tester i `npm test` og 25 i `cargo test`, alle grønne på Mac.
`tsc --noEmit` er ren. `npm run build` går gjennom. 28 migrasjoner.** Testene kjører på GitHub ved hver push (`tester.yml`, Mac).

Utseendet står i `DESIGN.md`, som beskriver appen slik den er bygget.
Lerretet (`docs/lerret/`) er fasit for det som er tegnet.

## Runde 19 (20.10, ARBEIDSLISTE §19)

- **19.1 Ny elev** (`skjermer/NyElev.tsx`, lerretet ElevNy): glasskort under
  «+ Ny elev» (N). Navnet deles mens du skriver; Tab flytter skillet når det
  er tre ord eller flere (`skjermer/elevnavn.ts`). Klasse som brikker (+ Ny
  klasse), fag som fargebrikker med filterets fag forhåndsvalgt, mentorelev
  som bryter (mentor-flagget; krever klasse). Duplikatsjekken fra importen:
  samme navn stenger Lagre, med «Ny likevel» for to elever med samme navn;
  skrivefeil-nærhet gir bare en grå linje. ↵ lagrer og åpner kortet, ⇧↵
  lagrer og tømmer navnet. Klassen huskes til neste gang. Ny rad glir inn.
- **19.2 Fast overskrift i Økter**: kolonnehodet står fast øverst i glass
  (`.okter-hode`), og månedsoverskriften fester seg rett under det til neste
  måned tar over. Rullingen til dagens økt og piltastene regner med begge.
- **Dra og bytt i Økter, gjort tydelig (21.10).** Datoene står, innholdet
  (tema, periode, vurdering, agenda) svever med pekeren. Det du står over,
  tones ned der det står, og på plassen du kom fra tones en stille
  forhåndsvisning av det inn. Ingenting annet reiser (det spratt for mye). Ved
  slipp lander innholdet der det svevde, og byttet vises med en gang mens
  lagringen går i bakgrunnen. Ingen bytte før midten har forlatt egen rad
  (`finnMal`). Rødt kort over en skåret økt. Kolonnehodet er tett, ikke
  glass: brikkene skinte gjennom som klatter.
- **19.3 Smidigere markering i Økter**: ⌘-klikk på en rad tar én, ⇧-klikk
  et spenn fra forrige klikk (eller fra markøren), og når noe alt er valgt,
  velger et vanlig klikk på raden. Uten noe valgt åpner klikket titten som
  før. Dra over avkrysningene maler et utvalg; første rad avgjør om det
  merkes eller tas bort. Esc tømmer (som før).
- **19.5 Serier med intervall** (`NySerie.tsx`, `lagSerie` med `Rytme`):
  Hver uke, Annenhver, Hver tredje, Hver n-te, A-uke og B-uke. Ukene telles
  i kalenderen, så en ferie flytter ikke rytmen. A-/B-uke veksler jevnt fra
  skoleårets første uke (også over uke 53); «Bytt A og B» lagres per
  skoleår (`a_uke:<skolear>`). Datoene står under skjemaet mens du velger,
  og forhåndsvisningen med avhaking er som før.
- **19.4 Ikke skåret = til stede, ikke sett.** Før talte `hentOktrader` en
  elev uten skåring i en avholdt økt som borte (`sv.id IS NULL`), etter
  SPEC §4.4. Det ga fravær, prosent mot 10 %-grensen, grå rute i Elever og
  fagoversikten og «borte sist». Nå er bare `teller_ikke` borte; ikke skåret
  er et eget flagg (`ikkeSett`) og en tom rute (`t`) som verken er fravær
  eller innsats. Heatmapet i elevkortet og eksportene leste skåringene
  direkte og var riktige fra før. Nytt: rolig linje ved Ferdig («3 elever
  er ikke skåret · regnes som til stede», Vis åpner økta på «Ikke sett»),
  «Ikke sett sist» i Følg opp i økta, og «Ikke sett» i filteret når økta er
  i gang. SPEC §4.4 må oppdateres (forslag gitt eieren).

## Hjemmesiden (20.10, ARBEIDSLISTE 18.3)

Statisk side i `site/` (index.html, personvern.html, forste-gang.html, stil.css, side.js,
bilder/, fonter/). Ingen rammeverk og ingen byggesteg. Geist ligger ved,
og siden henter ingenting fra andre enn seg selv: ingen informasjonskapsler,
ingen analyse, ingen tredjepartsskript. Relative stier, så den kan flyttes
til Cloudflare Pages eller Netlify uten endringer. Publiseres med GitHub
Pages fra `site/` (`.github/workflows/side.yml`).

- «Første gang du åpner Økta» (`forste-gang.html`): Mac (Åpne likevel i
  Personvern og sikkerhet, og `xattr` hvis Mac sier at appen er skadet) og
  Windows (Edge «Behold likevel», SmartScreen «Kjør likevel»). Lenket fra
  begge nedlastingskortene og bunnmenyen.
- Bildene er trukket ut av tegningen (webp og jpg), ingen nye skjermbilder.
- Animasjonene starter når kortene ruller inn (IntersectionObserver), og
  står stille på sluttbildet med «Reduser bevegelse».
- Mobil og nettbrett: én kolonne, teksten før bildene, ingen vannrett
  rulling (sjekket i WebKit på 390 px).
- Lighthouse (etter tekstsprinten): skrivebord 100/100/100/100; mobil
  ytelse 95, resten 100; personvernsiden 98/100/100.
- Elevkortet, klassekartet, samtalene og kalenderstrømmen er HTML med
  egne animasjoner i side.js; fargeflatene glir, knappene har glans. Alt
  står stille med «Reduser bevegelse».

**«Gratis» og «kildekoden er åpen» på siden** (etter tekstsprinten 20.10):
«Hva koster det?» svarer «Økta er foreløpig gratis å bruke for alle lærere.» Ellers står «gratis» ikke på siden.
Lenkene «Kildekode på GitHub» (bunnen) og «Les koden selv» på
personvernsiden står igjen. Repoet har fortsatt ingen lisensfil.

**Systemkravene** er rettet mot det som faktisk bygges:

- Mac: macOS 13 eller nyere (`minimumSystemVersion: "13.0"`), universal-
  dmg for Apple-chip og Intel. Tegningen sa bare «macOS».
- Windows: Windows 10 og 11, 64-bit (NSIS-installer for x64,
  `Okta_0.3.0_x64-setup.exe`). WebView2 lastes ned ved installasjon hvis
  den mangler. Tegningen sa «Windows 10 og 11».
- Hjelpeteksten for Mac sa «høyreklikk og velg Åpne»; det virker ikke
  lenger fra macOS 15. Rettet til Systeminnstillinger › Personvern og
  sikkerhet › «Åpne likevel», som i guiden.

**Tekst som ikke stemte med appen, og er rettet på siden:**

- «Bare to ting går på nett … fagsøket mot Udir. Søket sender bare
  fagkoden.» Fagsøket går ikke på nett; lista følger med appen
  (`src/assets/grep-fag.json`). Nå: «Bare én ting går på nett …».
- Personvernsiden sier i tillegg at kontaktsamtaler kan publiseres med
  elevens fornavn og klokkeslett (SPEC §8.1), at «Gi tilbakemelding»
  åpner et skjema i nettleseren, og at Windows-installasjonen laster ned
  WebView2. Det sto ikke i tegningen.

**Nedlasting:** knappene peker til `releases/latest`. Den er i dag v0.2.0,
fordi 0.3.0 er merket som pre-release. Siden sier «Versjon 0.3.0». Merk
0.3.0 som siste versjon på GitHub, eller endre teksten.

## Runde 16 og 17 (19.–20.10, ARBEIDSLISTE §16 og §17)

Bygget etter lerretene OktFravaer (variant B), OktSkarFilter,
OktListeMasse, OktBytt, OktTekst og OktVurdering, og ønskene i §17.
Prøvd i `tauri dev` med dummydata, også i mørk modus.

- **17.7 Fagsøket:** søket i Udirs fagliste virket, men veiviseren for
  nye brukere hadde det ikke med. Nå står det øverst i veiviseren og er
  åpent under Fag. Lista følger med appen; ingen nettkall.
- **16.8 / 16.1:** fravær tydeligere (mørk prikk med kryss, bleket rad),
  og filteret Alle · Til stede · Borte (A, B) med «Kopier navnene».
- **16.5:** I dag-linja i Økter-lista.
- **16.2 / 16.3:** periodebrikke med ett klikk, flervalg med mørk linje
  nederst (Periode, Tid og rom, Lekse, Vurdering, Flytt, Slett), toast og
  ⌘Z. Felles deler i `ui/Flervalg.tsx`, `ui/Toast.tsx`, `ui/angre.ts`.
- **16.4:** bytt to økter med dra eller ⌥↑↓; skårede ligger fast; ⌘Z.
- **16.6 / 16.7:** agenda med avsnitt (linjeskift i kalenderen) og Kladd
  (migrering 025). En test sjekker at kladden aldri er i kalenderen,
  arkivet eller årsplanen.
- **16.9:** ny vurdering rett fra økta. Typen Underveis · Sluttvurdering
  fra lerretet er ikke bygget (se under).
- **17.1:** fagbrikkene i øktlista under Alle fag, husket per visning.
- **17.2:** ikon og frist i vurderingslistene, ikon på typene, prikk på
  typene i skoleruta.
- **17.3:** fargevelger på fagsiden (og samme komponent i fagtabellen).
- **17.4:** flervalg og sletting i Elever, bekreftet med antall og navn.
- **17.5:** standard pause per fag (migrering 026), lagt inn i planen i
  nye økter som «Del 1 · Pause · Del 2».
- **17.6:** «Teller høyst, min per økt» per fag (migrering 027), et tak
  som gjelder fagsiden, årsplanen, forsiden og fraværsgrunnlaget.

**Åpent:**

- Forslag til SPEC: skal vurderinger ha Underveis · Sluttvurdering? Det
  krever en ny kolonne, og SPEC sier at standpunkt settes i InSchool.
- Angre (⌘Z) gjelder periode, bytte, flytting, tid og rom, lekse,
  vurdering og sletting av økter. Sletting av elever bekreftes, men kan
  ikke angres.

## Runde 15 (14.10, ARBEIDSLISTE §15)

Bygget etter lerretene KalenderTitler, Nedtrekk, OktPlanNy, OktPlanEnkel og
OktLiveVertikal. Den vannrette stripa (OktLive) ble bygget først og
erstattet av den loddrette samme kveld.

- **Kalendertitler (15.1):** økta som brikke i to linjer, dagens dato i
  merke, fagbrikker som skjuler og viser fag i uke, måned og heatmap.
- **Nedtrekksmenyen (15.9):** `ui/Velger.tsx` har erstattet alle 25
  `<select>`. Kontekstmenyene har samme glass, rader og markør.
- **Planformatet (15.8):** pause, beskrivelse, `+5 min` og `ferdig 09:16`
  i `okt.plan`. Eldre planer leses som før.
- **Dra og slipp:** felles mekanikk i `ui/dra.ts`, brukt i
  samtaletimeplanen og øktplanen. Grupper og klassekart bruker den ikke
  ennå.
- **Planleggingen (15.2–15.5):** tidslinje med skiller, ende og stokking,
  lengdevalg, beskrivelser, «for lite tid», faktarad på én linje,
  kompetansemål foldet sammen.
- **Øktplan: Enkel | Full (15.10)**, Enkel som standard.
- **Live i skåringen (15.6–15.7):** med Full en loddrett tidslinje i høyre
  kolonne, med Enkel én linje under arkhodet. Automatisk avkrysning, +5 min
  og ferdig før tida. Prøvd i appen, også i mørk modus.
  - Avkrysningen når tida er ute regnes fra klokka og lagres ikke; bare
    klikk og +5 min skrives til planen. Da skrives det ikke til basen
    hvert minutt mens man skårer.
  - Tidslinjen vises bare den dagen økta er.

**Prøvd:**

- Nedtrekksmenyen, planen og live-stripa er prøvd i systemets WebKit
  (WKWebView) på egne prøvesider, med syntetiske pekere og taster.
  - Tidslinjen: skille, ende og stokking lagrer riktig.
  - Lista: «Film · 15 min», ↵ og ⌥↑.
  - Skåringen: +5 min og avkrysning.
  - Alle fem live-tilstandene er sammenlignet med lerretet.
- **Prøvd i appen (`tauri dev`):**
  - kalenderen i uke og måned, med fagbrikkene;
  - draget i samtaletimeplanen;
  - periodemenyen og esc i økta;
  - skåring og planlegging i Enkel.
  - Rettet underveis: to økter fikk ikke plass i en dagrute, titler ble
    klippet midt i en linje i uka, esc i en meny lukket hele arket, og
    markøren startet på feil rad.
  - Full er prøvd med mus i appen: skillet og stokkingen i tidslinjen,
    live-stripa mens økta pågår, «+5 min» og avkrysning før tida.
    «+ Aktivitet» og «+ Pause» brøt over to linjer i et smalt ark og er
    rettet.

## Runde 10 og 11 (07.10, ARBEIDSLISTE §10 og §11)

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
- **Økt (§4.4):** skåring med tastene fra skalaen, notat på raden, planen
  live under toppen; planlegging med tidslinje, beskrivelser og
  kompetansemål (Enkel | Full). ⌘← ⌘→ blar.
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

## Gjennomgang 13.10 (funksjonelle feil)

Rettet, med tester: ferdige vurderinger fylte fristlista på I dag;
vurderingsfristen fulgte ikke med når en økt ble flyttet; kalenderstrømmen
ble bare bygget ved oppstart; sikkerhetskopi og arkiv ble bare tatt ved
oppstart, og I dag skiftet ikke dag over midnatt (useIdag); «Elever som
glipper» på forsiden brukte en annen regel enn Elever-lista; antall elever
i fristlista talte slettede elever; økt-koder kunne bli like etter en
sletting; duplisering tok ikke med kompetansemål; klassekart for fjernede
fag ble stående. Samme kveld: vektingen i samtaletrekningen, blinking ved
dra-og-slipp i timeplanen, og at samtaletid og pause ikke ble husket.

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
  delt i test og bygg). #14 er gjort: elevkortet og Samtaler er delt i
  `elevkort/` og `samtaler/`, med `useLagretInnstilling` for innstillinger
  som hører til et fag.
- **Under utvikling** (`tauri dev`) kan vinduet bli blankt etter at koden
  er endret mens appen kjører. Lukk og start vinduet på nytt. Den ferdige
  appen er ikke berørt.
- **Skjermkomponentene har ingen tester.** Datalaget er godt dekket.
- **`caldav.ts` sin nettverksdel er utestet**; feltgrensen er testet.

## Tester

Testbasen er ekte SQLite i minnet med de ekte migrasjonene. Dekningen er
tung i datalaget og tynn i skjermlaget.
