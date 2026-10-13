# Økta

Lokal desktop-app for undervisningsplanlegging og elevoppfølging. Tauri 2 +
SQLite + Vite/React/TypeScript. Bygges av én lærer, til eget bruk.

## Les alltid dette først

**Les `SPEC.md` i sin helhet ved starten av hver økt**, før du skriver kode.
Den beskriver hva appen skal gjøre. Er noe uklart om hva brukeren vil, spør.

Brukeren er ikke utvikler. Forklar valgene dine underveis på norsk, med vanlige
ord. Kjør ikke lange sekvenser uten å si hva du gjør.

## Ufravikelige regler

1. **Null nettverkskall i appen, med ett avgrenset unntak.** Ingen telemetri,
   ingen oppdateringssjekk, ingen API-er. Databasen ligger lokalt. Dette er et
   personvernkrav, ikke en preferanse.

   **Unntaket (§8.1):** appen kan publisere timeplanen til én CalDAV-adresse
   brukeren selv har lagt inn. Av som standard. Bare seks felter går ut — fag,
   tittel, dato, klokkeslett, sted og agenda. Aldri elevnavn, skåringer, notater eller
   vurderingsresultater. Publiseringen er **enveis**: appen skriver, og leser
   aldri noe tilbake. Utvid aldri feltlista uten å spørre.
2. **UUID-primærnøkler, `opprettet`/`endret`-stempler og soft delete på alt.**
   Se §3.1 og §9. Dette er dyrt å rette senere.
3. **Ingen fagkoder, klassenavn eller skalaer hardkodet.** Alt opprettes av
   brukeren eller seedes som data i migrasjoner. MFL1 og ENG1 i spec-en er
   eksempler, ikke konfigurasjon.
4. **Findelt karakterskala har 24 verdier med bevisst ujevn bunn.** Se §5.2.
   Ikke «rett opp» mønsteret til å bli symmetrisk.
5. **Verdier med `teller_ikke = 1`** (`IV`, «ikke i økta») skal aldri inngå i
   snitt, heatmap eller annen sammenstilling. Legg filteret i spørringslaget.
6. **`PRAGMA foreign_keys = ON`** ved hver tilkobling.

## Prioritering

Tre likestilte formål, i den rekkefølgen de brukes gjennom året: planlegge
skoleåret (§4.2), skåre elever underveis (§4.4), se eleven over tid (§4.5).

Byggerekkefølgen står i §11. Dag 1–4 er det brukeren trenger i august, dag 5–7
er det som må stå til første undervisningsuke. Skjer det en prioritering,
gjelder den rekkefølgen.

## SPEC.md, DESIGN.md og STATUS.md

**Arbeidet er iterativt.** SPEC.md og DESIGN.md følger appen, ikke omvendt.
Avviker appen med god grunn, oppdaterer du dokumentet i samme runde og nevner
det kort. Ikke heng deg opp i avvik. Endrer noe hva appen gjør for brukeren,
si det i rapporten.

**STATUS.md eier du og kan oppdatere fritt.** Den beskriver hvor prosjektet
faktisk står, ikke hva det skal bli.

## Repoet er offentlig

Alt som committes, ligger åpent på GitHub. Derfor:

- **Aldri ekte elevdata i git.** Ikke `privat/`, ikke navn, ikke
  skjermbilder eller eksporter fra en database med ekte elever. Det gjelder
  også tester, testdata og commit-meldinger.
- **Sjekk `git diff --cached` for ekte navn før hver commit.**
- **README-bildene i `docs/readme/` er laget fra lerretet.** Lag aldri nye
  fra appen.
- Releaser: se `docs/release.md`.

## Testdata

`dummydata/` inneholder fire fiktive klasselister med navn fra The Sopranos, i
fire ulike formater. De er testdata for lim-inn-parseren (§7), ikke bare
navnefyll — se `dummydata/README.md` for hvilke kanter de dekker.

Bygg mot disse fra dag 1. Ekte klasselister kommer først på første skoledag.

## Ikke i v1

`scripts/hent_grep.py` henter læreplaner fra Udir og hører til §10 — det er et senere
gjøremål. Ikke bruk tid på det før §4.2–4.5 står.
