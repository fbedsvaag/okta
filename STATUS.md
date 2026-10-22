# Status

Pr. 2026-10-20, versjon 0.4.0 (utgitt 20.10). Beskriver hvor appen faktisk står, ikke hva
den skal bli. Fila eies fritt, i motsetning til SPEC.md.

**769 tester i `npm test` og 25 i `cargo test`, alle grønne på Mac.
`tsc --noEmit` er ren. `npm run build` går gjennom. 29 migrasjoner.** Testene kjører på GitHub ved hver push (`tester.yml`, Mac).

Utseendet står i `DESIGN.md`, som beskriver appen slik den er bygget.
Lerretet (`docs/lerret/`) er fasit for det som er tegnet.

## Mentorsamtaler i ny stil (22.10, ARBEIDSLISTE 29.6)

- Mentorsamtalene er **runder** («Mentorsamtaler høst», «Oppstartssamtaler»)
  og åpnes i et ark: Planlegg · Gjennomfør · Oppsummering
  (`skjermer/mentor/MentorArk.tsx`). «+ Ny → Mentorsamtaler» lager en ny
  runde. Ingen karakter.
- Planlegg bruker samme generator og tidsplanliste som muntlig
  (`skjermer/tidsplan/`), og har samtaleguiden for runden.
- Gjennomfør: guiden krysses av, notat (samme editor; elevnotat med
  samtalens id, så det står i møteloggen), «Fra forrige samtale» og «Til
  neste gang» (mål som krysses av), «Trives med · vil sitte med» (lagres som
  elevønske), «med foresatt / eleven alene», og en liten oversikt (fravær,
  innsats, ikke levert).
- Migrasjon 036: `samtalerunde`, `samtalemal`, `samtale.med_foresatt` og
  `guide_stilt`. Mentordager som fantes, er samlet i én runde per skoleår.
- **Personvern:** notatene fra mentorsamtalene er tatt ut av arkivet og
  «Eksporter elevens data» (de var med før). Møteloggnotater skrevet på
  elevkortet er fortsatt med. `personvern.test.ts` sjekker arkivet,
  elevfila og oppsettfila med hemmelige merker, og at ingen utgang leser
  ønsker, mål, relasjoner eller samtalenotater. Kalenderen har bare fornavn
  og klokkeslett, som før.
- Den gamle samtaletrekkeren brukes fortsatt for faglige trekninger uten
  vurdering. Sidemenyen har den ikke lenger.

## Føring av skriftlig prøve og innlevering (22.10, ARBEIDSLISTE 29.5)

- Alle vurderinger som ikke er muntlige, åpnes i føringsarket
  (`skjermer/foring/ForingArk.tsx`): Én og én · Tabell · Oppsett.
- Én og én: elevlista alfabetisk til venstre (↑↓), Levert · Ikke levert ·
  Borte, kriterier eller rubrikk (samme `Rubrikkvelger` som muntlig), kort
  kommentar med faste fraser per vurdering, karakter med tast, ⌘↵ neste.
  En karakter setter «levert» når ingenting annet er satt.
- Borte hentes fra fraværet («ikke i økta») i øktene vurderingen ligger i.
- Tabell: skriv karakteren, Enter til neste; en kolonne limt inn fra Excel
  fylles nedover. «Kopier til Teams» gir karakter og kommentar per elev.
- Oppsett: vurderingens felter (tidligere vurderingspanelet, nå
  `Vurderingsfelter.tsx`), «Slik vurderer du» og sletting.
- Migrasjon 035: `vurdering.fraser`, `vurderingsresultat.leveranse` (med
  `levert` i takt).

## Muntlig vurdering (22.10, ARBEIDSLISTE 28.1–28.5)

- En muntlig vurdering åpnes i et bredt ark: Planlegg · Gjennomfør ·
  Resultater, med tidsplanen til venstre (`skjermer/muntlig/`).
- Tidsplanen er samtaledager med vurderingens id. Utleggingen er
  samtaletrekkerens `leggUtDagen`; elevene fordeles jevnt på dagene
  (`data/tidsplan.ts`). Dra i ⋮⋮ bruker `ui/dra.ts`. En trekning som er
  laget i samtaletrekkeren før, vises her med sine egne minutter og pause.
- Migrasjon 034: rubrikk, vurderingsform, minutter, pause og trekkvalg på
  vurderingen; rubrikkvalg og stilte spørsmål på resultatet; tabellene
  `oppgavekort` og `rubrikkmal`. Testet på en base med data, og med
  `VACUUM INTO` som sikkerhetskopien bruker.
- Rubrikkmaler i Innstillinger → Skalaer, i oppsettfila (`rubrikker`) og i
  «Hent fra i fjor» (sammen med oppgavekortene).
- Notatet under samtalen er resultatets kommentar (Markdown, §29.1).
- Ikke gjort: økt-kobling for dagene (den gamle trekkeren har den), og
  gruppesamtaler i muntlig.

## Vurderinger og samtaler som én fane (22.10, ARBEIDSLISTE 28.0)

- Sidemenyen har «Vurderinger og samtaler» (G V; G S går samme sted).
  Samtaler er borte som eget punkt, og trekningene står ikke lenger som
  undermeny. Den gamle samtaleoversikten er fjernet.
- Oversikten grupperer vurderinger og trekninger etter status: Nå ·
  Kommende · Til føring · Ferdig (`data/vurderingsoversikt.ts`, testet).
  En muntlig vurdering med tidsplan er én rad. «Pågår · navn er inne»
  følger klokka.
- Filtre for type (Alle · Skriftlig · Muntlig · Innlevering ·
  Mentorsamtaler) og fagbrikker (flervalg), begge huskes.
- «+ Ny ⌄»: Skriftlig prøve, Muntlig vurdering, Innlevering, og under en
  strek Mentorsamtaler (åpner samtaletrekkeren). Innlevering er en ny
  vurderingstype (ingen migrering, typen er fri tekst).
- Mentorsamtaler vises bare når du har mentorelever.
- Klikk åpner vurderingsarket eller samtaletrekkeren, til §28.1 gir
  muntlig sine egne faner.

## Klassekartet på et blikk i økta (22.10, ARBEIDSLISTE §27)

- «Klassekart K» i økta åpner et kort over økta (`OktKlassekart.tsx`,
  `data/oktkart.ts`): plasseringen som gjaldt dagen, fra kateteret som
  standard (huskes per kart), borte overstreket, tallene øverst, Farge:
  Ingen · Dagens skår · Grupper. Klikk en elev finner raden. Esc lukker
  kortet før økta (Arkstabel venter på `[data-esc-forst]`). K virker ikke i
  felt (testet).

## Ønsker, avtaler og Klassen (22.10, ARBEIDSLISTE 26.7–26.13)

- Migrering 033: `elevonske` og `neste_sammen` (`data/onsker.ts`).
- Elevkortet › Samarbeid: «Trives med», «Nevnt av andre», «Ta hensyn når jeg
  stokker» (myk regel), «Neste gang skal … sitte med» (hard regel, brukt ved
  lagring), ★ og 📌 i ringen.
- Plasser og grupper: «📌 N avtaler for neste gang» med «hopp over én gang».
- Fagsiden › Klassen: relasjonskart med kraftsimulering (`data/relasjoner.ts`),
  filtre, krefter, zoom rundt pekeren, hover med elevbildet, panelet.
- Testet at ingen eksportmodul leser ønsker, avtaler eller relasjonskartet.
- 17.3: 36 fagfarger i seks familier (`FAGFARGER` i `ui/farger.ts`), velger
  med brukte farger dempet, «Egen farge» som avviser trafikklysfargene, i
  fagoppsettet, Innstillinger › Fag og ved nytt fag (første ledige farge).

## Etter testing 21.10 kveld

- Klassekart: færre elever enn plasser gir pultene nærmest tavla og ingen
  alene (`velgPlasser`). Rommet fyller vinduet uten rulling; dør og vinduer
  langt unna gir ikke tom luft.
- Perioder får nytt navn i Året (klikk navnet), på tavla (kolonnehodet) og i
  Økter (blyant ved hover, eller dobbeltklikk).
- Makkerpar (`makkere`): ved et firerbord er de to som sitter ved siden av
  hverandre langs bordet makkere, også når bordet er rotert. Gjelder
  «Unngå dem som har sittet sammen», «Sitter ved» og Sidemann i Samarbeid;
  «Hold fra hverandre» og «Bland» gjelder hele bordet. Samarbeid tar nå med
  alle kart (også klasse og mentorgruppe), ikke bare fag.
- Universell angring (⌘Z og knappen ved pilene): databaselaget husker
  radene før hver skriving, så alt som lagres kan angres. Tette skrivinger
  er én handling. Testet i `src/db/angring.test.ts`.
- Klassekartet sier hvem parene er («Fredrik D. og Gustav G.»); klikk lyser
  dem opp i kartet.
- Vurderinger: fag-brikker med flervalg som i Økter, «Måned · Fag», og
  overskrifter uten grå blokk.

## Plasser og grupper (21.10, ARBEIDSLISTE §25)

- 25.12: skjult kart per kilde for grupper uten rom; `kart_plassfarge`
  (migrering 032).
- 25.1–25.2: «Plasser og grupper» (G P), fanene Klassekart · Grupper.
- 25.3–25.7: Grupper-fanen med klasse/fag som chip, Antall | Per gruppe,
  «Bare de som er her» (`hentBorteIDag`), FLIP ved stokking, «Lagrede
  grupper» med valgt klasse øverst og de andre under.
- 25.8: Klassekart-fanen med kort per kart (plasskisse) og rom som chips.
- 25.11: «Farge på pultene: Ingen · Innsats · Grupper», pensel og viskelær,
  «To og to par» / «Hvert bord sin gruppe» (`data/pultfarger.ts`), gruppene
  med navn, «Bruk som gruppesett». Fargene i SVG/PNG/utskrift, aldri innsats.
- 25.9: «Bilde til elevene» (PNG 1920 × 1080) fra Grupper-fanen og fra
  kartets Del-meny med pultfarger. `data/gruppebilde.ts` får bare nummer,
  farge og navn; testet uten trafikklysfarger.
- 25.10: Kopier til Teams som tabell (`gruppeTeams`, text/html + text/plain),
  med feltet «Kopiert som tabell» og navnevalget under knappen. Den gamle
  tekstlista `gruppeListe` er borte.
- §26: «Samarbeid» på elevkortet (bryter Oversikt · Samarbeid), per fag:
  ringdiagram, Begge · Grupper · Sidemann, «Har aldri vært sammen med» og
  «Sett sammen neste gang» (myk regel `sammen` i `fordelGrupper`, tømmes når
  et sett lagres), detaljer per par og «Oftest sammen». `data/samarbeid.ts`
  regner fra historikken; testet at ingen eksportmodul bruker det.
- Retning: fra kateteret står tavla nederst, fra elevene øverst.

## Klassekart fra øktkortet (21.10)

- «Klassekart →» i toppen av øktkortet når faget har et kart. Åpner
  plassene «Fra kateteret» uten å endre kartets lagrede visning.
- Et kart gjelder til et nytt er brukt. Fra en eldre økt vises plasseringen
  som gjaldt den dagen (`gjeldendeOppsett`), låst, med «Slik satt de …» og
  «Vis gjeldende kart». Var kartet ikke brukt ennå, sies det.

## Lagrede gruppesett og gruppelogg (21.10)

- Navn på gruppesettet i verktøylinja; «Bruk» lagrer det med navnet.
  «Tidligere (N)» åpner, og × sletter. Ny tabell `oppsett` (migrering 031);
  gamle oppsett er flyttet over uten navn.
- Elevkortet: «I gruppe med» under Klassekart, oftest først, med antall.
- Navnet glir rolig ned på plassen sin når eleven slippes (280 ms).
- Elevkortet viser vurderingene i grått, ikke gull.

## Grupper: se flyttingen før du slipper (21.10)

- Mens en elev dras, vokser gruppa pekeren er over (plass nederst, kant i
  gruppefargen, tallet oppdatert), og raden glir ut av gruppa den kom fra.

## Øktplanen holder seg innenfor økta (21.10)

- Øktas lengde er et tak. Vokser et punkt forbi luften, tas tiden fra den
  lengste andre aktiviteten (`begrens` i `data/oktplan.ts`, testet), både
  med − / +, lengdevalget, nye punkter og draing i tidslinja.

## Skoleåret som tavle (21.10, ARBEIDSLISTE 21.1)

- Bryteren Tidslinje · Tavle i Året (huskes). Én kolonne per periode, kort
  per økt, tema skrives rett inn. Kort på kort bytter (som Økter-lista),
  mål og vurdering følger (fristen også). Kort i nabokolonnen får perioden,
  med de grå øktene imellom. − økt / + økt
  flytter grensen. Testet i `tavle.test.ts`.

## Kalender og fagvalg (21.10)

- Kalenderstrømmen (lokal iCal-adresse på 127.0.0.1) er fjernet, med den
  lille webserveren i Rust. Kalender betyr nå bare CalDAV (§8.1). Et gammelt
  abonnement i Apple Kalender slutter å oppdatere seg og kan slettes der.
- Et fag i sidemenyen (og ⌘1–9) åpner alltid fagets Oversikt.
- Valglinja i Elever har «Mentorelever» / «Ikke mentorelever» for alle valgte.

## Utkast for vurderinger (21.10, ARBEIDSLISTE §24)

- Vurderinger fra «Hent fra i fjor» er utkast til de er bekreftet: dempet i
  Året, Økter og Vurderinger, ikke blant fristene i I dag. Migrering 030.

## Innstillinger, det som ventet (21.10, ARBEIDSLISTE 23.9)

- Skole under Deg, i toppen av årsplanen.
- Personvern: bryter for elevbilder, slett alle bilder, slett en elev helt,
  slett elevene fra et tidligere år (`slettEleverIAr`, testet).
- Om Økta: «Se etter oppdatering» åpner GitHub i nettleseren, ingen nettkall.
- Ferier legges til og fjernes på Skoleår-siden.
- Klassekart-eksporten (PNG, utklipp, liste) er sjekket: bare fornavn og
  forbokstav, aldri innsatsfarge, kjønn eller bilde. Testen er strammet inn.

## Egne karakterskalaer (21.10, ARBEIDSLISTE §22)

`innstillinger/Skalaer.tsx` og `data/skalaer.ts`. Innebygde skalaer er låst
med «Kopier og endre»; egne under. Maler: egen liste, karakter med + og −,
poeng 0–maks, kopi av en skala. Redigering av navn, bruk (vurdering/skåring/
begge) og verdier (kode, forklaring, farge, bestått, teller ikke), ⋮⋮ for
rekkefølge (= rang), ↵ i siste felt gir ny rad. Taster 1–9 bare med høyst ni
verdier (`taster` i `skala.ts`); over det skrives koden og ↵ i
vurderingsføringen. Forhåndsvisning med chips; verdier uten farge er grå.
Brukte verdier kan ikke slettes, en brukt skala kan ikke slettes (testet).
Fagets skåringsskala velges i fagpanelet. Migrasjon 029: stempler og
`slettet` på `skalaverdi` (manglet). 29 migrasjoner.

## Innstillinger, ny modell (21.10, ARBEIDSLISTE §23)

`Innstillinger.tsx` med `innstillinger/sok.ts` (søkeindeks) og
`innstillinger/byggeklosser.tsx` (Side, Gruppe, Rad, Vippebryter). Undermeny
med ikoner i gruppene Deg · Daglig bruk · Trygghet · Utenfor Økta · Om Økta;
markøren glir 360 ms uten sprett. Søket i verktøylinja hopper til raden og
blinker den. Kalenderstrøm og kalenderserver er slått sammen til Kalender;
Arkiv ligger under Sikkerhetskopi. Nye sider: Deg (navn, «Jeg er mentor» og
klasse, som gjør klassens elever til mentorelever), Fag (farge inline med
brukte farger dempet), Om Økta. Skoleår har «Start 2027/28 … Forbered»
(lager neste år med samme fag, ikke aktivt) og Andre år. Gamle side-id-er
virker fortsatt (`GAMLE`). Ikke bygget: se 23.9.

## Runde 20 (21.10, ARBEIDSLISTE §20)

- **20.3 Én skårprikk** (`ui/Skarprikk.tsx`): rød, gul, grønn, 0 = ikke i
  økta (mørk med kryss), ikke sett (tom ring), uten farge og kommer. Rund
  eller firkant. Brukt i skåringen, filteret og «Borte sist» i økta,
  heatmapet og notatene i elevkortet, Elever-lista, fagoversikten, «Følg
  opp i økta», «Elever som glipper» og tegnforklaringen i «Innsats over
  tid». Heatmapet i elevkortet viste ikke skåret som «ikke i økta»; nå
  «ikke sett» (19.4 hadde glemt det).
- **20.1 Trafikklys med form** (i `Skarprikk`): grønn fylt, gul halvfylt
  (ring og nederste halvdel), rød med lite kryss, 0 med større kryss på
  mørk grunn. Gjelder alle stedene over.
- **20.2 Farge betyr data.** Fagmerket er en nøytral brikke med firkant;
  blokkene i Uka (I dag) og i kalenderen er nøytrale med firkant;
  periodebrikker og periodefiltre er nøytrale med prikk; stolpene i
  Timeregnskap og periodestolpene på fagsiden er grå; fagbryterne er
  nøytrale med firkant. Fagknappene i fagvelgeren likeså. Ikke rørt:
  klassekartet og periodelinja i økta (utenfor 20.2).
- **20.4 Tastestripa tones ned** etter 25 tastetrykk utenfor felt (telles
  per stripe i `innstilling`, `tastestripe:skaring|planlegging|titt`).
  Helt synlig mens ⌘ holdes og når musa er over.
- **20.6 Skoleåret** (`skjermer/Aret.tsx`, `data/aret.ts`): ny fane «Året»
  mellom Oversikt og Økter. Stripa er øktene i faget, med ferier skravert på
  ukedagene faget har; måneder, «I dag» og vurderingsmerker. Perioden står
  fortsatt på økta (SPEC §3.3, ingen skjemaendring): å dra en periode, en
  ende eller over et tomt felt setter `okt.periode_id` på øktene i spennet
  i én transaksjon, og `start`/`slutt` følger. Ingen overlapp: en ende
  skyver grensen mot naboen (som beholder minst én økt), hele perioden
  stopper mot naboene. Boble med spenn og antall mens man drar; angres med
  ⌘Z. Uplasserte perioder dras inn fra lista (8 økter). Periodekortet viser
  spenn, vurderinger og målnumre; ▸ folder ut øktene med tema (↵/↓, ↑).
  Kompetansemål knyttes med en periode valgt; uten valg «✓ Dekket» med
  prikker eller «Ikke dekket». «Gi N økter perioden» fyller hull. Ikke
  bygget: bryteren Tidslinje · Tavle (21.1), «Skriv ut årsplan» her.
- **20.7 Fjorårets år som mal** (`data/mal.ts`, `skjermer/Malark.tsx`):
  «Hent fra i fjor …» i Året når faget fantes året før, og et tilbud øverst
  i Året når faget ikke har perioder i år. Periodene legges på de samme
  ukene regnet fra skoleårets første uke; dialogen viser datoene i fjor og
  i år og antall økter (+/−). Valg: perioder, kompetansemål, tema, plan og
  agenda (bare der årets økt er tom), vurderinger på nærmeste økt.
  Erstatter årets perioder (soft delete) i én transaksjon, og angres med
  ⌘Z. Vurderingene blir vanlige vurderinger: det finnes ingen
  utkast-status (ville krevd en ny kolonne). Tilbudet kommer i Året, ikke
  i selve dialogen for nytt skoleår: der finnes ingen økter ennå.
- **20.5 I dag: Enkel og Full** (`IDag.tsx`, lerretet IDagOppsett).
  Bryteren øverst til høyre, valget huskes (`idag_oppsett`, standard
  Enkel). Rutenett med fire kolonner og faste rader som i tegningen, uten
  hull. Enkel: Dagens økter, Følg opp i dag, Gjøremål. Full: i tillegg Uka
  (Timer · Kompakt, huskes i `idag_uka`; Kompakt er én rad og flisene under
  glir opp), Vurderingsfrister, Elever som glipper og Innsats over tid
  (andel grønn/gul/rød/ikke sett av dem som var til stede, per fag). «Følg
  opp i dag» grupperer Rød sist (to på rad), Ikke sett sist og Borte sist
  per fag du har i dag (`folgOppIDag`). Flisene glir rolig ved bytte
  (`ui/useGlid.ts`, 360 ms, ingen sprett). Timeregnskap og «Innsats uke for
  uke» (den gamle grafen) står under rutenettet i Full, siden tegningen ikke
  har dem. Tilpass og størrelser venter (§21.2).

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
  tones ned der det står. Plassen du kom fra er et vindu inn i et bånd med
  alle øktene, som ruller i takt med draget (rulletekst, myke kanter), så
  det aldri blinker. Ingenting annet reiser (det spratt for mye). Ved
  slipp lander innholdet der det svevde, og byttet vises med en gang mens
  lagringen går i bakgrunnen. Ingen bytte før midten har forlatt egen rad
  (`finnMal`). Rødt kort over en skåret økt. Kolonnehodet er tett, ikke
  glass: brikkene skinte gjennom som klatter.
- **Tema i Økter endres med dobbeltklikk (21.10)**, eller T på markøren.
  Ellers er temaet vanlig tekst som raden kan dras i uten at noe markeres.
  Enter lagrer og går til neste rads tema (⇧↵ forrige), Esc avbryter.
  Dobbeltklikk ellers på raden og Enter åpner økta som før.
- **Ingen tekstmarkering i appen (21.10)**, som en vanlig Mac-app: bare
  felter du skriver i og notater/logger vist som tekst (`.kan-markeres`)
  kan markeres. Før kunne en markering som startet utenfor Økter-lista
  dra med seg månedsoverskriftene.
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
