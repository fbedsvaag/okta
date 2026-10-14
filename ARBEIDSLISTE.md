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
  sier «10 min for mye» i vanlig blekk, uten rødt. **Dra i kanten mellom to
  felt** endrer minuttene i steg på 5 (rekkefølgen byttes i lista, ikke på
  tidslinjen). Klikk på et felt velger raden. Summen i overskriften
  erstatter «1,5 t av 1,5 t».
- [ ] **15.4 Kompetansemål foldet sammen.** Bare valgte mål og periodens
  mål vises, med «Vis alle 17 ▾». Overskriften sier «1 valgt · ● periodens
  mål».
- [ ] **15.5 Faktaraden** (dato, tid, rom, periode, vurdering) på én linje
  med etiketter over, lekse og agenda i to kolonner under. Mindre plass,
  samme innhold.
- [ ] **15.6 Live tidslinje i skåringen.** En stripe rett under arkhodet,
  over hele bredden, over elevlista: til venstre «Nå» og aktiviteten, i
  midten stripen (12 px) med felt per aktivitet, ferdige mørkere, den aktive
  med aksentkant og framdrift fylt inn, nå-markør i aksent med klokkeslettet
  under, strek ved slutt; til høyre «5 av 30 min» og «29 min igjen av økta»
  eller «6 min etter planen · 29 min igjen». Statusmerket i hodet sier
  «Pågår · 29 min igjen».
  - **Ligger etter:** en aktivitet som ikke er krysset av når tida er ute,
    varer til den krysses av. Resten flytter seg; det som havner etter
    slutt, står tonet med kant, og i lista «6 min over slutt» eller «rekker
    ikke». Aldri rødt.
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
  avkrysning (ett klikk; tidspunktet lagres), tid til høyre (ferdig-klokkeslett,
  «25 min igjen» på den aktive, ellers fra–til). Den aktive er uthevet med
  svak aksentflate og en tynn framdriftsstrek.
- [ ] **15.8 Lagring.** Fortsatt lesbar markdown i `okt.plan`:
  `- [ ] Gruppearbeid: kildekritikk · 30 min`, beskrivelsen som innrykkede
  linjer under (fire mellomrom), og pause uten avkrysningsboks:
  `- Pause · 10 min`. Tidspunktet en aktivitet ble krysset av lagres som
  `- [x] Gjennomgang · 30 min · ferdig 09:16`. Eldre planer uten disse
  feltene leses som før. Plan og beskrivelse går aldri ut av appen.

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
