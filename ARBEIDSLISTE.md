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
- [x] **Knytt en vurdering til økta den ble holdt i.** Gjort 30.09:
  automatisk på fristdagen, for hånd fra begge panelene, migrasjon 015.
  Opprinnelig punkt: `vurdering.okt_id`
  finnes og leses av øktlistas Vurdering-kolonne, men ingenting skriver
  den — alle vurderinger i basen har den tom. I dag virker koblingen bare
  implisitt, ved at fristen tilfeldigvis er samme dato som økta. Trengs
  for «prøve i en vanlig time». MERK at muntlige vurderinger nå er
  dekket på en annen måte, gjennom `samtaledag.vurdering_id`.

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

Tas én om gangen, etter at 0–3 er gjort. Rekkefølgen under er eierens
prioritering fra 30.09.

- [x] **Utskrift og eksport av årsplan.** Utskriften kuttet alt etter første
  side. Nå: ett fag per ark, med kompetansemål, faglærer, rom, timeregnskap,
  fritekst, og uke/dato/tema/lekse/vurdering. PDF, Word, markdown og CSV.
- [x] **Vurdering over flere økter, og trekkeren i øktene.** Gjort 30.09.
  Trekkeren fordeler elevene på avkryssede økter i faget.
- [x] **`⌘K` — søk på elev og økt.** Gjort 30.09, med alias på fag.

- [ ] **Visuell oppstramming.** Steg 1 gjort 21.09. Steg 2 påbegynt 30.09:
  DESIGN.md skrevet om, menyen på én rad, Elever bruker bredden og navn
  brekker ikke, uka på forsiden er en kalender med bla, Fag har samme
  bredde som resten. Gjenstår: Vurderinger og Innstillinger med ekte data,
  og det som står under «Ikke bygget ennå» i DESIGN.md. Opprinnelig: Neste: en ryddigere og
  strammere toppmeny — eieren synes det er for mange lister der. DESIGN.md
  må oppdateres til å beskrive serif-overskriftene og det som faktisk er
  valgt.
  **05.10: erstattet av §5 under.** Redesignrunden la ny retning;
  DESIGN.md er skrevet om etter den.

- [x] **Samtaletrekkeren.** Bygget i seks deler, §4.10. Migrasjon 012 og
  013, egen fane pluss inngang fra muntlige vurderinger. Notater fra
  samtalen havner i elevens møtelogg og ses begge veier. Samtaledager
  vises i kalenderen, på «I dag» og i timeregnskapet — mentorsamtaler
  som egen linje uten måltall. Gjenstår: å vise hvilken oppgave eleven
  fikk under selve vurderingen — gjort, gjennom en vurderingsvelger i
  samtaleoppsettet.
- [x] Ukesvisning av økter — tegnet 05.10, se §5.9.
- [x] **Elevbilder fra InSchool-PDF.** Bygget 30.09 (migrasjon 021), testet mot en ekte utskrift. Les den
  utskrevne klasselista (én–to sider PDF med navn og bilde) lokalt i appen:
  navnene blir klasseliste gjennom lim-inn-flyten (§7, duplikatsjekk og
  forhåndsvisning), og bildet til hver elev klippes ut og legges på
  elevkortet. Bildene gjøres sort-hvite med svak posterisering og lilla
  overlegg, i Økta-looken — kornet er en del av poenget. Vurderinger før
  bygging:
  - PDF-lesing uten nettverk: pdf.js lagt inn i appen, ikke fra CDN.
  - Hvis PDF-en har tekstlag: navn og bilder har posisjoner, og paret
    finnes ved nærhet. Hvis den er et skannet bilde: krever lokal OCR
    (tesseract, tungt) — sjekk en ekte fil først.
  - Egen tabell `elevbilde` (UUID, stempler, soft delete), bildet som BLOB
    eller fil i appmappa. Følger sikkerhetskopien.
  - Personvern: bildene går aldri ut — ikke i CalDAV, eksport eller arkiv
    (§1, §8). Sletting av elev tar bildet med.
  - Trenger en ekte (anonymisert) InSchool-utskrift å bygge mot.
- [x] AND/OR i filtrering av elever. Flere fag kan velges, med bryter
  mellom «har alle» og «minst ett».

## 5. Redesign fra lerretet (05.10)

Alt er tegnet i Claude Design-lerretet «Økta — redesign» og beskrevet i
DESIGN.md. Rekkefølgen er valgt så hvert steg kan bygges, testes og
committes alene, og så det som alt annet bygger på kommer først.

**Før du starter:** les DESIGN.md i sin helhet. (Forslaget til ny §13 er
tatt inn i SPEC.md 13.10.)

- [x] **5.1 Skrift.** Legg Geist (300/400/500/600, latin + latin-ext) i
  `public/fonts/` med OFL-lisensen, og bytt `--font-sans`. Sjekk at `tnum`
  virker. Fjern Fira, Fira Condensed og `--font-display` (Georgia).
  Overskrifter over 24 px får Light. Seksjonsoverskrifter med versaler blir
  vanlig skrift.
- [x] **5.2 Former og trafikklys.** Nye radier (4/6/10/22). Trafikklyset
  helfylt overalt (skåringsliste, heatmap, tegnforklaring) — én endring i
  `Ikon`/`farger.ts` hvis det er gjort riktig. Ny `Fagfirkant`-komponent i
  `felles.tsx`, og bytt ut alle fargestreker i venstremarg.
- [x] **5.3 Sidemeny.** Erstatt menyraden med sidemeny (DESIGN §6), med
  G-snarveier. Hovedflaten som ark med 10 px radius.
- [x] **5.4 Glass.** Fargeteppe i vinduet, glass på sidemeny, verktøylinje,
  ⌘K og kontekstmeny (DESIGN §7). Innstilling `glass` (på/av) i
  `innstilling`-tabellen, og `prefers-reduced-transparency` overstyrer.
  Mørke verdier.
- [x] **5.5 Paletter.** Seks paletter som `data-palett` på `:root`, lys og
  mørk. Velges i Utseende med forhåndsvisning. Fargeteppet følger paletten.
- [x] **5.6 I dag.** Dagens økter med tid i egen kolonne og fagfirkant på
  linje med tittelen. Notat fra forrige økt sammenleggbart. Fjern setningen
  over. Valget om sammenlagt huskes som de andre bolkene.
- [x] **5.7 Skåring.** Fjern symbol+tekst-kolonnen. Notat fra denne økta i
  egen kolonne på raden; N åpner feltet i raden. Plottet viser valgt verdi
  i full styrke. Raden holder 28 px.
- [x] **5.8 Økter og perioder.** Fjern periodevisningen og pensel/viskelær.
  Perioden blir merkelapp på raden, radene fargelegges ikke. Periodene øverst
  blir filtre. Marker rader + P setter periode. Sjekk
  `periode-fargelegg.test.ts` — testene for pensel kan gå, logikken for å
  sette periode på mange økter skal bestå.
- [x] **5.9 Kalender.** Måned: helligdager som egen type i `fridag.type`
  (`helligdag`, ingen migrasjon trengs — kolonnen har ingen CHECK) med egen
  tone, og årsheatmap i høyre kolonne. Uke: ny visning med heldagsrad,
  valgt-økt-panel og timer per fag.
- [x] **5.10 Elevkort.** Notater og møtelogg som tidslinje (gjenbruk
  `ui/Tidslinje.tsx` fra fagkortet).
- [x] **5.11 Innstillinger.** Venstremeny med grupper. Generelt får
  tekststørrelse (Mindre / Vanlig / Større → `--tekst-skala`). Utseende får
  glass og paletter. Del oppsett kommer i 5.13.
- [x] **5.12 Oppsettveiviser.** Fire steg + Ferdig, større tekst,
  «Fortsett senere», duplikatspørsmål med angre. Første steg har plass til
  oppsettfil, men knappen kan vente til 5.13.
- [ ] **5.13 Oppsettfil.** Spec og oppskrift i `docs/oppsettfil.md`.
  Spec-teksten må godkjennes inn i SPEC.md før koden skrives.
- [x] **5.14 Logo — Bolk med glass** (valgt 05.10). Kildene ligger i
  `src/assets/logo-glass.svg` (mørk, appikon), `logo-glass-lys.svg` og
  `logo-glass-tonet.svg`. Erstatt `logo.svg` og `logo-lys.svg` med dem.
  Oppdater `Merke` i `src/ui/logo.tsx` til de nye formene (plate x/y 40,
  rx 215; felt rx 44/40; lys variant har felt i aksenten) — glasskantene
  kan droppes under 32 px, der de bare blir grums. `scripts/lag-ikoner.mjs`
  må lære gjennomsiktighet og kantlinje for å tegne glasset; alternativt
  tegnes bare plate og felt der, uten glass. Kjør skriptet og sjekk
  ikonet i Dock. Kommentaren i `logo.tsx` om fargestreken i venstremarg er
  utdatert — feltene finnes igjen i fagfirkanten og heatmapet.
- [x] **5.15 Samtaletrekkeren.** Samme oppbygning som før (§4.10), strammet
  opp etter DESIGN §10: planlagte trekninger i sidemenyen, eksport i
  verktøylinja, oppsettet i én kolonne med blokker (modus, vurdering,
  samtalene, temaer, samtaledager med kapasitet, historikk, Generer + låser),
  kapasitetsvarsel som navngir hvem som mangler plass, og timeplanen med
  dagen i Light-overskrift. Oppgavenummer som liten rute i temafargen.
  «Møtte ikke» og lås som ikonknapper på raden.

## 6. Avvik etter §5 (06.10)

Det som står igjen fra DESIGN.md etter redesignet. Listet i STATUS.md
05.10. Samme arbeidsmåte: ett punkt, test, commit.

- [ ] **6.1 Verktøylinja på alle skjermene.** Bruk `ui/Verktoylinje.tsx`
  overalt, slik samtaletrekkeren gjør: skjermnavn til venstre, skjermens
  egne knapper til høyre, i glasskapselen. Ingen verktøylinje inni arket.
- [ ] **6.2 Skåringsskjermens høyre kolonne.** Forrige økt, plan, øktlogg
  og taster i en kolonne til høyre for elevlista (DESIGN §10), i stedet for
  feltene øverst i kortet. Lista holder fortsatt 28 px.
- [ ] **6.3 Innstillinger: resten som rader.** Skoleår, Skalaer,
  Sikkerhetskopi, Personvern, Del oppsett og de tre sjeldne sidene får
  samme radoppsett som Generelt og Utseende: etikett til venstre, kontroll
  og hjelpetekst til høyre. Sikkerhetskopi får den grønne statusboksen.
- [ ] **6.4 Samtaledager i ukevisningen.** Som timeplan i dagkolonna:
  elevene med klokkeslett, pause og lunsj, «+ n til» når det ikke får
  plass. Heldagsraden beholder bare vurderingen.
- [ ] **6.5 Bevegelse.** Bryteren På / Dempet / Av i Utseende, med
  `prefers-reduced-motion` som utgangspunkt. Stagger og FLIP kan vente.

## 7. Fra runde 6 i lerretet (06.10)

- [ ] **7.1 Sidemeny med undermeny (A).** Fjern «Fag i år» og «Planlagte
  trekninger» som faste bolker. Fagene blir undermeny under Økter (⌘0–9),
  trekningene under Samtaler. Åpen under aktiv skjerm, ruller ut ved hover
  ellers (DESIGN §6). Tynn strek foran, innrykk på markeringen.
- [ ] **7.2 Samtaler-oversikt.** Klikk på «Samtaler» gir en side med
  Planlagt · Utkast · Gjennomført: fag, datoer, plasser/elever, status.
- [ ] **7.3 Øktlista.** Kolonnene Uke · Dato · Tid · Tema · Periode ·
  Vurdering. Mellomrom (eller klikk) folder ut en rask titt under raden.
  Utseendet er erstattet av **9.1** (variant F).
- [ ] **7.4 Rediger i verktøylinja.** «Rediger fag» i Økter når et fag er
  valgt, «Rediger» på en trekning i Samtaler.
- [ ] **7.5 I dag.** Romnummer under hver økt i uka, i liten grå skrift.
  «↵ åpne økta» som hint på dagens økter.
- [ ] **7.6 Elevbilder overalt** der elevnavn står (DESIGN §6). Felles
  komponent med bilde eller plassholder i fast størrelse, så radhøyden aldri
  endres. Plassholderen er erstattet av **9.7** (illustrasjon, ikke initialer).

## 8. Klassekart og gruppegenerator (06.10)

Spec i SPEC §4.11, oppskrift i `docs/klassekart.md` del B. Tegnet i
lerretet runde 7; markupen ligger i `docs/lerret/`. Bygges i én bolk, men
ett steg og én commit om gangen.

- [ ] **8.1 Data** — migrasjon 024, `data/klassekart.ts`, tester.
- [ ] **8.2 Kjønn på eleven** — valgfritt felt, aldri i eksport. Gjettes ved
  import (9.8), velges på elevkortet.
- [ ] **8.3 Fordelingen** — `data/fordeling.ts`, ren funksjon med frø, tester.
- [ ] **8.4 Rom-editoren** — maler, dra inn, rutenett, roter/dupliser/slett.
- [ ] **8.5 Plasser** — lås, dra, ikke til stede, panelet, Stokk, Bruk, og
  Del-menyen: Skriv ut (⌘P), Lagre som PDF, Kopier som bilde (PNG, ⌘C),
  Lagre som PNG, Kopier som liste. Personvernlinja nederst i menyen.
- [ ] **8.6 Grupper** — antall, kort, dra, navn, Stokk, Teams, utskrift.
- [ ] **8.7 Sidemeny og oversikt** — Klassekart (G K) med kartene som undermeny.

## 9. Fra runde 8–10 i lerretet (06.10)

Tegnet i lerretet (`docs/lerret/`: `Utfolding`, `MenyA`, `Main`, `OktArk`,
`Import`). DESIGN.md §6, §7 og §10 er oppdatert. Ett punkt og én commit om
gangen, i denne rekkefølgen.

- [ ] **9.1 Utfoldet økt = variant F.** To spalter: Dato · Tid · Rom ·
  Vurdering til venstre, Plan og Fra forrige økt til høyre. Nederst en
  tonet stripe (#ece9f3) med «↑↓ neste økt · mellomrom lukk · Åpne økta ↵»
  samlet til høyre. Raden og feltet henger sammen (radius 8 8 0 0 / 0 0 8 8).
- [ ] **9.2 Vurderinger i øktlista.** Økt med vurdering får et ikon på
  16 × 16 i gull (#c9922e) foran tittelen: snakkeboble = muntlig,
  blyant = skriftlig (egne SVG-er, ikke emoji). Ikonet henger ut i
  mellomrommet foran Tema-kolonnen, så alle titler starter på samme linje.
  Gyllen strek (inset 3 px) til venstre på raden og feltet, svak gylden
  grunn (#fdf8ee) på lukkede rader, tittel i 600. Vurderingskolonnen viser
  bare typen («Muntlig», «Skriftlig»), ikke temaet. I feltet:
  «Vurdering — Åpne i *Samtaler* →» (skjermnavn i kursiv).
- [ ] **9.3 Uka på I dag.** Tidsakse til venstre (09, 10 …; timen nærmest
  nå skjules). Nå-strek: tykk lilla med prikk i dagens kolonne, tynn over
  resten av uka, klokkeslettet i aksen. Tiden som har gått i dag tegnes
  med fagfargene dempet (`backdrop-filter: saturate(.35)` + svakt lyst slør),
  ikke grått. Oppdateres hvert minutt.
- [ ] **9.4 Dagens økter viser fagkoden**, ikke fagnavnet:
  «MFL2 · Rom 214 · Markedsmiks».
- [ ] **9.5 Logg under Gjøremål.** «Logg · n fullført siste 14 dager»,
  sammenleggbar. Gruppert per dag, gjennomstreket tekst, hvem/fag, klokkeslett.
  Avkrysset nå havner øverst med «Angre». Eldre står i arkivet og på
  elevkortet. Ingen ny tabell: bruker `lukket`-tidspunktet på notatet (§3.5).
- [ ] **9.6 Økta som ark.** «Åpne økta» (fra I dag, øktlista, kalenderen)
  åpner økta som et ark over skjermen du står på, ikke som full skjerm.
  Samme matte glass og inngang som notatvinduet. Esc lukker (alt lagres
  fortløpende), ⌘↵ = Ferdig. Topp: fagfirkant, kode i fagfarge, tittel i
  Light 28 px, «Pågår · n min igjen» med rolig puls (av ved redusert
  bevegelse), naturlig dato · tid · rom · periode. Over lista:
  «n av 28 skåret» med tynn fremdriftslinje. Høyre spalte: Fra forrige økt,
  Plan med avkrysning, Øktlogg. Taster i en stripe nederst (som 9.1).
  Radhøyde 38 px med 28 px bilde (bestemt av eieren 06.10). Lista ruller
  og følger markøren.
  **Bevegelse:** markøren er én flate som glir til neste elev (translateY,
  340 ms, `cubic-bezier(.34,1.32,.5,1)` — en S-kurve med lite overskudd).
  Trafikklyset som settes «popper» (skala .4 → 1.18 → 1, 380 ms,
  `cubic-bezier(.34,1.56,.64,1)`). Av ved redusert bevegelse.
- [ ] **9.7 Plassholder for elevbilde.** Uten bilde: liten illustrasjon av
  jente, gutt eller nøytral (etter `elev.kjonn`) i palettens farger
  (`--pal`, `--pal-lys`, `--pal-mid`), så den følger fargevalget i
  Utseende. Én komponent, `ui/Elevbilde.tsx`, overalt.
- [ ] **9.8 Kjønn gjettes ved import.** SSBs navnestatistikk følger appen
  som en liten lokal tabell (fornavn → andel jenter). ≥ 95 % ett kjønn =
  gjettet; ellers tomt («Velg»). Ny kolonne i forhåndsvisningen: stiplet
  pille = gjettet, fylt = bekreftet, gul «Velg» = brukes om begge. Klikk
  bytter Jente → Gutt → Ikke satt. «Bekreft alle gjettede». Elever som
  finnes fra før beholder sitt. Telling øverst («3 må velges · 8 gjettet»).
  Krever `elev.kjonn_kilde` (`gjettet` | `satt`) i migrasjon 024.
  **Navnelista:** et lite skript (`scripts/hent_navn.py`, kjøres av eieren,
  ikke av appen) henter SSBs åpne navnestatistikk (fornavn med antall
  jenter og gutter) og skriver `src/data/fornavn.json` (fornavn → andel
  jenter, bare navn med ≥ 50 bærere). Fila committes. Appen gjør ingen
  nettverkskall. **«Om» i Innstillinger** får linja «Kjønn gjettes fra
  fornavn med navnestatistikk fra Statistisk sentralbyrå (SSB), CC BY 4.0.»
- [ ] **9.10 S-kurven overalt** (DESIGN §8, lerretet `Bevegelse`):
  `--ease-sprett` som token i `ui/bevegelse.ts`; sidemeny, brytere,
  liste-markører, undermeny og Stokk på nytt (FLIP).
- [ ] **9.11 Elevkortet som ark i stabel** (lerretet `ElevArk`). Åpnes over
  økta eller lista og glir inn fra høyre; det bak skaleres litt ned.
  Identitet: bilde/plassholder 76 px, navn Light 32 px, «Mentorelev»-pille,
  år · klasse · fag med firkant, fjorårets linje i grått. **Kjønn som
  bryter** Jente | Gutt | Ikke satt; gjettet = stiplet tommel og «Gjettet fra
  fornavnet ved import. Klikk for å bekrefte.». Bekreftet kjønn skjules; det vises
  igjen bare i **redigeringsmodus** («Rediger ⌘E» i verktøylinja → «Ferdig»),
  der også navnet får stiplet strek. I år | Alle år. Over spaltene: **«Innsats gjennom året»** i
  full bredde — én linje per fag, kvadratiske ruter (8 px, radius 2),
  aug–jun på én linje, uke for uke i felles kolonner (19 px per uke) så
  fagene står under hverandre; kommende økter som tomme ruter med tynn kant,
  inneværende måned uthevet. Venstre: vurderinger per fag (med ikon; kommende muntlig med
  gyllen strek og «Åpne i *Samtaler* →»), så notater og møtelogg med filter.
  Høyre: «Åpent for <fornavn>» (oppfølginger), Klassekart (plass, sidemann,
  låst, «Kan ikke sitte med:»), fravær i år («Fraværende i 3 av 24 økter»). Personvernlinje på én linje i bunnen av arket.
  Verktøylinja: «Rediger ⌘E» og «⋯». Menyen bak ⋯: Nytt notat (N), Ny
  møtelogg (M), Legg til i fag…, Legg til bilde…, Mentorelev av/på, Bytt
  klasse…, Slå sammen med… (§4.3), Eksporter elevens data (⇧⌘E, innsyn §6),
  og i rødt: Ta ut av <fag>, Slett eleven… (spør alltid).
- [ ] **9.9 Glass på arkene:** notatvindu, samtalenotat og økta får
  `blur(22px)` i stedet for 1,5 px — teksten bak skinte gjennom.

## 10. Etter første kjøring (07.10) ✱ ferdig

Eieren har kjørt appen. Disse er feil eller mangler i det som er bygd, og
skal rettes før noe nytt. Start appen (`npm run tauri dev`) og se på hver
skjerm mot `docs/lerret/` — ikke bare tester.

- [x] **10.1 Animasjonene ved åpning.** Ark, elevkort, ⌘K og menyer
  «spretter» og skjermen blinker når de åpnes; lukking er fin. Sannsynlig
  årsak: elementet monteres i sluttilstand og animerer fra en tilstand det
  aldri hadde (eller `backdrop-filter` slås på midt i overgangen). Montér i
  starttilstand, la én frame gå (`requestAnimationFrame`), så overgang til
  slutt. Uskarpheten skal være på fra første frame, ikke tones inn.
- [x] **10.2 Valgt rad i ⌘K er nesten usynlig.** Valgt treff har hvit flate,
  men teksten blir lys grå (se skjermbilde: «Per Pålsen» i blek tekst).
  Valgt rad skal ha full tekstfarge og aksentflate `rgba(74,61,125,.12)`,
  ikke svakere enn de andre.
- [x] **10.3 Hover med glass og S-kurve.** Én markør-flate som glir (DESIGN §8,
  `--ease-sprett`, 220 ms) mellom punktene ved hover — i sidemenyen, i
  ⋯-menyer og kontekstmenyer, Del-menyen og Innstillinger-lista. Flaten er
  glass (`rgba(255,255,255,.55)`, `backdrop-filter: blur(12px) saturate(160%)`,
  lys innerkant). Den glir fra forrige punkt, ikke tones inn på hvert.
- [x] **10.4 Glass mangler flere steder.** Gå gjennom DESIGN §7 skjerm for
  skjerm: verktøylinja i alle ark, ⌘K, menyer, sidemenyen, arkene. Det som
  står som glass i DESIGN skal være glass når glass er på.
- [x] **10.5 Kjønn vises ikke.** Elevkortet viser bryteren bare når kjønn er
  gjettet eller i redigering, så elever uten kjønn (alle som fantes før 024)
  får aldri valget. Vis bryteren også når `kjonn` er tom, med teksten
  «Ikke satt — velg for at klassekartet kan blande». Lim inn: sjekk at
  kolonnen og gjettingen faktisk kjøres også for InSchool-PDF.
- [x] **10.6 Zoom.** ⌘+ og ⌘− gjør alt større og mindre, ⌘0 tilbake til 100 %
  (Tauri: `webview.setZoom`, trinn 80–90–100–110–125–150 %). Valget huskes.
  Står også i Vis-menyen.
- [x] **10.7 Økter › Kalender › Måned ruller.** Månedene står under hverandre
  i én lang liste; rulling går fram og tilbake gjennom skoleåret, og
  månedsnavnet øverst følger med. Skoleåret til høyre markerer måneden som
  er synlig, og klikk der ruller dit.

## 11. Fra runde 13 i lerretet (07.10) ✱ ferdig

Tegnet i lerretet runde 13: `Elever`, `Fagside`, `OktSkar`, `OktPlan`
(i `docs/lerret/`).

- [x] **11.1 Elever-oversikten.** Verktøylinje med søk, «Lim inn liste»,
  «Ny elev». Gruppering som bryter: Klasse | Fag | Alfabetisk. Filter-piller
  for fag og Mentorelever. Rad 46 px: bilde 30 px, **fornavn** + etternavn,
  M-merke for mentorelev, klasse, fag med fagfirkant, innsats siste 10 som
  små ruter, fravær i prosent av fagets timer med en liten stolpe mot
  10 %-grensen (høyeste fag; gul fra 7,5 %, rød over 10 %; verktøytips med
  timer), rød prikk når eleven glipper.
  Ingen avkrysningsbokser og ingen innebygd skjema nederst; redigering skjer
  i elevkortet. Glidende hover-markør (10.3). Klikk åpner elevkortet.
- [x] **11.2 Fagsiden.** Ny fane **Oversikt** i Økter når et fag er valgt:
  Oversikt | Økter | Kalender. Innhold: fagnavn (Light 32), klasser, antall
  elever, rom, tider og Udir-lenke. Kort: Timer (gjort av årstimetall,
  stolpe per periode, «i rute / bak»), Neste økter, Kommende vurderinger.
  «Klassen, økt for økt»: heatmap elever × siste 16 økter, sortert etter
  snitt (uten fraværskolonne). «Elevene nå»: Går godt / Trenger oppfølging
  (siste 6 økter) og Mye fravær. Kompetansemål: hvert mål med en ruterad
  (økter som dekker det, planlagt vs gjort) og Dekket / Påbegynt / Ikke ennå.
  Logg: øktloggene som tidslinje, med fordelingen av skåringene per økt.
- [x] **11.3 Økta har to moduser i samme ark.** Bryter øverst til høyre:
  **Skåring og logg** | **Planlegging**. Fra I dag (og når økta pågår eller
  er ferdig) åpner den i Skåring og logg; fra Økter (fram i tid) i
  Planlegging. Tidligere økter åpnes i Skåring og logg.
- [x] **11.4 Skåring: trafikklyset til venstre** for bilde og navn, så blikket
  ikke må hoppe. Rad: markør · trafikklys · bilde · navn · klasse · notat.
- [x] **11.5 Planlegging.** Dato, tid, rom, periode, vurdering (knytt til);
  lekse og agenda til elevene; Plan (sjekkliste med varighet og sum mot
  øktas lengde, dra for å flytte); **Kompetansemål i økta**: fagets mål med
  avkrysning, periodens mål markert med prikk, valgte mål i full farge.
  Høyre: fra forrige økt, «Følg opp i økta» (røde på rad, borte sist,
  åpne oppfølginger), hvor i perioden økta ligger. Tastestripe:
  ⌘← / ⌘→ forrige og neste økt, ⇥ neste felt.

- [x] **11.6 Årsplanen som PDF** (lerretet `ArsplanPdf1–3`, SPEC §4.9): egen
  utskriftsvisning, A4. Side 1: logo, «Årsplan · skoleåret …», sist
  oppdatert; fagkode i fagfarge og fagnavn Light 38 px; faglærer, rom, tid
  til høyre; timeboks «140 av 140 timer · n økter · hele timetallet i
  læreplanen er dekket» med stolpe per periode; «Om faget i år» og
  nummererte kompetansemål med «(hentet fra udir.no/lk20/<kode>)» som
  lenke. Tabell: Uke · Dag · Dato (høyrejustert) · Tema · Lekse · Vurdering;
  periodeoverskrift med prikk, uker, økter, timer og «Mål …»; vurderinger
  med gullikon i egen marg og tonet rad; ferier i kursiv. Neste sider: smal
  topplinje, «<periode> fortsetter». Bunnlinje: «Årsplan <fag> · skoleåret
  <år>» og «Side n av N». Leses i svart-hvitt.

- [x] **11.7 Fravær mot 10 %-grensen.** Fravær regnes i timer: summen av
  varigheten på øktene eleven er «ikke i økta», mot 10 % av fagets
  årstimetall (140 t → 14 t). Fagsiden: bolken «Fravær mot 10 %-grensen» med
  stolpe mot grensen, timer, og merket «Halvveis» (≥ 50 %, gul), «Nær
  grensen» (≥ 75 %, gul) og «Over grensen» (> 100 %, rød). Elever-lista viser prosent (høyeste fag).
  Elevkortet («Fravær i år») har én rad per fag: fagfirkant, kode, prosent,
  stolpe mot grensen, «9 av 24 økter · 15,8 t» og merket. Fotnote: «Udokumentert fravær over 10 % av timene i faget
  kan gi IV. InSchool er fasit; her regnes «ikke i økta».» Appen skiller
  ikke dokumentert fra udokumentert fravær.

**Tegnes i neste runde** (ikke bygg før det er tegnet):
- Elever: merke flere elever og endre fag, klasse eller mentor på alle
  samtidig, eller slette. Bestillingen står i `docs/bestilling-masseredigering.md`.
- Klassekart: farge per gruppe; lag plasser fra gruppene (gruppene sitter
  samlet); logg over tidligere kart for klassen.
- Vurderinger: kalendervisning med bare vurderingene.

## 12. Innsats over tid (13.10)

- [x] **12.1 Ny bolk «Innsats over tid» på I dag** (lerretet `InnsatsTid`),
  erstatter prikkene. Én rad per fag: fagfirkant, kode og navn til venstre.
  I midten én søyle per skoleuke for hele året (aug–jun, felles kolonner for
  alle fag): 100 % stablet andel grønn / gul / rød / fravær fra bunnen,
  14 × 52 px, 1 px mellomrom mellom delene, 3 px avrundet topp. Uker som
  kommer: tom søyle med tynn kant. Ferie: kort strek. Denne uka: lilla strek
  under. Til høyre: andel grønn siste 4 uker (Light 24 px) og endringen i
  prosentpoeng mot de fire ukene før (rød ved nedgang). Månedsnavn under,
  inneværende uthevet. Forklaring for fargene øverst til høyre (Grønn, Gul, Rød, Fravær). Hover på en
  søyle: mørk tooltip med «FAG · uke n», «3 økter · 72 skåringer» og tallene
  per farge; de andre søylene dempes. Klikk: åpner ukas økter. Ingen
  forklarende tekst under bolken – den skal forklare seg selv.
  *Gjort:* bolken går over hele bredden under de to kolonnene; søylene
  krymper under 14 px når vinduet er smalt. Forklaringen sier «Ikke i økta»
  som lerretet og resten av appen. Andelen grønn regnes uten «ikke i økta»
  (CLAUDE.md regel 5), lerretet tok den med i nevneren.

## 13. Beta 0.3.0 (13.10)

Målet er tilbakemelding på kjernefunksjonene fra kolleger. Pynt venter.

- [x] **13.1 «Gi tilbakemelding» nederst i sidemenyen**, over Innstillinger,
  samme stil som Innstillinger-raden. Klikk: kopierer én linje til
  utklippstavla, `Økta 0.3.0 · macOS 15.1 · Skjerm: Elevkort`, viser en
  kort bekreftelse («Kopiert. Lim inn i første felt.») og åpner skjemaet i
  standardnettleseren (Tauri opener). Skjermnavnet er skjermen man står på,
  aldri en elev, et fag-tema eller annet innhold. Lenka ligger som én
  konstant i `src/tilbakemelding.ts`; er den tom, skjules raden. Appen gjør
  ingen nettverkskall selv – nettleseren åpner lenka.
- [x] **13.2 Testheftet i dmg-en.** `docs/guide/betatest.html` skrives ut
  til PDF i `scripts/lag-dmg.sh` som guiden, og legges i dmg-vinduet ved
  siden av `guide_read_me.pdf`, sammen med
  `docs/guide/oppdiktet-klasseliste-1STA-1STB.pdf` (oppdiktet InSchool-PDF med
  22 elever og CC0-figurer; testet mot `lesInschool`, gir ENG1007, 22 elever,
  22 bilder).
- [x] **13.3 Versjon 0.3.0** i `package.json`, `src-tauri/tauri.conf.json`,
  `guide_read_me.html` og `betatest.html`. Release som pre-release på
  GitHub (`gh release create v0.3.0 … --prerelease --title "Økta 0.3.0 beta"`),
  se `docs/release.md`.
- Skjemaets spørsmål: `docs/beta/skjema.md`.

## 14. Windows (13.10)

Fredrik har ingen Windows-maskin. Alt bygges på GitHub Actions og testes av
betabrukere. Derfor: små, trygge endringer, og ingenting som bare kan
sjekkes ved å se på en Windows-skjerm uten at det står i en test.

- [x] **14.1 Bygg på GitHub Actions.** `.github/workflows/windows.yml` med
  `tauri-apps/tauri-action` på `windows-latest`. Kjøres når en release
  publiseres (`release: published`) og manuelt (`workflow_dispatch`).
  Laster NSIS-installeren (`.exe`) opp til den samme releasen; ingen MSI.
  `bundle.windows.nsis.installMode: "currentUser"`, så det ikke trengs
  admin, og `webviewInstallMode: downloadBootstrapper`. Mac bygges fortsatt
  lokalt med `npm run dmg`. Repoet er offentlig, så Actions er gratis.
- [x] **14.2 Hurtigtaster.** Én hjelper i `src/ui/` som sier om
  modifikatortasten er trykket (`metaKey` på Mac, `ctrlKey` ellers) og
  hvilket tegn som vises (⌘ / Ctrl, ⇧ / Shift, ⌥ / Alt). Alle stedene som
  bruker `metaKey` eller viser ⌘ går gjennom den. Test for begge plattformer.
  Pass på at Ctrl-snarveiene ikke kolliderer med WebView2 (Ctrl+P, Ctrl+F,
  Ctrl+R, Ctrl+W): de skal fanges av appen, ikke nettleseren.
- [x] **14.3 Nøkkelringen.** `keyring` får `windows-native` i tillegg til
  `apple-native` (Windows legitimasjonsbehandling). Teksten «nøkkelringen»
  heter «Windows legitimasjonsbehandling» på Windows.
- [x] **14.4 .okta-filer.** På Windows kommer stien som argument, og et nytt
  dobbeltklikk starter en ny prosess. Bruk `tauri-plugin-single-instance`,
  send stien til vinduet som kjører, og gjenbruk `oppsettfil-apnet`.
- [x] **14.5 Stier og tekster.** Vis den faktiske datamappa (fra Tauri, ikke
  hardkodet `~/Library/…`) i Innstillinger. Advarselen om synkmapper skal på
  Windows nevne OneDrive spesielt: Dokumenter ligger ofte i OneDrive der.
  «Programmer», «Finder», «FileVault» og lignende får Windows-ord der de
  vises.
- [x] **14.6 Guide for Windows.** `docs/guide/guide_read_me_windows.html`
  fra Mac-guiden: last ned `.exe`, SmartScreen («Mer informasjon» →
  «Kjør likevel», fordi appen ikke er signert), BitLocker i stedet for
  FileVault, Ctrl i stedet for ⌘, ny versjon = kjør ny installer. Skrives ut
  til PDF og lastes opp til releasen sammen med `betatest.pdf` og den
  oppdiktede klasselista, så Windows-brukerne har hele startpakken.
- [x] **14.7 Røyktest uten Windows.** Actions-jobben kjører `npm test` og
  `cargo test` på Windows før bygget. README får en Windows-linje under
  Installer. I betaskjemaet legges «Mac eller Windows?» til som første
  spørsmål.

## 15. Øktkortet og kalendertitler (14.10, lerret runde 15)

Svar på `docs/bestilling-oktkort.md`. Lerretene er fasit: `OktPlanNy`,
`OktLive` og `KalenderTitler` i `docs/lerret/`. Prøv dem i nettleseren;
de er interaktive.

- [ ] **15.1 Titler i kalenderen (måned).** Hver økt er en brikke i to
  linjer: fagkode (fagfargen, 600) og klokkeslett (dempet) på første,
  tittelen på andre, inntil to linjer, så «…». Samme svake fagtone som før,
  radius 5. Hele «FAG · 08:30 · tittel» i verktøytipset. Mentorsamtaler som
  før, men på én linje. Dagens dato i aksentfarget merke. Gjelder også uke.
  **Vis og skjul fag:** en rad med fagbrikker øverst til høyre i kalenderen
  (HIS3 · NOR3 · REL3 · Mentorsamtaler), hver i sin fagtone med hake. Klikk
  skjuler faget (brikken blir hvit med tom boks); klikk igjen viser det.
  Valget huskes per skjerm og gjelder både Uke og Måned. Heatmapet til
  høyre følger det som vises.
- [ ] **15.2 Planlegging: aktiviteter.** Hver rad: ⋮⋮ (dra), starttid
  (regnet ut, dempet), tittel, minutter med − / + i steg på 5, og ▸ som
  folder ut beskrivelsen under raden. Lukket rad med beskrivelse viser
  første linje grått etter tittelen. Ingen avkrysning i planleggingen.
  «+ Aktivitet» og «+ Pause» under lista. ↵ lager ny aktivitet, ⌥↑↓ flytter.
- [ ] **15.3 Tidslinjen i planleggingen** står over lista: 48 px, ett felt
  per aktivitet med bredde etter minuttene, tittel og «30 min» inni. Nøytrale
  felt (`#efecf6`, kant `#e3ddf0`), valgt felt hvitt med aksentring. Pause
  skravert. Klokkeslett hvert kvarter under, og en strek ved øktas slutt.
  Går planen opp: «90 av 90 min · går opp». Luft: stiplet felt «Luft ·
  10 min». For mye: tidslinjen strekker seg forbi sluttstreken, og summen
  sier «10 min for mye» i vanlig blekk, uten rødt. **Dra i skillet mellom to bolker** flytter tid mellom dem i steg på 5:
  bolken til venstre blir lengre og den til høyre like mye kortere (minst
  5 min hver), så summen står fast. **Enden av siste bolk** har også et
  håndtak: dra mot venstre for å korte ned den siste og få luft, mot høyre
  for å fylle luften igjen (aldri forbi øktas slutt). Håndtakene er 16 px
  brede og synes når musa er over tidslinjen.
  **Pauser står fast:** et skille inntil en pause flytter tid mellom
  aktivitetene på hver side av pausen; pausen beholder lengden og flytter
  seg bare. Klikk på en pause velger den og åpner lengdevalget; mens den er
  valgt, endrer skillene på hver side pausen selv (pausen blir lengre,
  naboen kortere).
  **Stokk om:** dra en bolk sideveis på tidslinjen, eller ⋮⋮ i lista opp og
  ned, så bytter den plass med det den slippes over. Bolken løftes litt
  (hvit, aksentkant, skygge) mens den dras; de andre glir på plass. Et
  klikk uten å dra velger bare. ⌥↑↓ flytter med tastaturet.
  **Skal føles nøyaktig som dra og slipp i samtaletimeplanen** (DESIGN §8):
  løft samtaletimeplanens dra-logikk (`skjermer/samtaler/Timeplan.tsx`) ut i
  én felles mekanikk i `src/ui/` og bruk den her, både sideveis på
  tidslinjen og opp/ned i lista. Samme kort, samme 30 %-regel, samme 240 ms
  og samme glid på plass. Lerretet viser bare oppførselen, ikke følelsen;
  timeplanen er fasit for følelsen.
  Klikk på et felt velger raden. Summen i overskriften
  erstatter «1,5 t av 1,5 t».
  - **Lengde med ett klikk:** klikk på «30 min» i raden åpner et valg rett
    under: 5 · 10 · 15 · 20 · 30 · 45 · 60 min og «Resten av økta · N min»
    (det som får planen til å gå opp). − / + står fortsatt ved siden av.
  - **For lite tid:** en rolig linje under tidslinjen: «Planen er 10 min for
    lang. Økta slutter 10:00, så det siste rekker ikke.» med én knapp:
    «Trekk 10 min fra ‹lengste aktivitet›». Øktas lengde endres aldri
    herfra. Ingenting stoppes; planen kan lagres som den er.
- [ ] **15.4 Kompetansemål foldet sammen.** Bare valgte mål og periodens
  mål vises, med «Vis alle 17 ▾». Overskriften sier «1 valgt · ● periodens
  mål».
- [ ] **15.5 Faktaraden** (dato, tid, rom, periode, vurdering) på én linje
  med etiketter over, lekse og agenda i to kolonner under. Mindre plass,
  samme innhold.
- [ ] **15.6 Live tidslinje i skåringen** (valgt 14.10 kveld: loddrett tidslinje i
  høyre kolonne, lerretet `OktLiveVertikal`, i stedet for den vannrette
  stripa i `OktLive`). En stripe rett under arkhodet,
  over hele bredden, over elevlista: til venstre «Nå» og aktiviteten, i
  midten stripen (12 px) med felt per aktivitet, ferdige mørkere, den aktive
  med aksentkant og framdrift fylt inn, nå-markør i aksent med klokkeslettet
  under, strek ved slutt; til høyre «5 av 30 min» og «29 min igjen av økta»
  eller «6 min etter planen · 29 min igjen». Statusmerket i hodet sier
  «Pågår · 29 min igjen».
  - **Avkrysning går av seg selv:** når tida for en aktivitet er ute, krysses
    den av automatisk (lysere hake) og neste begynner. Læreren trenger ikke
    røre noe.
  - **Trenger mer tid:** den aktive raden har «+5 min». Da forlenges den, og
    resten flytter seg. Det som havner etter slutt, står tonet med kant og
    «6 min over slutt» eller «rekker ikke» i lista; øverst «6 min forlenget
    · siste går 6 min over». Aldri rødt.
  - **Ferdig før tida:** klikk avkrysningen på den aktive, så begynner neste
    med en gang (mørk hake).
  - **Før start:** hele planen tonet, ingen markør, «Starter om 12 min»
    og «Først: …».
  - **Etter slutt:** ingen markør, «Ferdig 10:00 · 3 av 4 aktiviteter
    krysset av» og «Skriv i øktloggen før du lukker».
  - **Uten plan:** tom stripe med nå-markør og tid igjen; i høyre kolonne en
    stiplet boks «Ingen plan for økta. Legg til aktivitet åpner Planlegging».
  - **Pause** er egen type: skravert, uten avkrysning, krysses av av seg selv
    når tida er gått.
  - Stripen oppdateres én gang i minuttet, **uten overgang**. Skåringen
    påvirkes ikke.
- [ ] **15.7 Planen i høyre kolonne i skåringen:** én rad per aktivitet med
  avkrysning (automatisk når tida er ute, eller ett klikk for ferdig før tida;
  tidspunktet lagres), tid til høyre (ferdig-klokkeslett,
  «25 min igjen» på den aktive, ellers fra–til). Den aktive er uthevet med
  svak aksentflate og en tynn framdriftsstrek.
- [ ] **15.8 Lagring.** Fortsatt lesbar markdown i `okt.plan`:
  `- [ ] Gruppearbeid: kildekritikk · 30 min`, beskrivelsen som innrykkede
  linjer under (fire mellomrom), og pause uten avkrysningsboks:
  `- Pause · 10 min`. Tidspunktet en aktivitet ble krysset av lagres som
  `- [x] Gjennomgang · 30 min · ferdig 09:16`, og en forlengelse som
  `· +5 min`. Eldre planer uten disse
  feltene leses som før. Plan og beskrivelse går aldri ut av appen.

- [ ] **15.9 Nedtrekksmenyen** (lerretet `Nedtrekk`). Én komponent,
  `Velger` i `src/ui/`, som erstatter alle 25 `<select>` i appen og deler
  glass, rader og markør med `Kontekstmeny`.
  - **Feltet:** 32 px, radius 7, hvitt med kant `#e3ddf0` (hover `#c9c2dd`).
    Valgt verdi med eventuell prikk eller fagfirkant, og en vinkelpil som
    snur seg (S-kurven) når menyen er åpen. Åpen: aksentkant 1,5 px og en
    svak aksentring. Tastaturfokus: tydelig ring. Kan ikke endres: halvt
    gjennomsiktig. Variant «stille» uten ramme for verktøylinjer og over
    lister.
  - **Menyen:** glass som de andre menyene (hvit 94 %, blur 22, radius 14,
    skygge), minst like bred som feltet, 6 px under. Kommer inn på 170 ms
    (litt ned og opp i skala fra .97); ingen animasjon med redusert
    bevegelse. Snur og åpner oppover når det ikke er plass under.
  - **Rader:** 30 px, hake i aksent foran det valgte (og 500 vekt), ikon
    (prikk, fagfirkant eller vurderingsikon), tekst og hint til høyre
    (uker, dato, snarvei). Grupper med små versaletiketter, skillelinjer,
    og en handling nederst i aksent («+ Ny periode …»). «Ingen …» står først
    i dempet farge.
  - **Markøren** er én flate som glir mellom radene med S-kurven, som i
    sidemenyen.
  - **Tastatur:** ↓/↵/mellomrom åpner, ↑↓ flytter, ↵ velger, esc lukker,
    bokstav hopper til første treff. Over åtte valg: søkefelt øverst som
    filtrerer mens man skriver.
  - Tilgjengelighet: `role="listbox"`/`option`, `aria-expanded`,
    `aria-activedescendant`. Windows: samme utseende.

- [ ] **15.10 Øktplan: Enkel | Full** (lerretet `OktPlanEnkel`). Valg under
  Innstillinger › Generelt, standard **Enkel**. Samme data i begge; bare
  visningen skifter, så man kan bytte fram og tilbake uten å miste noe.
  - **Enkel, planlegging:** en ren liste med tittel og minutter per linje
    («Film · 15 min» kan skrives rett inn), en tynn stolpe (6 px) uten tekst
    over lista og «90 av 90 min» i overskriften. Ingen dra i tidslinjen,
    ingen beskrivelser synlig, ingen egen pausetype (en linje som heter
    «Pause» er bare en linje). Kompetansemål foldet til én linje. Vurdering
    flyttes ut av faktaraden.
  - **Enkel, skåring:** én linje i stedet for tidslinjen: «Nå · Gruppearbeid:
    kildekritikk · 25 min igjen». Lista til høyre krysses av som før.
  - **Full:** som 15.2–15.7.
  - Beskrivelser skrevet i Full blir liggende i Enkel og vises igjen i Full.

## 16. Fra lerretet, runde 16 (19.10)

Tegningene ligger i `docs/lerret/`. Fila står i parentes.

- [ ] **16.1 Filter i skåret økt** (OktSkarFilter): Alle · Til stede · Borte
  over elevlista, tastene B og A. «Borte» viser en linje med antall og
  «Kopier navnene». Filteret huskes ikke mellom økter.
- [ ] **16.2 Periode med ett klikk i Økter-lista** (OktListeMasse): perioden er
  en brikke som åpner nedtrekksmenyen (samme komponent som 15.x). En økt uten
  periode viser «Velg periode» med stiplet kant.
- [ ] **16.3 Flere økter samtidig** (OktListeMasse): avkrysning per rad,
  ⇧-klikk velger et spenn, ⌘A alle, esc fjerner valget. Med noe valgt kommer
  en mørk linje nederst: Periode (P) · Tid og rom (T) · Lekse (L) ·
  Vurdering (V) · Flytt … · Slett · ✕. Klikker man perioden på en valgt rad,
  gjelder valget alle valgte. Alt kan angres (⌘Z) og bekreftes med en toast.
- [ ] **16.4 Bytt to økter** (OktBytt): dra i tittelen eller i ⋮⋮ og slipp på
  en annen økt. Datoene, tid og rom står; tema, agenda, plan, lekse, kladd,
  kompetansemål, periode og vurdering bytter plass. Draget starter først
  etter 4 px, så et klikk i tittelen fortsatt gir skrivemarkør. Plassen man
  drar fra viser «‹tema› havner her». Skårede økter ligger fast. ⌥↑ / ⌥↓
  bytter med økta over eller under. Angre med ⌘Z. Samme dragfølelse som
  samtaletrekkeren (DESIGN §8).
- [ ] **16.5 I dag-linje i Økter-lista** (OktListeMasse, OktBytt): mørk linje
  med prikk til venstre og «I dag · ons 14.10» til høyre, over dagens økt,
  samme uttrykk som nå-linja i uka på I dag. «I dag»-merket i temaet fjernes.
- [ ] **16.6 Agenda med avsnitt** (OktTekst): agenda blir et flerlinjet felt
  som vokser med teksten. Enter gir ny linje, ⌘↵ er fortsatt Ferdig.
  Avsnittene går ut i kalenderbeskrivelsen (CalDAV) som linjeskift.
- [ ] **16.7 Kladd i økta** (OktTekst): eget felt under agendaen, bare for
  læreren, går aldri ut (ikke kalender, ikke årsplan, ikke eksport). Dra i
  håndtaket under for å endre høyden (60–420 px, huskes per bruker), dobbelt-
  klikk tilpasser til teksten. Vises også i Skåring og logg. Ny kolonne
  `kladd` på økta; byttes med i 16.4.
- [ ] **16.8 Fravær tydeligere** (OktFravaer, variant B er valgt): den fjerde
  prikken blir mørk (#5f5a70) med hvitt kryss og en ring rundt; de tre
  trafikklysene dempes; navn og bilde blekes (bildet i gråtoner). Ingen
  «BORTE»-merkelapp, raden står der den står. «Ikke skåret ennå» har fire
  lyse prikker, så de to kan ikke forveksles.
- [ ] **16.9 Ny vurdering rett fra økta** (OktVurdering): Vurdering-velgeren
  i økta får «+ Ny vurdering i denne økta» (N) nederst. Det åpner et lite
  skjema: navn (fylt ut fra temaet, med form som prefiks), form (Muntlig ·
  Skriftlig · Praktisk · Annet), når (denne økta / over flere økter …),
  type (Underveis · Sluttvurdering). «Lag vurdering» oppretter vurderingen,
  knytter den til økta og viser en toast med Angre og «Åpne i Vurderinger».
  Kriterier og vekt redigeres under Vurderinger som før.

## 17. Ønsker fra bruk (19.10), uten egne tegninger

- [ ] **17.1 Flere fag i filteret** i kalenderen og i øktlista under Alle
  fag: fagbrikkene fra KalenderTitler, flere kan være på samtidig, valget
  huskes per visning.
- [ ] **17.2 Ikoner i nedtrekkslista** der de mangler, i samme stil som
  «Lang liste» (Nedtrekk).
- [x] **17.3 Endre fargen på et fag** i fagoppsettet: fargevelger med
  palettens fagfarger pluss egendefinert. Fargen følger med overalt.
  Tegning: `docs/lerret/Fagfarger.dc.html`. Bruk **nøyaktig disse 36 fargene**,
  i seks familier à seks (vises som rader med familienavn):
  - Jord: `#9a5a2c #b5703a #c9922e #a98b5d #7a4f2e #5e4632`
  - Bær: `#c0607a #a83f5f #d4708c #8e3b6b #b85c9e #e08a9a`
  - Skog: `#3d7a5a #2f9a8a #5b8c3a #7a9a3e #2e6b4f #4fa37a`
  - Hav: `#2e6a8e #3f6a95 #4f7ac0 #2b8fb8 #5aa3c9 #1f4f7a`
  - Skumring: `#7d6bb0 #4a3d7d #9584c8 #6a4fa0 #b07cc6 #58507a`
  - Klar: `#e0563b #f08a24 #e8b400 #1aa37a #1f8ae0 #d43d8c`
  Legg dem i `src/ui/farger.ts` som `FAGFARGER` (familie → liste), ikke spredt i komponenter.
  Farger som et annet fag i samme skoleår bruker, vises dempet (lav opasitet, «brukt av MFL2» i tooltip),
  men kan likevel velges. Nederst «Egen farge» (fargehjul / hex). Valgt farge får ring.
  Samme velger brukes i Innstillinger → Fag (23.4) og ved nytt fag. Fagfarger skal aldri være
  trafikklysfargene (#3f9d49, #d9a92f, #c04a3d) – egen farge som treffer dem, avvises med en kort forklaring.
- [ ] **17.4 Velge flere elever** i Elever, mest for å slette mange på en
  gang. Samme mønster som 16.3 (avkrysning, ⇧-klikk, linje nederst).
  Sletting bekreftes med antall og navn.
- [ ] **17.5 Standard pausetider per fag** i fagoppsettet (f.eks. 10 min etter
  45 min). Legges inn i planen når en ny økt lages; kan endres per økt.
- [ ] **17.6 Tellende minutter per økt** i fagoppsettet: en økt 08:30–11:45 er
  195 min, men skal kunne telle som 180 i timeregnskapet. Valgfritt felt;
  tomt betyr faktisk lengde. Gjelder Timer på fagsiden og årsplanen.
- [ ] **17.7 Fagsøket i oppsettet**: søket mot Udir virker ikke for nye
  brukere. Finn feilen. Søk skal være standardvalget i oppsettet og stå
  øverst, med en tydelig tekst om at faginfo og kompetansemål hentes derfra.
  Ingen elevdata sendes med søket.
- [ ] **17.8 Spørsmål:** vises «borte sist» i «Følg opp i økta» alltid når
  en elev var borte forrige økt? Eieren vil beholde det.

## 18. Nøytral og klar for andre skoler (20.10)

- [ ] **18.1 Mentor heter kontaktlærer.** Alt brukeren ser bytter ord:
  Mentorsamtaler → Kontaktsamtaler, Mentorelev(er) → Kontaktelev(er),
  Mentorgruppa → Kontaktgruppa, «Ikke lenger mentorelev» → «Ikke lenger
  kontaktelev», MENTOR i kalenderen → KONTAKT. Gjelder også standardnavnet
  på CalDAV-kalenderen (f.eks. «kontaktsamtaler»), README, guiden og
  testdataene. Interne navn i kode og database (tabeller, kolonner,
  `kildeType: "mentorgruppe"`) kan stå, så ingen migrering trengs. En
  kalender brukeren allerede har satt opp, beholder navnet sitt.
- [ ] **18.2 Ingen skolenavn.** Fjern BPG fra eksempler, tester og
  dokumentasjon (`docs/oppsettfil.md`, `oppsettfil.test.ts`,
  `docs/klassekart.md`). Bruk «Eksempelskolen».
- [ ] **18.3 Hjemmeside** (Hjemmeside, lerret runde 17): en statisk side på
  GitHub Pages fra repoet, i `site/`. Nøytral, for lærere. Seksjoner: hero
  med nedlasting, fire tillitspunkter, skåring, planlegging, innsats over
  tid / midtveisvurdering, klassekart og grupper, tre fliser (kalenderstrøm,
  kontaktsamtaler, import), åtte små funksjoner, personvern (mørk), last ned
  (Mac/Windows, henter siste versjon fra GitHub Releases), spørsmål,
  avslutning. Skjermbildene tas fra appen med oppdiktede elever, aldri ekte
  data. Ingen sporing, ingen analyseskript, ingen fonter fra tredjepart (Geist
  legges ved).
- [ ] **18.4 Signering på Mac** (Apple Developer ID og notarisering), så
  advarselen ved første åpning forsvinner. Avventer eieren.

## 19. Ny elev og tilbakemeldinger fra kollegaer (20.10)

- [ ] **19.1 Ny elev** (ElevNy): glasskort under «+ Ny elev» (N). Stort
  navnefelt med initialer i en farget sirkel og fornavn/etternavn vist
  hver for seg. Tab flytter skillet («Anne Marie van der Berg»). Duplikat
  sjekkes mens man skriver: gul linje «X finnes allerede i 3STB · Åpne», og
  Lagre er av. Klasse som brikker (+ Ny klasse), fag som fargede brikker med
  hake (filterets fag er valgt fra start), Kontaktelev som bryter. ↵ lagrer
  og åpner elevkortet, ⇧↵ lagrer og tømmer feltet for neste. «Lagt til nå»
  viser dem som er laget. Ny rad glir inn i lista med et kort blink. Esc
  lukker. Erstatter dagens enkle felt.
- [ ] **19.2 Fast overskrift i Økter-lista.** Kolonneoverskriftene (uke,
  dato, dag, tid, tema, periode, vurdering) ligger alltid øverst når man
  scroller (sticky, med glassbakgrunn). Månedsoverskriften under følger med
  til neste måned tar over.
- [ ] **19.3 Smidigere markering av flere økter.** Klikk på en rad (ikke
  bare avkrysningen) velger den. ⇧-klikk velger alt mellom forrige og denne.
  ⌘-klikk legger til eller tar bort én. Dra over avkrysningene for å male
  et utvalg. Esc tømmer. Gjelder linja fra 16.3.
- [ ] **19.4 Ikke skåret betyr til stede, ikke sett** (avgjort 20.10). Ingen
  ny status og ingen ny tast. Læreren rekker ikke alltid å se alle, og en
  elev uten skåring var til stede, men ble ikke vurdert. Bare 0 (ikke i
  økta) teller som fravær. Ikke skåret teller ikke i innsatssnittet, og
  vises som tom rute i heatmap og elevkort, som i dag.
  - Ferdig: viser en rolig linje «3 elever er ikke skåret · regnes som til
    stede», med lenke tilbake til lista. Ingen dialog som stopper.
  - Neste økt i samme fag: «Følg opp i økta» får «Ikke sett sist: Ada,
    Jonas» (de som var uten skåring forrige gang).
  - Filteret i skåret økt (16.1) får «Ikke sett».
  - Sjekk at fravær, 10 %-grensen og eksport bare regner 0 som fravær.
- [ ] **19.5 Serier med intervall.** «Ny serie» får Hver uke · Annenhver
  uke · Hver tredje uke · Hver n-te uke, og A-/B-uke for skoler som har
  det. Forhåndsvisning av datoene før de lages, ferier hoppes over som før.

## 20. Design og skoleåret (21.10)

Rekkefølge: rydderunden først (20.1–20.4), så Skoleåret (20.6–20.7), så
I dag (20.5). Det som venter på betaen, står i §21.

- [ ] **20.1 Trafikklys med form.** For fargeblinde: grønn fylt, gul
  halvfylt, rød med lite kryss. Samme mønster i skåring, heatmap,
  elevkort og filter.
- [ ] **20.2 Farge betyr data.** Bare trafikklysene har sterk farge. Fag
  vises som liten firkant, periode som prikk, resten er nøytralt. Gå
  gjennom I dag, kalender og fagside.
- [ ] **20.3 Én skårprikk-komponent** brukt overalt: rød, gul, grønn,
  0 = ikke i økta (mørk med kryss), ikke skåret = ikke sett (tom).
- [ ] **20.4 Tastestripa tones ned** etter at man har brukt tastene noen
  ganger, og kommer tilbake når man holder ⌘.
- [ ] **20.6 Skoleåret** (Arsplanlegger): ny fane «Året» i faget, mellom
  Oversikt og Økter. Stedet for det store bildet.
  - Hele skoleåret som én stripe. Enheten er øktene fra timeplanen (ikke
    uker); ferier er skravert og har ingen økter. Måneder og «I dag» vises.
  - Periodene dras inn fra lista, flyttes sidelengs og forlenges i begge
    ender. De hopper til økter, og en boble viser «man 12.10 → man 14.12 ·
    19 økter» mens man drar. Start og slutt kan ikke ligge i en ferie.
  - Ny periode: dra over en tom del av stripa, skriv navn, velg farge, ↵.
    Et enkelt klikk lager en periode på åtte økter.
  - Vurderingene står som gule merker under periodene, med navn og dato
    ved hover.
  - Perioder og økter: ▸ folder ut øktene i perioden med dato, ferie som
    egen linje, og tema som kan skrives rett inn (↵ eller ↓ til neste, ↑
    tilbake). Det er samme tema som i Økter-lista.
  - Periodekortet viser vurderingene som er planlagt i perioden som en
    rolig grå linje under datolinja («Vurdering: navn · dato»), uten gult.
    Gult brukes bare i tidslinja og i den utfoldede lista. I den utfoldede lista står
    vurderingsmerket mellom dato og tema.
  - Kompetansemål: med en periode valgt, klikk for å knytte. Uten valg
    (Esc, klikk utenfor, ✕) viser hvert mål bare «✓ Dekket» med fargeprikker
    for periodene, eller «Ikke dekket».
  - «Gi N økter perioden» setter perioden på alle økter i spennet.
  - Årsplan-PDF-en bygger på dette.
- [ ] **20.7 Bruk fjorårets år som mal** («Hent fra i fjor …» i Året, og
  tilbys når et nytt skoleår opprettes). Viser hver periode med datoene i
  fjor og i år og antall økter (+1/−1 der ferier har flyttet seg). Velg
  hva som blir med: perioder, kompetansemål, tema på øktene (i rekkefølge),
  vurderinger (som utkast på nærmeste økt), plan og agenda. Ingenting om
  elevene blir med. Erstatter årets perioder, kan angres.
- [ ] **20.5 I dag: Enkel og Full** (IDagOppsett, bare bryteren øverst til
  høyre). Enkel (standard): Dagens økter, Følg opp i dag og Gjøremål. Full: i
  tillegg Uka, Vurderingsfrister, Elever som glipper og Innsats over tid.
  Bruk samme rutenett og plassering som i tegningen for Full (ingen hull).
  - Følg opp i dag grupperes i Rød sist, Ikke sett sist og Borte sist, per
    fag du har i dag.
  - Innsats over tid viser grønn, gul, rød og grått (til stede, ikke sett),
    regnet av dem som var til stede.
  - Uka har bryteren Timer (tidslinje med scroll, standard) og Kompakt.
    Kompakt krymper flisen til én rad, og flisene under glir rolig opp.
  - Valget huskes. Tilpass, størrelser og flytting kommer i §21.

## 21. Etter betaen (tegnet, venter på tilbakemeldinger)

Tegningene ligger klare. Ta dem opp når betatesterne har brukt Økta en
stund og etterspør dette.

- [x] **21.1 Skoleåret som tavle** (ArsTavle, bygget 21.10). Bryteren «Tidslinje · Tavle»
  øverst til høyre i Året, valget huskes.
  - Én kolonne per periode fra august til juni, scroll
      sidelengs. Kolonnehodet har farge, datoer, kompetansemål og antall
      økter. Hver økt er et kort med dato, vurderingsmerke og tema som
      skrives rett inn (↵/↓ neste, ↑ forrige). Dra et kort til ny plass, også
      over i en annen periode: datoene står, temaene etter rykker ett hakk,
      og vurderingen følger temaet. «− økt / + økt» flytter grensen mot neste
      periode. Ferier står som egne linjer.
  - Bygget: `data/tavle.ts` (kolonner, `byttInnhold`, `tilKolonne`),
    `skjermer/ArsTavle.tsx`. Endret 21.10 etter ønske: kort på kort *bytter*
    (som Økter-lista), ikke rykk ett hakk. Kort i nabokolonnen får perioden.
    Økter uten periode blir en egen grå kolonne. Skårede økter ligger fast.
    «+ Ny periode» legger en uplassert eller ny periode på de første 8
    øktene uten periode. Flytting og grenser angres med ⌘Z.
- [ ] **21.2 I dag som fliser med Tilpass** (IDagOppsett). Egen-oppsett,
  S/M/L/XL, dra fliser, − skjuler, «+ navn» for skjulte. Inspirert av
  widgets på iPhone og Mac. Øverst til høyre: Enkel · Full · Egen og «Tilpass».
    - Rutenett med fire kolonner og faste radhøyder. Flisene har størrelsene
      S (1×1), M (2×1), L (2×2) og XL (4×2), og hver flis har sine lovlige
      størrelser (Uka: M/L/XL, Frister: S/M osv.).
    - S viser en kortversjon: stort tall og én linje («7 elever å følge opp»,
      «15.10 neste frist», «3 åpne gjøremål»).
    - Plassering pakkes i rekkefølge, og rutenettet skal alltid gå opp: et
      hull fylles ved at flisen til venstre strekkes (S blir M og viser den
      lange versjonen). I Tilpass vises hull som «Ledig plass».
    - Tilpass: flisene står stille (ingen vipping), får en tynn kant, kan dras til ny plass, har S/M/L/XL nede
      til høyre og − øverst til venstre for å skjule. Skjulte fliser står
      nederst som «+ navn». Endringer gir «Egen». «Ferdig» avslutter.
    - Enkel: Dagens økter (L), Følg opp i dag (M), Gjøremål (M). Full: i
      tillegg Uka (XL), Vurderingsfrister (S), Elever som glipper (M),
      Innsats over tid (S).
    - Følg opp i dag grupperes i Rød sist, Ikke sett sist og Borte sist, per
      fag du har i dag.
    - Innsats over tid viser grønn, gul, rød og grått (til stede, ikke sett),
      regnet av dem som var til stede.
    - Uka i XL har bryteren Timer (tidslinje med scroll, standard) og Kompakt.
      Kompakt krymper flisen til én rad (4×1).
    - Når flisene flytter seg (størrelse, rekkefølge, skjul, oppsett, Kompakt),
      glir de rolig til ny plass (FLIP, ca. 350 ms, myk ut-kurve uten overskyting).
      Mens man drar, markeres bare målet; flisene byttes først når man slipper.
      Skal føles som samtaletrekkeren og skåringslista, ikke sprette.
    - Huskes per bruker. Samme valg i Innstillinger → I dag.

## 22. Egne karakterskalaer (21.10)

Tegning: `docs/lerret/Skalaer.dc.html` (Innstillinger → Skalaer). Datamodellen finnes allerede (`skala`, `skalaverdi`, `vurdering.skala_id`, `fag.skaringsskala_id`), så dette er bare UI, ingen migrering: `kode` = verdi, `etikett` = forklaring, `slettet` gir myk sletting. Tast 0 for rang 0 (§5) gjelder fortsatt.

- [x] **22.1 Liste.** Innebygde (Trafikklys, Godkjent, Lav–middels–høy, Karakter 1–6) er låst, med «Kopier og endre». «Dine» under, med antall verdier. «+ Ny skala» nederst.
- [x] **22.2 Maler ved ny skala.** Egen liste · Karakter med + og − (1, 2−, 2, 2+ … 6, ferdig utfylt) · Poeng 0–maks · Kopier en skala. Alt kan endres etterpå.
- [x] **22.3 Redigering.** Navn; bruk: Vurdering / Skåring / Begge (`bruksomrade`). Per verdi: kode, forklaring, farge (ingen/rød/gul/grønn), bestått, teller ikke. Dra ⋮⋮ for rekkefølge (= `rang`, øverst lavest). Enter i siste felt lager ny rad.
- [x] **22.4 Taster.** ≤ 9 verdier: tast 1–9 i rekkefølge. Over 9: ingen taster, læreren skriver koden (f.eks. 4+) og trykker Enter. Vis dette i forhåndsvisningen.
- [x] **22.5 Forhåndsvisning.** «Slik ser det ut når du fører»: chips med samme utseende som ved føring.
- [x] **22.6 Regler når skalaen er brukt.** Navn, forklaring, farge og rekkefølge kan endres. Verdier som er brukt kan ikke slettes (✕ deaktivert, tooltip sier hvorfor). Resultater beholder verdien sin. Sletting av hele skalaen bare når den ikke er brukt.
- [x] **22.7 Velge skalaen.** I «Ny vurdering» og i fagets skåringsskala (filtrert på `bruksomrade`). Egne skalaer følger med i eksport/«Hent fra i fjor».
- [x] **22.8 Farge betyr data (20.2).** Verdier uten farge vises nøytralt grå, ikke i heatmap-fargene.
- Merknad (21.10): `skalaverdi` manglet `slettet`, `opprettet` og `endret`
  (001), så «ingen migrering» holdt ikke. Migrasjon 029 legger dem til,
  etter regel 2 i CLAUDE.md. Ellers ingen endring i datamodellen.

## 23. Innstillinger, ny modell (21.10) — godkjent

Tegning: `docs/lerret/Innstillinger2.dc.html`. Samme innhold som i dag, men i det nye skallet. Endringer:

- [x] **23.1 Oppsett.** Undermeny med ikoner i grupper: Deg · Daglig bruk (Generelt, Skoleår, Fag, Skalaer, Utseende) · Trygghet (Sikkerhetskopi, Personvern) · Utenfor Økta (Kalender, Del med kollegaer) · Om Økta. Markøren glir rolig (360 ms, ingen sprett).
- [x] **23.2 Kort med rader.** Tittel og hjelpetekst til venstre, kontroll til høyre. Brytere for av/på, seg for valg.
- [x] **23.3 Søk i innstillinger** i verktøylinja. Treff hopper til siden og blinker raden kort.
- [x] **23.4 Nye sider.** *Deg* (navn, skole, «Jeg er kontaktlærer» + klasse). *Fag* (fargebytte inline med brukte farger dempet, Legg til fag via Udir, Fagbanken). *Om Økta* (versjon, Gi tilbakemelding, datamappe).
- [x] **23.5 Slått sammen.** Kalenderstrøm + Kalenderserver → *Kalender*. Arkiv → under *Sikkerhetskopi*.
- [x] **23.6 Generelt** får «I dag: Enkel/Full» (20.5). **Skoleår** får ferier og fridager, «Start 2027/28» (20.7) og tidligere år.
- [x] **23.7 Personvern** starter med fire hake-linjer om hva som lagres og sendes, deretter innsyn, slett elev og slett et års elever.
- [x] **23.8 Lys/mørk** ligger nederst i Utseende med merknad om at mørk ikke er ferdig.
- [x] **23.9 Det som ventet** (avtalt 21.10, bygget samme dag):
  - *Deg:* feltet Skole. Står i toppen av årsplanen og i PDF-en.
  - *Personvern:* «Vis elevbilder» (av = plassholderen overalt; bildene
    blir liggende), «Slett alle elevbilder», «Slett en elev helt» (alle år)
    og «Slett elevene fra et tidligere år» (fag, økter og planer står; en
    elev som bare finnes i det året, slettes helt). Sikkerhetskopiene røres
    ikke: de er veien tilbake.
  - *Om Økta:* «Se etter oppdatering» åpner utgivelsessiden på GitHub i
    nettleseren. Appen gjør ingen nettkall selv (regel 1).
  - *Skoleår:* ferier legges til og fjernes rett i lista. Skoleruta er der
    for hendelser og resten.
  - Avvik fra tegningen: «Jeg er mentor» i stedet for «kontaktlærer» (appen
    bruker mentor-ordene; språkvalg senere).

## 24. Utkast for vurderinger (21.10) — godkjent

Vurderinger som hentes fra i fjor, er forslag til læreren har sett på dem.

- [x] **24.1** `vurdering.utkast` (migrering 030, 0 = bekreftet). «Hent fra i
  fjor» lager vurderingene med `utkast = 1`.
- [x] **24.2** Dempet ikon og «utkast» i Året, Økter, Vurderinger og
  fagoversikten. I Økter får en utkastdag ikke gul stripe eller fet tekst.
- [x] **24.3** Utkast står ikke blant vurderingsfristene i I dag. Kalenderen
  og CalDAV sender ikke vurderinger i det hele tatt, så der trengs ikke noe.
- [x] **24.4** «Bekreft» i vurderingspanelet og «Bekreft alle» over lista i
  Vurderinger. Ett klikk, ingen spørsmål. Testet i `mal.test.ts`.

## 25. Plasser og grupper (21.10) — godkjent

Tegning: `docs/lerret/PlasserGrupper.dc.html`. Grupper skal ikke ligge gjemt inne i et klassekart.

- [x] **25.1 Navn.** «Klassekart» → «Plasser og grupper» i menyen (snarvei G P). Bestemt.
- [x] **25.2 To faner i verktøylinja:** Klassekart · Grupper (samme rekkefølge som navnet). Fanen huskes.
- [x] **25.3 Grupper uten kart.** Velg klasse/fag som chip (faget i økta du har nå er valgt). Krever ikke rom eller kart. Bruker samme `fordelGrupper` og historikk som i dag.
- [x] **25.4 Antall eller per gruppe.** Seg «Antall | Per gruppe» med − / +, og oppsummering («á 4 · 24 elever» / «6 grupper · 24 elever»).
- [x] **25.5 «Bare de som er her»** (på som standard): tar bort de som har fravær i dagens økt, og viser dem overstreket over gruppene.
- [x] **25.6** Tilfeldig/Spre/Samle, «Unngå samme som sist», dra elever mellom grupper, Stokk ⌘R med rolig FLIP (420 ms, ingen sprett). Kopier til Teams og Skriv ut lagrer settet.
- [x] **25.7 Lagrede grupper** som knapp i verktøylinja med nedtrekksliste (valgt klasse øverst). Gruppene får hele bredden.
- [x] **25.9 Bilde til elevene (PNG).** Knapp i verktøylinja åpner forhåndsvisning (1920 × 1080). Overskrift kan skrives, Navn: Fullt · **Fornavn + E.** (standard, «Aksel S.») · Fornavn (får etternavnsinitial hvis to heter det samme), «Dato i hjørnet». Hver gruppe har sin farge (fargelinje med «Gruppe n» + svak tone bak navnene).
  - **ALDRI med i bildet:** innsatsprikken, fravær («Borte i dag»), notater, initialsirkler, modus (Spre/Samle) eller antall elever per gruppe. Bildet tegnes fra en egen funksjon som bare får `{ overskrift, grupper: [{ nr, farge, navn[] }] }` — ingen elevobjekter, så innsats kan ikke lekke inn ved et uhell.
  - Test: render bildet for et sett der elevene har innsats, og sjekk at ingen piksel har trafikklysfargene (#3f9d49, #d9a92f, #c04a3d) og at funksjonen ikke tar imot innsatsfeltet.
  - Lagres via lagre-dialog (Tauri), filnavn «MFL2 Veggavis.png». Lagrer også settet i historikken, som Kopier til Teams.
  - Eksempel: `docs/lerret/PlasserGrupper-eksempel.png`.
- [x] **25.10 Kopier til Teams som tabell**, samme mønster som tidsplanen i Samtaler (`somTeamsHtml` + `ClipboardItem` med `text/html` og `text/plain`). Overskrift i fet, så tabell «Gruppe | Elever» med fargekvadrat ■ i gruppens farge foran «Gruppe n», og navnene kommaseparert. Ren tekst: «Gruppe 1: Aksel S., Maja B., …». Navnevalget (Fullt · Fornavn + E. · Fornavn) er det samme som for bildet, og huskes. Et lite felt under knappen viser hva som ble kopiert. Erstatter dagens tekstliste i `karttegning.ts`. Samme regel som 25.9: funksjonen får bare nummer, farge og navn, og en test sjekker at innsats og fravær aldri er med.
- [x] **25.11 Gruppefarger i klassekartet.** Tegning: `docs/lerret/KlassekartFarger.dc.html`. «Farge på pultene» får et tredje valg: Ingen · Innsats · **Grupper**. Med Grupper: pensel med 8 farger + visk ut; klikk en pult eller dra over flere for å fargelegge, klikk igjen tar bort. «Fyll ut for meg»: *To og to par* (bordet foran og bak = gruppe på 4, det vanligste) og *Hvert bord sin gruppe*; så justerer læreren for hånd. Gruppene listes med farge, navn som kan skrives om («Gruppe 1» som standard, nummerert lesende fra tavla) og antall. Fargen hører til **pulten**, ikke eleven: stokker du plassene, blir fargene stående. Kommer med i utskrift og PNG av kartet, aldri innsatsen. «Bruk som gruppesett» lagrer det som et gruppesett (historikken i 25.7/§26).
- [x] **25.12 Datamodell.** `oppsett.klassekart_id` er NOT NULL i dag, men 25.3 lager grupper uten kart. Løsning: knytt oppsett til kilden (fag/klasse) i stedet, eller lag et skjult kart per kilde. Velg det som gir minst migrering. Pultfargene lagres på rommets plasser per kart (ny tabell `kart_plassfarge(kart_id, plass_id, farge, gruppenavn)`).
  - Bygget 21.10: grupper uten kart får et *skjult kart* per kilde
    (`innstillinger.bareGrupper`, `kartForKilde`), uten migrering. Får
    kilden senere et klassekart med rom, blir det skjulte kartet det kartet,
    så historikken er én. Pultfargene: `kart_plassfarge` per plassnummer
    (migrering 032), `hentPlassfarger` / `lagrePlassfarger`.
- [x] **25.8 Klassekart-fanen:** kort per kart med liten plasskisse, rom som chips, «Nytt rom» og «Nytt kart» i verktøylinja.

## 26. Samarbeid på elevkortet (21.10) — godkjent

Tegning: `docs/lerret/ElevSamarbeid.dc.html`. Ny fane «Samarbeid» på elevkortet, per fag.

- [x] **26.1 Diagram.** Eleven i midten, klassekameratene i ring rundt. Avstand = hvor ofte de har vært sammen (ofte · av og til · aldri ytterst, stiplet). Tykkere strek = flere ganger. Hover/klikk løfter eleven fram.
- [x] **26.2 Kilde.** Lagrede gruppesett og sidemann i klassekartene (`oppsett` type gruppe/plass, `sammenFor`). Valg: Begge · Grupper · Sidemann. Sidemann = samme bord.
- [x] **26.3 «Har aldri vært sammen med …»** som chips, og «Sett sammen neste gang»: gruppelageren prøver å få eleven i gruppe med noen av disse ved neste Stokk i faget (myk regel, ikke tvang).
- [x] **26.4 Detaljer** for ett par: hver gang de var sammen (gruppe/sidemann, navnet på settet, dato).
- [x] **26.5 «Oftest sammen»**: topp 6 med stolpe.
- [x] **26.6 Bare for læreren.** Aldri i eksport, utskrift, Teams eller samtaler. Ingen ny lagring: alt regnes ut fra historikken.
- [x] **26.7 Ønsker på elevkortet.** Boks «Trives med · vil gjerne sitte med» øverst i Samarbeid: chips med ★, kilde (Samtale · Eleven · Sett selv) og dato, «gjensidig» når begge har nevnt hverandre, × fjerner. «+ Legg til» med navnesøk. «Nevnt av andre» under. Avkrysning «Ta hensyn når jeg stokker grupper og plasser» (myk regel i fordelGrupper, aldri tvang). I ringdiagrammet er ønskede elever grønnblå med ★. Bør også kunne legges inn fra samtalen (Samtaler → eleven → «Vil gjerne være med …»).
- [x] **26.8 Datamodell.** Ny tabell `elevonske(id, elev_id, onsker_elev_id, kilde, dato, samtale_id NULL, opprettet, slettet)`. Ikke knyttet til fag: gjelder i alle fag der begge er. Myk sletting. Sletting av elev (Personvern) sletter ønskene begge veier.
- [x] **26.9 Klassen — relasjonskart i faget.** Tegning: `docs/lerret/KlasseRelasjoner.dc.html`. Ny fane «Klassen» på fagsiden (Oversikt · Året · Økter · Kalender · Klassen). Nettverk der elever som ofte har vært sammen havner nær hverandre. **Flyter som grafen i Obsidian:** en enkel kraftsimulering (frastøtning mellom alle, fjær langs båndene, svak tyngde mot midten) kjører i requestAnimationFrame. Dra i en elev, så følger naboene med, og **mens du drar tones alle eleven ikke har en relasjon med svakt ned** (samme fokus som ved klikk, 220 ms), så de hen har bånd/ønsker med trer fram; slipp, så tones alt opp igjen og kartet faller til ro (høy demping, ingen sprett, stopper helt når det er i ro). Startplassering regnes på forhånd og huskes per fag, så kartet åpner der du forlot det. Filterbytte flytter ikke elevene. Med «Reduser bevegelse» flyttes bare eleven du drar. Bånd = samarbeid (tykkelse etter antall), piler = ønsker, tykk grønnblå strek = gjensidig. Filtre: tre uavhengige avkrysninger «Vis: Grupper · Sidemann · Ønsker», alle kombinasjoner lov (f.eks. bare ønsker, eller bare grupper uten ønsker). Grupper = lilla heltrukket bånd, Sidemann = blått stiplet bånd, Ønsker = grønnblå piler (tykk strek = gjensidig). Panelet til høyre regner alltid på all historikk, uansett hva som vises. Klikk en elev: båndene hennes løftes fram, resten dempes, kort med sammendrag og «Åpne elevkort».
- [x] **26.9b Krefter i stedet for zoom** (som grafvisningen i Obsidian). Ingen zoomknapper. Knappen «Krefter ⌄» åpner fire glidebrytere som virker med en gang: *Spredning* (frastøtning), *Stivhet* (hvor hardt båndene drar), *Båndlengde* (avstand der et bånd er i ro) og *Trekk mot midten*. «Løs opp klumpen» løsner alt på én gang (mer spredning, slakkere bånd, mindre trekk mot midten), og «Tilbakestill» gir standardverdiene. Simuleringen varmes opp ved hver endring og faller rolig til ro. Innstillingene huskes per fag. Sirkler og navn har alltid samme størrelse.
- [x] **26.9d Navigering uten prosent.** Ingen zoomknapper eller prosentvisning. Kartet er et lerret: klyp på styreflaten eller hold ⌘ og rull for å zoome rundt pekeren (myk, kontinuerlig, 35–400 %); to fingre / rullehjul uten ⌘ flytter; dra i tom bakgrunn flytter (grab-peker). Zoom flytter elevene fra hverandre, sirkler og navn beholder størrelsen. Liten «midtstill»-knapp (⌖) viser hele klassen igjen. «Stort kart» skjuler panelet. Kameraet huskes per fag.
- [x] **26.9c Hover viser elevbildet i noden.** Ingen boks: sirkelen vokser til et rundt elevbilde (44 px, hvit kant) som tones raskt inn (opasitet 160 ms + svak skalering fra 0,6, ease-out) og ut igjen. Navnet glir litt ned så det ikke dekkes. Følger «Vis elevbilder»: av = initialer i fargesirkel. Med «Reduser bevegelse» bare toning. Bilder er aldri med i eksport.
- [x] **26.10 Panelet ved kartet:** Gjensidige ønsker · Ønsker som ikke er oppfylt ennå (ønsket, men aldri sammen) · Har vært sammen med færrest · Ikke nevnt i noen samtale ennå (med forklaring om at det bare betyr at ingenting er skrevet).
- [x] **26.11 Personvern.** Ønsker og relasjonskart er bare for læreren: aldri i eksport, utskrift, Teams, bilde, kalender eller oppsettfil. Test for det.
- [x] **26.13 «Neste gang skal … sitte med».** Boks på elevkortet (Samarbeid), og knapp «Sitt sammen neste gang» i detaljene for et par. Konkret avtale: én eller flere elever, Gjelder: Klassekart · Grupper · Begge, Kilde: Eleven · Samtale · Jeg, med dato. **Hard regel** (ulikt 26.3/26.7, som er myke): neste Stokk i faget låser paret sammen (samme bord / samme gruppe), og avtalen fjernes når kartet eller settet lagres. Vises med 📌 i ringdiagrammet, og i Plasser og grupper som «📌 2 avtaler for neste gang» over Stokk, med mulighet til å hoppe over én gang. Går det ikke (f.eks. eleven er borte), blir avtalen stående og læreren får beskjed. Tabell: `neste_sammen(id, elev_id, med_elev_id, skolear_fag_id, gjelder, kilde, dato, brukt NULL)`.
- [ ] **26.12 Senere:** matrise som alternativ visning.

## 27. Klassekartet på et blikk i økta (22.10) — godkjent

Tegning: `docs/lerret/OktKlassekart.dc.html`. I dag tar «Klassekart →» i økta deg til fanen Plasser og grupper. Det er for mye når du bare vil se kartet.

- [x] **27.1** «Klassekart» i metalinja i økta (ikon + tast **K**) åpner et kort over økta i stedet for å bytte fane. Økta blir liggende under. K, esc eller klikk utenfor lukker. Kortet glir inn på 220 ms, uten sprett.
- [x] **27.2** Kartet vises **fra kateteret** som standard (tavla nederst, «du står her»), med «Fra elevene» som valg. Valget huskes. Kompakt: fornavn + E. per pult.
- [x] **27.3** Elever som er borte i dag (skåret 0) er overstreket og bleke. Øverst: «24 til stede · 2 borte · 10 skåret».
- [x] **27.4** «Farge»: Ingen · Dagens skår (liten trafikklysprikk) · Grupper (pultfargene fra 25.11). Huskes.
- [x] **27.5** Klikk en elev i kartet: lista under ruller til eleven og blinker raden, og kortet blir stående. Kortet er bare for å se, ikke for å endre plasser.
- [x] **27.6** «Åpne i Plasser og grupper ↗» nederst for å redigere kartet.
- [x] **27.7** Har faget ikke noe kart, står det «Ingen klassekart for MFL2 ennå» med en lenke til å lage et.

## 28. Vurderinger og samtaler, muntlig vurdering (22.10) — godkjent

Tegning: `docs/lerret/MuntligVurdering.dc.html`. Faglige samtaler bakes inn i en muntlig vurdering. Kontaktsamtaler blir i Samtaler (vises bare for kontaktlærere).

- [x] **28.0 Én fane: «Vurderinger og samtaler»** (G V). Tegning: `docs/lerret/VurderingerSamtaler.dc.html`. Samtaler forsvinner som egen fane i menyen. Oversikten grupperer etter status: Nå · Kommende · Til føring · Ferdig. Hver rad viser ikon for type, tittel, fag og type, skala (og «rubrikk»), dato og status («Pågår · Filip er inne», «4 av 26 levert», «Snitt 4,2») og framdrift (N av M). Muntlig som pågår er markert. Filtre: Alle · Skriftlig · Muntlig · Innlevering · Kontaktsamtaler, og fagbrikker. «+ Ny» viser Skriftlig prøve · Muntlig vurdering (med tidsplan) · Innlevering, og under en strek Kontaktsamtaler («ikke en vurdering, gir ingen karakter»). Kontaktsamtaler har litt annen bakgrunn, vises bare for kontaktlærere, og notatene deres vises aldri i faget. Klikk åpner arket (muntlig = Planlegg/Gjennomfør/Resultater, kontaktsamtaler = dagens samtaletrekker).
  - *Sammenlignet med tegningen 25.10 (oversikt og «+ Ny»).* Rettet: skoleåret etter tittelen, og «Du ser dem bare når du har mentorelever» nederst. Bevisst: «Mentor-» i stedet for «Kontakt-» (mentorord.ts). **Åpent:** tegningen viser klassen («2STA») på mentorsamtale-raden og som brikke i filteret; appen viser «Mentorgruppa», fordi gruppa kan gå på tvers av klasser. Skal klassen vises når alle er i samme klasse?
- [x] **28.1 Tre faner i vurderingen:** Planlegg · Gjennomfør · Resultater.
  - *Sammenlignet 25.10 (MuntligVurdering, alle tre faner).* Rettet: overskriftene i arket (muntlig, føring, mentorsamtaler) i vanlig halvfet skrift i stedet for STORE BOKSTAVER. **Åpent:** tegningen har «‹» foran faget i arkhodet; appen lukker med esc.
- [x] **28.2 Planlegg:** samtaletrekkerens tidsplan (dager, minutter per elev, pause, lunsj, trukket rekkefølge, del til Teams), pluss kriterier og **oppgavekort**: hvert kort har tittel, en kort linje om caset (valgfri) og en liste «Spørsmål du kan stille» (Enter gir nytt spørsmål, × fjerner). «+ Ny oppgave» og «Kan trekkes flere ganger». Oppgavene kan gjenbrukes neste år via «Hent fra i fjor». Under Gjennomfør vises den trukne oppgavens beskrivelse og spørsmål rett under tittelen, og læreren kan klikke av spørsmålene etter hvert som de er stilt (lagres per elev, kommer ikke med i karakteren).
  - Oppgavekortene stemmer med tegningen.
- [x] **28.2b Generatoren i Planlegg.** Boks «Tidsplan» øverst: Dager (+ dag), Starter, Per elev, Pause, Lunsj og Lunsjlengde med − / +, og oppsummering («14 elever · ferdig 12:58»). «🎲 Trekk rekkefølge» og «Alfabetisk». «Oppgaven trekkes: nå, for alle · under samtalen». Alle tider regnes ut på nytt med en gang, og lunsj legges inn der den faller. I Planlegg kan rekkefølgen dras i tidsplanen til venstre (⋮⋮, rolig FLIP 380 ms, ingen sprett), og tidene følger med. I Gjennomfør er dra skrudd av. Erstatter samtaletrekkerens oppsett for faglige samtaler. Samme kode, ikke en kopi.
  - Planlegg følger denne teksten (generatoren), ikke brikkene «12 min per elev · 3 min pause · Lunsj» i den eldre MuntligVurdering-tegningen. Bevisst.
- [x] **28.3 Gjennomfør:** tidsplanen til venstre, gjeldende elev markert. Til høyre: tidslinje for samtalen, trukket oppgave («Trekk ny»), kriterier som avkrysning, notat, karakter med tast 1–6, «Møtte ikke» og «Neste elev ⌘↵». Karakteren vises i tidsplanen med en gang. «Tidligere i faget» viser bare faglige ting (vurderinger, innsats), aldri kontaktsamtaler.
  - Rettet: tidsplanen viser ikke lenger tomme karakterruter (bare karakteren når den er satt, og «–» for møtte ikke); karakterknappene får én linje hver når skalaen har ord (Godkjent-skalaen fløt ut over knappene); notatfeltet i 14 px.
- [ ] **28.3b Rubrikk i stedet for avkrysning.** Over kriteriene: «Avkrysning · Rubrikk» (valget hører til vurderingen). Rubrikken er en tabell med kriterier som rader og nivåer som kolonner (standard Lav · Middels · Høy, kan endres i Planlegg), med en kort beskrivelse i hver celle. Klikk en celle for å velge nivået. Raden markeres, og fokus går videre til neste uvurderte kriterium, så du klikker deg gjennom ovenfra og ned. Klikk igjen fjerner valget. Når alle er vurdert, står «Rubrikken peker mot 5 · bruk», og et klikk setter karakteren. Det er bare et forslag, du bestemmer selv. Rubrikken lages i Planlegg under «Slik vurderer du» (Kriterier · Rubrikk): kriterier som rader, nivåer som kolonner med navn som kan endres, en beskrivelse per celle, «+ Kriterium», «+ Nivå». **Rubrikker kan lagres som maler** («Lagre som mal») og hentes inn i andre vurderinger («Lagrede rubrikker ⌄» gir en kopi, malen endres ikke). Malene ligger i Innstillinger → Skalaer ved siden av skalaene, og følger med i «Hent fra i fjor» og oppsettfila (Del med kollegaer). Valgte nivåer tas med i «Skriv ut tilbakemeldinger».
  - *Ikke sammenlignet ennå:* testvurderingen i dummybasen har ingen rubrikk. Lag en i prøvebenken og sammenlign med «Rubrikk» i Gjennomfør og Planlegg.
- [x] **28.4 Notatet er en Notion-aktig editor, ikke en tekstboks.** Ingen ramme, skriver rett på flaten. Markdown-snarveier ved mellomrom: `#` overskrift, `##` mindre overskrift, `-`/`*` punkt, `1.` nummerert, `[]` sjekkliste (klikk boksen for å krysse av). `/` på tom linje åpner en meny (piltaster + Enter). Enter i tomt punkt avslutter lista, Backspace først i overskrift/punkt gjør det til tekst. ⌘B / ⌘I. Lagres som Markdown. Bruk et lokalt editorbibliotek (f.eks. TipTap eller Lexical), ingen nettverk. Samme editor bør senere brukes i øktlogg, elevnotater og samtalenotater.
  - Samme editor som 29.1; sjekklistene står på én linje igjen (CSS rettet 25.10).
- [x] **28.5 Resultater:** tabell med elev, oppgave, karakter og notat (ren tekst), «Skriv ut tilbakemeldinger» og «Kopier karakterlista».
  - Tabellen: kolonneoverskrifter i små store bokstaver, «…» der karakteren mangler, og «møtte ikke» under karakter med «–» for oppgaven, som i tegningen (rettet 25.10). Teams-kopien er uendret.

## 29. Bli der du er (22.10) — godkjent

**Prinsipp for hele appen:** du skal ikke tas ut av det du holder på med. Du bytter side bare når du trykker i sidemenyen. Alt annet åpnes over der du står, og lukkes med esc: elevkort som ark (ElevArk), klassekartet i økta (§27), innstillinger for et fag, hjelp. Gjelder også lenker: «Åpne elevkort» fra Vurderinger, Følg opp, relasjonskartet og Karakterer legger elevkortet over, og ‹ tar deg tilbake dit du var.

- [ ] **29.1 Én notat-editor overalt.** Editoren fra §28.4 (Markdown-snarveier, `/`-meny, sjekklister, ⌘B/⌘I) brukes i øktlogg, elevnotat, samtalenotat, muntlig vurdering og kommentarer. Én komponent, lagres som Markdown.
- [x] **29.2 Faginnstillinger på stedet.** Tegning: `docs/lerret/FagInnstillinger.dc.html`. ⚙ i verktøylinja på fagsiden åpner et ark fra høyre med farge (FAGFARGER, brukte dempet), dager, lengde, rom, skåringsskala, standardskala for nye vurderinger, læreplan og «Arkiver faget». Lagres med en gang. Innstillinger → Fag lenker hit i stedet for å ha egne felt.
  - *Sammenlignet 25.10.* Rettet: gruppeoverskriftene i vanlig halvfet skrift, dagene «ma ti on to fr», og «Endringer lagres med en gang. Du blir værende i faget.» nederst. **Åpent:** (1) tegningen viser 12 farger og «Flere farger i Innstillinger → Fag»; appen viser hele paletten med familier og «Egen farge». (2) I tegningen begynner arket under verktøylinja; i appen dekker det den (Arkstabel, gjelder alle ark fra høyre).
- [x] **29.3 ⌘K: kommandolinje og hjelp.** Tegning: `docs/lerret/Kommandolinje.dc.html`. Grupper: Gjør (Ny vurdering, Ny økt, Ny elev, Lag grupper, Ta sikkerhetskopi), Gå til (sider, fag-faner, vurderinger), Elever, Innstillinger (søker i innstillingene fra §23.3). Skriver du «hvordan …» eller «hjelp», blir det hjelp: korte svar med en knapp som gjør det. «?» viser alle hurtigtaster. ↑↓ og ↵. Hjelpetekstene ligger lokalt i appen, ingen nettverk.
  - *Sammenlignet 25.10.* Rettet: plassholder «Søk, gjør noe, eller spør «hvordan …»», mindre skrift i feltet, ikonene i små ruter, og bunnlinja med tastebrikker (↑↓ velg · ↵ åpne · ? hjelp · esc lukk) og «Prøv …». **Åpent:** «Gå til» i tegningen har også det du står i nå (fagets Karakterer, klassekartet, en vurdering som pågår); appen har bare de faste sidene. Merkelappen «Kommando» i feltet er ikke bygget.
- [x] **29.4 Karakterer i faget.** Tegning: `docs/lerret/Karakterer.dc.html`. Ny fane på fagsiden: Oversikt · Året · Økter · Kalender · **Karakterer** · Klassen. Tabell med alle elever × vurderinger i faget, innsats siste 10 økter, beregnet vektet snitt, halvårskarakter og kommentar. Vekting per vurdering med − / + i kolonneoverskriften («teller ikke» for godkjent/ikke godkjent). Halvårskarakter: tast 1–6, ↓ neste elev, Backspace fjerner, klikk setter forslaget. Høst · Vår · Hele året. Hover på en karakter viser rubrikk og kommentar. «Kopier karakterlista» (Teams-tabell + ren tekst). Klikk på elev = elevkort over. På elevkortet vises samme rad for eleven.
  - *Sammenlignet 25.10.* Rettet: kolonneoverskriften deles ved kolon, «Muntlig» over «SWOT · 17.9», som i tegningen. Resten stemmer (vekt − ×1 +, «teller ikke», innsats, beregnet, halvår med forslag, kommentar). Tegningen viser fire innsatsprikker under «siste 10 økter»; appen viser ti, som overskriften sier.
- [x] **29.5 Føring av skriftlig prøve og innlevering.** Tegning: `docs/lerret/Foring.dc.html`. Samme oppbygning som muntlig (§28): elevlista til venstre, eleven til høyre. «Én og én»: Levert · Ikke levert · Borte (borte hentes fra fraværet i økta), rubrikk (eller kriterier), karakter 1–6 med forslag fra rubrikken, kort kommentar med faste fraser per vurdering («+ Drøft mer …»), ⌘↵ neste. «Tabell»: rask føring, skriv karakter, Tab til kommentar, Enter neste, lim inn en kolonne fra Excel. «Kopier til Teams» gir karakter og kommentar per elev, så det ikke må skrives to ganger.
  - *Sammenlignet 25.10 (Én og én og Tabell).* Rettet: Levert · Ikke levert · Borte som tre brikker med den valgte mørk; navnet overstreket når eleven er borte; elevlista står også ved Tabell; tabellen med små store bokstaver i overskriftene, karakterruter med kant og «borte» / «ikke levert» med liten forbokstav. Rubrikk og faste fraser har samme oppbygning, men dummybasen har ingen å vise. Appen har i tillegg «Oppsett» og «I økta …» i arkhodet.
- [ ] **29.6 Kontaktsamtale-arket i ny stil.** Tegning: `docs/lerret/Kontaktsamtaler.dc.html`. Erstatter samtaletrekkeren fra runde 3. Samme skall som muntlig: Planlegg (samme generator som §28.2b) · Gjennomfør · Oppsummering. Gjennomfør: tidsplanen til venstre (med foresatt / eleven alene / møtte ikke), samtaleguide som krysses av, notat (§29.1), «Fra forrige samtale» (mål), «Til neste gang», «Trives med · vil sitte med» (lagres som elevønske, §26.7) og en liten oversikt (fravær, innsats, frister fra dine fag). Ingen karakter. Notatene vises aldri i fag, eksport eller kalender.
- [ ] **29.7 Følg opp som egen liste.** Tegning: `docs/lerret/FolgOpp.dc.html`. Fra I dag («Se alle»): Alle · Rød sist · Ikke sett · Borte · Frist · Avtale. Hver rad: elev, fag, grunner, én linje forklaring, innsats-prikker, hvor lenge siden. Notat · Til samtale (legges på neste kontaktsamtale) · Fulgt opp ✓ (glir rolig ut, kommer tilbake om noe nytt skjer).
- [ ] **29.8 Tomme sider.** Tegning: `docs/lerret/TommeSider.dc.html`. Hver side som kan være tom får en rolig strektegning, én setning om hva som mangler, én hovedknapp, en sekundær, og et hint. Minst: I dag (ingen økter i dag / helt nytt år), Elever, Vurderinger og samtaler, Plasser og grupper, Fag → Karakterer, Følg opp («Ingen å følge opp her»).
- [ ] **29.9 Fliser ut.** Fredrik liker ikke flise-uttrykket på I dag (§21.2, IDagOppsett). Behold Enkel/Full (§20.5), men dropp fliser/«Tilpass med S/M/L/XL». Fjern ordet «flis» fra UI og tekst.

## 30. Øktkortet (23.10) — godkjent

Tegning: `docs/lerret/Oktkort.dc.html`. Samme ark i to moduser, Skåring og logg · Planlegging. Gjenbruker klassekartet fra §27 og notat-editoren fra §29.1, og følger «bli der du er» (§29).

- [x] **30.1 K og V som kort over økta.** I linja under tittelen: «Klassekart K» og «Vurdering V», i begge modusene. K åpner klassekartet (§27). V åpner «Vurdering i denne økta»: *Skriftlig prøve nå* (elevene som er til stede blir lagt inn, du fører etterpå), *Muntlig i økta* (tidsplan innenfor øktas tid) og *Knytt til en vurdering* (fagets vurderinger med frist, og «+ Ny vurdering …»). Bare ett kort åpent om gangen. Esc og klikk utenfor lukker kortet, og du blir i økta.
- [x] **30.2 Fravær med tast 0.** Mørk prikk med ×, navnet tones ned, og eleven teller som «Borte» i Følg opp.
- [x] **30.3 Filter over lista.** «Elever · N av M skåret · b borte» til venstre, og Alle · Til stede · Borte til høyre (B veksler Borte, A gir Alle). «Ikke sett» kommer i tillegg når økta er i gang (19.4). Notatet fra økta står i kursiv rett etter navnet, og klassen helt til høyre.
- [x] **30.4 Planen mens økta pågår.** Under arkhodet en vannrett stripe: «Nå» og aktiviteten, bolkene (ferdig, nå, pause, senere), nålen med klokkeslettet og «9 av 30 min · i rute». Planen står i høyre kolonne med avkrysning, «21 min igjen» på den som pågår, minuttene på de ferdige og starttida på de neste. Øktplan: Enkel beholder én linje i stedet for stripa.
- [x] **30.5 «Oppsummering» i stedet for «Exit-lapp»** i standardplanen og eksemplene.
- [x] **30.6 Øktloggen i notat-editoren** (§29.1) i høyre kolonne, under planen, med hintet «# overskrift · - punkt · [] blir gjøremål på I dag · / meny».
- [x] **30.7 Planlegging.** Venstre: Dato · Tid · Rom · Periode på én rad; **Til elevene** (agenda og lekse i én blokk, «går ut i kalenderen og årsplanen»); **Plan** som tidslinje («bare for deg», «90 av 90 min · går opp»); **Kladd** (bare for deg, håndtak for høyden); **Kompetansemål** (periodens mål). Høyre: Fra forrige økt · Følg opp i økta · Vurdering («Ingen i denne økta. Legg til (V)») · Perioden.
- [x] **30.8 Tastestripa** viser 1 2 3, 0 borte, N notat, K klassekart, V vurdering, B A borte / alle i skåringen, og ⌘← ⌘→, ↵, K og V i planleggingen.

## Ikke nå

Ting som er vurdert og lagt bort med vilje. Står her så de ikke dukker opp
igjen som nye ideer.

- Mørk modus for det nye fra runde 7–11 (arkene, vurderingsgull,
  plassholdere, bevegelsesbrettet) — avventer eieren; bruk tokens så det
  er lett å legge til
- Lekse i kalenderen (CalDAV, SPEC §8.1) — avventer; i dag går bare
  agendaen ut
- Klasseopprykk — avventer; eieren er usikker på om det trengs

- Fagpresets fra Udirs Grep-API — `scripts/hent_grep.py` finnes, men hører til etter v1
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
