# Designoppdrag — Elevtracking

Du skal jobbe med **utseendet** til Elevtracking: farger, typografi og
bevegelse. Denne teksten er alt du trenger for å komme i gang uten å ha vært
med på det som er bygget til nå.

---

## 1. Hva appen er

En lokal desktop-app for undervisningsplanlegging og elevoppfølging. Tauri 2 +
SQLite + Vite/React/TypeScript + Tailwind 4. Bygget av én lærer i norsk
videregående skole, til eget bruk.

**Tenk på den som en fysisk skrivebok som er blitt digital.** Den er lærerens
eget arbeidsmateriale. Den er ikke et rapporteringssystem, ikke et dashbord, og
ikke et produkt som skal selges inn. Den blir sett på i sekunder om gangen, i et
lyst klasserom, ofte mens noen snakker til deg.

Brukeren er ikke utvikler. **Forklar valgene dine på norsk, med vanlige ord.**
Kjør ikke lange sekvenser uten å si hva du gjør.

### Les dette først

`SPEC.md` i prosjektroten er fasit, og **§13 Visuell retning** er ditt mandat.
Les hele §13 før du rører noe. Er noe uklart eller motstridende — spør. Ikke
gjett, og ikke fyll inn på egen hånd.

---

## 2. Rammer

### Det som faktisk er ufravikelig

**Null nettverkskall mens appen kjører.** Dette er et personvernkrav fra
`CLAUDE.md`, ikke en preferanse. Konkret: ingen Google Fonts, ingen CDN, ingen
`@import url(...)` mot nettet, ingen ikonpakke som hentes ved kjøring.

**Merk hva dette *ikke* betyr.** Det begrenser ikke hva du kan velge — bare hvor
det ligger. En fontfil i `public/` som lastes fra disk er like lokal som en PNG.
Du står fritt til å bruke hvilken som helst skrift, farge eller ressurs, så lenge
den **følger med installasjonen** i stedet for å hentes ved kjøring. Å lese en
fil fra disk er ikke et nettverkskall.

**Skalaverdienes farger er data-drevet.** `skalaverdi.farge` lagrer et *navn*
(`gronn`, `gul`, `rod`), ikke en hex-kode. Oppslaget skjer i `src/ui/farger.ts`.
Dette er en arkitekturbeslutning, ikke en fargebeslutning: den gir deg full
frihet til å bytte hele paletten ett sted, og alle visninger følger med. Bytt
der — aldri i den enkelte visningen, og aldri i databasen.

### Det som er forsiktighet, og som eieren kan oppheve

Disse fire er råd for en designrunde, ikke lover. Brukeren kan når som helst si
at du skal gå lenger — da gjør du det.

1. **Ikke rør datamodellen eller spørringslaget** (`src/data/`, `src/db/`,
   `src/import/`, `src-tauri/migrations/`). Trenger du en ny opplysning for å
   tegne noe, si fra i stedet for å legge den til selv.
2. **Ikke endre oppførsel.** Tastaturflyt, lagring og navigasjon skal virke som
   før. Du bytter uttrykk, ikke funksjon.
3. **Foreslå før du utfører** på ting som treffer bredt.
4. **Ikke endre SPEC.md** uten å legge fram et forslag først. (Denne er
   brukerens egen stående regel — den står ved lag.)

---

## 3. Hva som er bygget

Appen er ferdig nok til å brukes. Alt under står og virker; 73 tester passerer.

**Skjermer** (`src/skjermer/`):

| Skjerm | Hva den er |
|---|---|
| `Veiviser` | Førstegangsoppsett i tre steg: skoleår → fag → elevlister |
| `IDag` | Startskjerm. Dagens økter som kort, nærmeste forhåndsvalgt |
| `Skolekalender` | Hele skoleåret som månedsrutenett, **kun mandag–fredag** |
| `Skoleruta` | Ferier og fridager, som toner ut dager i kalenderen |
| `Fag` | Fagene i året, redigerbar tabell + `FagPanel` som sidepanel |
| `Elever` | Hovedtabellen: navn, klasse, fag, økter, siste. + `ElevPanel` |
| `LimInn` | Lim inn klasseliste, forhåndsvisning med duplikathåndtering |
| `Okter` | Øktene kronologisk + `OktPanel` — **her skåres elevene** |
| `Perioder` | Året som vannrett tidslinje med perioder som felt |
| `Vurderinger` | Vurderingsoppgaver per fag + `VurderingPanel` |
| `Innstillinger` | Skoleår, fagbank, fag i år, skalaer, sikkerhetskopi |
| `Arsplan` | Egen utskriftsvisning (print-stylesheet, ikke skjermbilde) |

**Gjennomgående mønstre du må respektere:**

- **Liste til venstre, panel til høyre.** Flere skjermer viser en liste i 1/3
  bredde og et detaljpanel i 2/3 når noe er valgt (`lg:w-1/3` / `lg:w-2/3`).
  Lista komprimerer seg selv når panelet er åpent.
- **Felt som lagrer når de forlates.** Ingen lagre-knapper. Enter bekrefter,
  Escape angrer.
- **Navigasjonshistorikk** som i en nettleser, med ⌘[ og ⌘] .
- **Kolonnevelgere** i Elever og Økter, lagret i databasen.
- **Skåringsflyten i `OktPanel`:** tastene `0`–`3` setter verdi og flytter
  markøren til neste elev automatisk. Tastene utledes av skalaens rangering,
  de er ikke hardkodet.

**Ikke bygget ennå:** oppfølging (§4.7) og tekstarkiv-eksporten (§8). Du skal
ikke bygge dem — men ikke design deg inn i et hjørne som gjør dem vanskelige.

---

## 4. Hva som finnes av visuelle valg i dag

Vær ærlig om utgangspunktet: **fargene er halvveis, typografien er ikke påbegynt,
og bevegelse finnes ikke.**

### Farger som er i bruk (`src/ui/farger.ts`)

```
TRAFIKKLYS   gronn #2dc937 · gronngul #99c140 · gul #e7b416
             guloransje #db7b2b · rod #cc3232
NØYTRAL      #9e9e9e   (verdier uten farge, «ikke i økta»)
FAGFARGER    12 dempede blekkfarger, f.eks. #2f5d8a, #7a4b2a, #3f6b4a
```

Trafikklyset har fem trinn selv om v1 bare bruker de tre ytterpunktene — en
femtrinns skåringsskala er en naturlig utvidelse.

### Farger som ligger strødd i komponentene

Dette er den blå som markerer valgt rad og fokus, gjentatt som hex-strenger
mange steder i stedet for som ett navngitt token:

```
#1d4e7c   primær blå (knapper, fokusring, markert rad, aktiv fane)
#194365   samme blå, mørkere ved hover
#eaf0f6   aktiv fane-bakgrunn
#f4f7fa   hover på rad, meldingsstripe
#b3261e   feil og konflikt (økt på en fridag)
#fdf0ef · #fbf3f3 · #f6f4f0   toning av blokkerte dager i kalenderen
```

Resten er Tailwinds `neutral`-skala. **Å samle disse i navngitte tokens er en
naturlig del av oppdraget** — men gjør det uten å endre hvordan noe ser ut i
samme slengen, så det er mulig å se hva som faktisk endret seg.

### Typografi

**Ingen `font-family` er satt noe sted.** Appen kjører på nettleserens
standardskrift. §13 ber om «en smal grotesk til elevnavn og UI, tabulærsifre til
datoer og tall». Tabulærsifre brukes allerede via Tailwinds `tabular-nums` på
datoer, klokkeslett og tall — det mønsteret skal beholdes.

Skriftstørrelser i dag: `13px` er brødteksten i tabeller og skjemaer, `11–12px`
for etiketter og hjelpetekst, `15px` for overskrifter, `10px` i kalenderrutene.

### Bevegelse

**Én eneste overgang i hele kodebasen:** `transition-colors` på knappen i
`src/ui/felles.tsx`. Alt annet er umiddelbart. Det er ikke en forglemmelse — det
er nær der §13 vil at appen skal ligge.

---

## 5. Oppdraget

### Farger

Bygg en samlet palett med navngitte tokens (Tailwind 4 bruker `@theme` i
`src/index.css` — det finnes ingen `tailwind.config.js`).

- **Blekksvart tekst på papirhvit flate.** Én kald blå for markert rad og fokus.
- **Trafikklyset er det eneste stedet i appen med mettet farge.** Det er hele
  grunnen til at alt annet må være nedtonet. Vurder om dagens fem trinn er
  riktige — de er valgt for lesbarhet, ikke for skjønnhet, og #2dc937 er
  ganske skarp.
- **Fag skilles med tynne fargestreker i venstremarg, ikke med flater.**
- Gå gjennom kontrast. Dette leses på avstand i et lyst rom.

### Tekst

**Skriften skal velges, ikke arves.** At det ikke er satt noen `font-family` i
dag betyr at appen kjører på nettleserens standard — det er ikke en beslutning,
det er fravær av en. Her er det meningen at du skal ta et standpunkt.

- **Du står fritt.** Legg skriftfilene i `public/` og last dem med `@font-face`
  fra en lokal sti. Kommersielle skrifter er helt i orden så lenge brukeren har
  lisens som dekker å pakke dem med en app — nevn det som et spørsmål, ikke som
  en innvending.
- **Ett funksjonelt krav:** skriften må ha **tabulære sifre** (`tnum`), eventuelt
  sifre med fast bredde fra naturens side. Datoer, klokkeslett, timetall og
  elevantall står i kolonner som skal flukte. Dette er lesbarhet, ikke smak. En
  skrift med proporsjonale sifre og ingen `tnum`-variant kan ikke brukes til
  tall — men kan fint brukes til navn og UI, med en annen til tallene.
- **§13 ber om en smal grotesk.** Det er en retning, ikke en dom. Har du et
  bedre forslag for en app som skal minne om en norsk klassejournal — en
  ledger-aktig grotesk, noe med litt kant, noe nordisk — så legg det fram.
  Referansen er linjert papir, ikke et SaaS-dashbord.
- **Unngå standardvalgene.** Inter, `system-ui`, Roboto og Helvetica-klonene gjør
  jobben, og det er nettopp problemet: de ser ut som alt annet. Se punkt 6.
- **Tetthet er den viktigste enkeltbeslutningen i hele UI-et:** radhøyden skal
  være stram nok til at **30 elever får plass uten scrolling på en 14-tommer**.
  Test det faktisk — ikke anta. Dette er også et fontvalg: en smal skrift kjøper
  deg plass i kolonnene.
- Sett også `<title>` i `index.html`, som fortsatt står på
  «Tauri + React + Typescript» fra oppsettet.

### Animasjon

Hold igjen. §13 sier: **nesten ingen bevegelse.**

- Markørflytting i skåringslista kan ha **80 ms**. Det er den ene tillatte.
- Alt annet er umiddelbart.
- **Ingenting får ligge i skåringsflyten.** Kravet er 30 elever på under 20
  sekunder med tastene `0`–`3`. En animasjon per elev som «bare» tar 100 ms
  legger tre sekunder på jobben og gjør at markøren henger etter fingeren.
- Sidepanelet som glir inn kan ha en kort overgang. Vurder det, ikke anta det.
- Respekter `prefers-reduced-motion`.

### To ting til

- **Trafikklyset må være lesbart uten fargesyn og på avstand.** Bruk former som
  skiller seg fra hverandre i tillegg til farge — fylt, halvfylt, tom.
- **Utskriftsvisningen må fortsatt virke.** `src/index.css` har en
  print-stylesheet med `.ikkeutskrift` / `.kunutskrift` og sideskift per fag.
  Alt du gjør skal være lesbart i svart-hvitt på papir.
- **Mørk modus:** ja, men lav prioritet. Klasserom er lyse. Ta det til slutt,
  eller la det ligge.

---

## 6. Det skal ikke se «Claudsk» ut

Dette er en uttrykt bestilling fra eieren, og den er viktigere enn den kan virke.
Det finnes et gjenkjennelig utseende som språkmodeller faller ned på når de får
frie tøyler, og det er *feil* for denne appen — ikke fordi det er stygt, men
fordi det er anonymt og fordi det er et dashbord-språk brukt på et arbeidsverktøy.

**Listen over ting du skal la være:**

- **Inter, `system-ui` eller Roboto** som gjennomgående skrift
- **Indigo, fiolett og lilla** som aksentfarge (`#6366f1`, `#8b5cf6` og slekta)
- **Gradienter** — særlig i topptekst, knapper og «hero»-flater
- **`rounded-xl` og `rounded-2xl` overalt.** Denne appen er linjert papir. Skarpe
  eller nesten skarpe hjørner.
- **Slagskygger og kort.** Ikke pakk hver seksjon i en hvit boks med skygge på et
  grått underlag. Bruk linjer, ikke flater.
- **Emoji som ikoner** (📊 ✨ 🎯). Aldri.
- **Pill-formede merkelapper** med pastellbakgrunn overalt
- **Luftig midtstilt `max-w-4xl`-layout.** Tettheten er poenget.
- **Store tall som «stat-kort»** øverst på skjermer
- **Standardpaletten fra Tailwind** (`slate-500`, `zinc-100`) som hele
  fargeidentiteten
- **shadcn/ui-utseendet** rett ut av eska

**Det du skal se på i stedet:** den norske klassejournalen. Regnskapsbøker og
ledger-papir. Rutenett og linjer. InSchool og Excel — ikke fordi de er pene, men
fordi de er språket brukeren allerede leser fort. Et verktøy som ser ut som noe
en lærer har brukt i tjue år, bare skarpere.

Blir du i tvil: **spør om det ser ut som et skjema eller som et produkt.** Det
skal se ut som et skjema.

## 7. Slik jobber du

1. **Les `SPEC.md` §13 og `CLAUDE.md` først.**
2. **Start appen og se på den** før du foreslår noe:
   `npm run tauri dev`. Kjør den i bakgrunnen.
3. **Foreslå før du utfører.** Vis retningen på én skjerm — Elever eller Økter
   er de beste prøveklutene, for de er tettest — og få den godkjent før du tar
   den gjennom resten.
4. **Små steg, med forklaring på norsk underveis.**
5. **Sjekk at du ikke har brukket noe:** `npx tsc --noEmit` og `npx vitest run`
   skal begge være rene. 73 tester skal fortsatt passere.
6. **Commit for hvert steg du er fornøyd med** — ikke bare til slutt:
   `git add -A && git commit -m "beskrivelse"`. Prosjektet ble satt under
   versjonskontroll rett før denne runden, med `før designrunde` som
   utgangspunkt. Hyppige commits er forskjellen på å kunne gå ett skritt
   tilbake og å måtte gå hele veien til start.
7. Gjør heller flere små endringer enn én bred. Utseendet vurderes med øynene,
   og da må det være mulig å se hva som forårsaket hva.

## 8. Hva som ikke er oppdraget

- Nye funksjoner eller skjermer
- Endringer i datamodell, spørringer, migrasjoner eller tastaturflyt
- Ikonbibliotek, komponentbibliotek eller andre nye avhengigheter uten å spørre
- Å gjøre appen om til et dashbord

> Motstå impulsen til å gjøre dette til et dashbord. Ingen kort med store tall,
> ingen grafer på forsiden, ingen sammendragswidget. Appen har én jobb om gangen.
> — SPEC.md §13
