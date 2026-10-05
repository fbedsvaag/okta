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
- [ ] Ukesvisning av økter — tegnet 05.10, se §5.9.
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

**Før du starter:** les DESIGN.md i sin helhet. Bestem om forslaget til ny
§13 i `docs/spec-forslag-2026-10-05.md` skal inn i SPEC.md.

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
- [ ] **5.6 I dag.** Dagens økter med tid i egen kolonne og fagfirkant på
  linje med tittelen. Notat fra forrige økt sammenleggbart. Fjern setningen
  over. Valget om sammenlagt huskes som de andre bolkene.
- [ ] **5.7 Skåring.** Fjern symbol+tekst-kolonnen. Notat fra denne økta i
  egen kolonne på raden; N åpner feltet i raden. Plottet viser valgt verdi
  i full styrke. Raden holder 28 px.
- [ ] **5.8 Økter og perioder.** Fjern periodevisningen og pensel/viskelær.
  Perioden blir merkelapp på raden, radene fargelegges ikke. Periodene øverst
  blir filtre. Marker rader + P setter periode. Sjekk
  `periode-fargelegg.test.ts` — testene for pensel kan gå, logikken for å
  sette periode på mange økter skal bestå.
- [ ] **5.9 Kalender.** Måned: helligdager som egen type i `fridag.type`
  (`helligdag`, ingen migrasjon trengs — kolonnen har ingen CHECK) med egen
  tone, og årsheatmap i høyre kolonne. Uke: ny visning med heldagsrad,
  valgt-økt-panel og timer per fag.
- [ ] **5.10 Elevkort.** Notater og møtelogg som tidslinje (gjenbruk
  `ui/Tidslinje.tsx` fra fagkortet).
- [ ] **5.11 Innstillinger.** Venstremeny med grupper. Generelt får
  tekststørrelse (Mindre / Vanlig / Større → `--tekst-skala`). Utseende får
  glass og paletter. Del oppsett kommer i 5.13.
- [ ] **5.12 Oppsettveiviser.** Fire steg + Ferdig, større tekst,
  «Fortsett senere», duplikatspørsmål med angre. Første steg har plass til
  oppsettfil, men knappen kan vente til 5.13.
- [ ] **5.13 Oppsettfil.** Spec og oppskrift i `docs/oppsettfil.md`.
  Spec-teksten må godkjennes inn i SPEC.md før koden skrives.
- [ ] **5.14 Logo — Bolk med glass** (valgt 05.10). Kildene ligger i
  `src/assets/logo-glass.svg` (mørk, appikon), `logo-glass-lys.svg` og
  `logo-glass-tonet.svg`. Erstatt `logo.svg` og `logo-lys.svg` med dem.
  Oppdater `Merke` i `src/ui/logo.tsx` til de nye formene (plate x/y 40,
  rx 215; felt rx 44/40; lys variant har felt i aksenten) — glasskantene
  kan droppes under 32 px, der de bare blir grums. `scripts/lag-ikoner.mjs`
  må lære gjennomsiktighet og kantlinje for å tegne glasset; alternativt
  tegnes bare plate og felt der, uten glass. Kjør skriptet og sjekk
  ikonet i Dock. Kommentaren i `logo.tsx` om fargestreken i venstremarg er
  utdatert — feltene finnes igjen i fagfirkanten og heatmapet.
- [ ] **5.15 Samtaletrekkeren.** Samme oppbygning som før (§4.10), strammet
  opp etter DESIGN §10: planlagte trekninger i sidemenyen, eksport i
  verktøylinja, oppsettet i én kolonne med blokker (modus, vurdering,
  samtalene, temaer, samtaledager med kapasitet, historikk, Generer + låser),
  kapasitetsvarsel som navngir hvem som mangler plass, og timeplanen med
  dagen i Light-overskrift. Oppgavenummer som liten rute i temafargen.
  «Møtte ikke» og lås som ikonknapper på raden.

## Ikke nå

Ting som er vurdert og lagt bort med vilje. Står her så de ikke dukker opp
igjen som nye ideer.

- Klassekart — kraftig nedprioritert 30.09. Bygges standalone først om det
  kommer, og rom må kunne lages enkelt, ellers blir det ubrukt
- Klasseopprykk — avventer; eieren er usikker på om det trengs

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
