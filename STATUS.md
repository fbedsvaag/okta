# Status

Pr. 2026-10-07, versjon 0.1.3. Beskriver hvor appen faktisk står, ikke hva
den skal bli. Fila eies fritt, i motsetning til SPEC.md.

**578 tester, alle grønne. `tsc --noEmit` er ren. `npm run build` går
gjennom. 24 migrasjoner.**

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

## Hva som ikke er bygget

- **Oppsettfila (§8.2, ARBEIDSLISTE 5.13):** veiviseren viser valget «Bruk
  en oppsettfil fra en kollega», men verken eksport (Innstillinger › Del
  oppsett) eller import er bygget.
- **Masseredigering i Elever:** merke flere og endre fag, klasse eller
  mentor samtidig. Skal tegnes i lerretet først.
- **Klasseopprykk (§4.3):** avventer; eieren er usikker på om det trengs.
- **Skalabygger (§5.3)** og **findelt karakterskala (§5.2):** hører til
  §10 i spec-en.
- **Klassekart med gruppefarger og logg, vurderinger som kalender:**
  tegnes i neste runde.

## Hvor SPEC.md ikke stemmer med appen

Forslag til ny tekst står i `docs/spec-forslag-2026-10-07.md`.

- §4.3 beskriver en tabell med avkrysning, kolonnene Økter og Siste, og
  manuell innlegging i en tom rad nederst. Appen har oversikten fra
  lerretet. Eieren har bestemt at InSchool-import og lim inn er veien inn.
- §4.4 har trafikklyset til høyre for navnet. Det står nå først i raden,
  og økta har to moduser.

## Kjent

- **Under utvikling** (`tauri dev`) kan vinduet bli blankt etter at koden
  er endret mens appen kjører. Lukk og start vinduet på nytt. Den ferdige
  appen er ikke berørt.
- **Skjermkomponentene har ingen tester.** Datalaget er godt dekket.
- **`caldav.ts` sin nettverksdel er utestet**; feltgrensen er testet.
- **Tabellen `oppfolging` står igjen tom**, erstattet av `elevnotat`.

## Tester

Testbasen er ekte SQLite i minnet med de ekte migrasjonene. Dekningen er
tung i datalaget og tynn i skjermlaget.
