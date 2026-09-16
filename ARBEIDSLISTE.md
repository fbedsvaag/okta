# Økta — arbeidsliste

Prioritert rekkefølge. Punktene er de samme som i forbedringslista, bare
sortert etter hva som blokkerer hva, og hva som koster hva.

Kryss av underveis. Legg nye punkter nederst i riktig bolk, ikke øverst.

---

## 0. Blokkerende

- [x] **Sletting av skoleår låser appen.** Fikset i datalaget: `slettSkolear`
  flytter selv pekeren, `hentAktivtSkolear` faller tilbake på nyeste
  gjenværende år og rydder pekeren når det ikke er noen igjen. Baser som
  allerede har den døde pekeren repareres ved neste oppstart. `aktivt_skolear`
  var den eneste innstillingen som peker på en rad — resten er tall, stier og
  kolonnevalg. 8 tester i `skolear.test.ts`.

Dette er ikke en irritasjon. Det er en database som kan bli utilgjengelig,
og det finnes allerede baser med den døde pekeren i seg.

## 1. Layout — én ordentlig runde

Dashbordet som flytter seg og kalenderen som ikke er fast er samme problem.
Det er forsøkt lappet mange ganger uten å løse seg.

- [x] **Finn årsaken før du fikser.** Årsaken var ikke rammene — flex-kjeden
  og rullesonene var allerede riktige etter de tretten forsøkene, og det er
  én rullesone per skjerm. Høyden ble regnet nedenfra og opp: hvert element
  som burde vært en fast ramme brukte `min-height` (et gulv, ikke en høyde),
  og listene inni ble rendret uten tak.
- [x] Dashbordet står fast fra «dagens økt» og ned. Fire kilder fikset:
  Ukelinje regnet høyde fra antall overlappende økter, Forrigelogg viste
  fritekst uten lengdegrense, «Neste økter» dukket opp og forsvant, og
  paddingen i App.tsx var ulik med og uten sidepanel. Årsoversikten henter
  nå alle fire tallene samlet — én reflow ved åpning i stedet for fire.
- [x] Kalenderen har fast cellehøyde, regnet ut fra bredden på
  månedskortene i stedet for en hardkodet verdi. Økter som ikke får plass
  vises som «+n til» som kan klikkes.

## 2. Billige fikser

Hver av disse er under en time og fjerner daglig friksjon.

- [x] Riktig timetelling per fag. Feilen var at økter datert utenfor
  skoleåret ble talt med — to SAM3045-økter i august ga faget 126 timer
  der 120 hører til året. Rettet i alle tre stedene som regner timer.
- [x] Batch-slett økter. Avkrysning per rad, «merk alle», handlingslinje
  med antall og sum timer.
- [x] Batch-slett elever. Bekreftelsen teller opp skåringer,
  vurderingsresultater og oppfølging for hele utvalget, på tvers av år.
- [x] Høyreklikk på økt: rediger, slett. Kontekstmenyen er en
  felleskomponent, så elevtabellen og kalenderen kan bruke den senere.
- [x] Lim inn liste i formatet `navn; klasse`. Var allerede bygget hele
  veien — parser, forhåndsvisning og import. La til test på det siste
  leddet, som manglet dekning.
- [x] Kopier-knapp til Teams. Kopierer øktas elevrettede tekst: fagkode,
  når, tema og agenda. Plan og øktlogg går aldri ut, som i §8.1.
- [x] Generell hendelse i skoleruta med egen tag. Trengte ingen migrasjon —
  `fridag.type` er TEXT uten CHECK, så det holdt med en fjerde verdi.
- [ ] **Knytt en vurdering til økta den ble holdt i.** `vurdering.okt_id`
  finnes og leses av øktlistas Vurdering-kolonne, men ingenting skriver
  den — alle vurderinger i basen har den tom. I dag virker koblingen bare
  implisitt, ved at fristen tilfeldigvis er samme dato som økta. Trengs
  for «prøve i en vanlig time».

## 3. Mentorelever — grunnmur ✱ ferdig

Låste opp Samtaletrekkeren. Klassekart bygges standalone først, og
integreres senere.

- [x] Mentorgruppe som undergruppe av en klasse. Flagg på elev_klasse
  (migrasjon 010), så gruppa følger skoleåret av seg selv.
- [x] Elever kan legges inn som mentorelever uten å være i noe fag.
  Gjennomgangen viste at bare importen faktisk stoppet — elevoversikt,
  filtre, elevside og duplikatgjenkjenning håndterte dem allerede.
- [x] Kontaktmøte med mentorelev: dekkes av møteloggen under.
- [x] Bygg §4.7 møtelogg (migrasjon 011). elev.notat migrert inn som
      første rad, datert elev.endret. Migreringen skriver før den
      tømmer, og tømmer bare det som faktisk ble kopiert.
- [x] Rydd §3.5 og §5.4. §3.5 beskriver nå elevnotat, §5.4 er fjernet.
      Tabellen oppfolging står igjen tom og uten kallsteder — kan
      slippes i en senere migrasjon når møteloggen har vært i bruk.
- [x] Elevpanelet er redigerbart: navn, klasse, mentorelev og fag.
      Heatmap, vurderingsresultater og elevkode er bevisst lesevisning —
      de føres der de hører hjemme.
- [x] «+ Legg til elev» tar alle feltene i én operasjon, og lagrer ikke
      før både fornavn og etternavn er fylt.

## 4. Store funksjoner

Tas én om gangen, etter at 0–3 er gjort.

- [x] **Samtaletrekkeren.** Bygget i seks deler, §4.10. Migrasjon 012,
  datalag med 79 tester, egen fane pluss inngang fra muntlige
  vurderinger. Gjenstår: å vise hvilken oppgave eleven fikk under
  vurderingen — samtaledagen kobles ikke til vurderingen ennå.
- [ ] **Klassekart.** Bygges standalone først, integreres senere.
  Spec-seksjon før integrasjonen. Rom må kunne lages enkelt, ellers
  blir den ubrukt
- [ ] Ukesvisning av økter
- [ ] AND/OR i filtrering av elever, for å finne hvem som har flere like fag

## Ikke nå

Ting som er vurdert og lagt bort med vilje. Står her så de ikke dukker opp
igjen som nye ideer.

- Fagpresets fra Udirs Grep-API — `hent_grep.py` finnes, men hører til etter v1
- Synk mellom maskiner
- Distribusjon utenfor egen maskin

---

## Arbeidsmåte

**Én ting om gangen, og commit hver av dem.** Loggen viser at det blir
lettere å se hva som faktisk er gjort.

**Claude Code skriver ikke i SPEC.md.** Den foreslår, du bestemmer. STATUS.md
og denne fila kan den oppdatere fritt.

**Store funksjoner får spec-seksjon før kode.** Det er der uenighet er billig
å oppdage.
