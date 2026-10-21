# Økta — designguide

Slik appen skal se ut og oppføre seg. Utdyper §13 i `SPEC.md`. Tokenene står
i `src/index.css`, og felleskomponentene i `src/ui/felles.tsx`.

**Lerretet er fasit.** Det som er tegnet i lerretet «Økta — redesign» per
06.10 er appens utseende (eieren). Markupen ligger i `docs/lerret/`. Er noe
her uenig med lerretet, gjelder lerretet — si fra, så rettes denne fila.

**Skrevet om 05.10.2026** etter redesignrunden i Claude Design-lerretet
(«Økta — redesign»), og **oppdatert 07.10** etter runde 13 (ARBEIDSLISTE
§10 og §11). Fila beskriver appen slik den er bygget; det som fortsatt
står igjen, står i §13.

Denne fila gjelder for det visuelle; §13 i SPEC.md viser hit. Den følger
appen og oppdateres sammen med den.

---

## 1. Hva appen er

En lokal desktop-app for én lærer i norsk videregående: planlegge året, skåre
elevene underveis, se eleven over tid. Den er lærerens eget arbeidsmateriale,
sett på i sekunder om gangen, i et lyst klasserom, ofte stående.

**Det skal se ut som et godt Mac-verktøy: rolig, tett og raskt å bruke med
tastaturet.** Tenk Things eller Linear, ikke et dashbord og ikke et produkt
som selges inn. Den skal også være enkel nok til at en kollega som aldri har
sett den kan sette den opp alene (§10, oppsettet).

## 2. Tre prinsipper

**Færrest mulig klikk.** Det som er kjent, fylles ut. Det som gjøres mange
ganger, kan gjøres på én gang: tema skrives rett i lista, perioder settes på
mange økter samtidig, serier legges inn samlet.

**Bredden brukes.** Tettheten er poenget, men tett betyr ikke trangt.
Kolonner får den bredden innholdet trenger; det som er til overs, går til
kolonnen med mest tekst (navn, tema, notat).

**Navn brekker aldri.** Et elevnavn står på én linje. Er det for trangt,
kuttes det med «…», og hele navnet står i verktøytipset.

## 3. Ufravikelig

**Null nettverkskall mens appen kjører.** Skriftene ligger i `public/fonts/`.
Ingen CDN, ingen `@import url()` mot nett.

**Skalafarger er data.** `skalaverdi.farge` lagrer et navn (`gronn`, `gul`,
`rod`), ikke en hex. Oppslaget skjer i `src/ui/farger.ts`.

**Skåringslista har 38 px rader med 28 px bilde** (bestemt 06.10; før
28 px). Lista ruller i arket og følger markøren, så den eleven du står på
alltid er synlig. Resten av appen har 34 px.

**Skåringen venter aldri på animasjonen.** Tastetrykk → farge → neste elev
skjer i samme øyeblikk i dataene; neste tast virker med en gang. Det som
beveger seg — markøren som glir, prikken som popper (§8) — er bare
visuelt, kan avbrytes midt i, og er av med redusert bevegelse.

**Innholdet er alltid tett.** Glass (§7) brukes bare på det som ligger over
eller ved siden av innholdet. Lister, tabeller, skåringslista, elevkortet og
årsplanen står alltid på hel, hvit (eller mørk) flate.

**Utskriften må virke.** Årsplanarket er lesbart i svart-hvitt og flyter over
så mange sider som trengs. `.ikkeutskrift` og `.kunutskrift` styrer hva som
kommer på papir. Utskriften er alltid lys og uten glass.

## 4. Farge

Nøytralene har et kjølig fiolett stikk framfor å være rent grå. Alt er tokens
i `@theme` i `index.css` — aldri hex i komponentene.

| Rolle | Token | Bruk |
|---|---|---|
| Blekk | `blekk` `#241f33` | Tekst |
| | `blekk-dempet` `#645d7a` | Sekundærtekst, etiketter |
| | `blekk-svak`, `blekk-svakest` | Hint, plassholdere |
| Flater | `bord` `#eceaf1` | Grunnen appen står på |
| | `ark` `#ffffff` | Hovedflaten, panel, felt |
| | `flate`, `flate-svak` | Hover, merkelapper |
| | `valgt` `#e3ddf0` | Valgt rad |
| Linjer | `linje`, `linje-medium`, `linje-svak`, `linje-sterk` | |
| Aksent | `aksent` `#4a3d7d` (+ `-mork`, `-dyp`) | Primærknapp, fokus, markør |
| Feil | `feil` `#b3261e`, `feil-flate` | Sletting, feilmeldinger, konflikt |

**Paletter.** Brukeren velger mellom seks under Innstillinger › Utseende.
En palett bytter bare `aksent`, `valgt` og `bord` (pluss fargeteppet, §7).
Blekk, linjer, trafikklys og fagfarger er like i alle.

| Palett | `aksent` | `valgt` | `bord` |
|---|---|---|---|
| Fiolett (standard) | `#4a3d7d` | `#e3ddf0` | `#eceaf1` |
| Skifer | `#3d5a80` | `#dde5f0` | `#e8ecf2` |
| Mose | `#4d6b3c` | `#e1ead8` | `#eaede5` |
| Rust | `#8a4a2a` | `#f0e0d6` | `#f1ebe6` |
| Fjord | `#2f6b6b` | `#d8ebe9` | `#e6eeed` |
| Grafitt | `#3a3a40` | `#e2e2e6` | `#ececee` |

Implementeres som `:root[data-palett="skifer"]` osv., på samme måte som mørk
modus. Hver palett trenger også mørke verdier.

**Trafikklyset er det eneste mettede i appen:** grønn `#3f9d49`, gul
`#d9a92f`, rød `#c04a3d`, «ikke i økta» `#d5d8dd` (lys grå). Se §9.

**Fagfarger** — tolv dempede blekkfarger (`FAGFARGER` i `farger.ts`). Vises
**som en liten firkant** (8 px i lister, 10–12 px ved titler, radius 2 px),
samme form som rutene i heatmapet og feltene i logoen. Aldri som strek i
venstremarg, aldri som flate. Unntak: øktene i kalenderen har en svak tone
i fagfargen (hex + `1c`) og fagkoden i fagfargen.

**Periodefarger** — åtte (`PERIODEFARGER` i `perioder.ts`). Vises bare på
merkelappen til perioden (prikk + svak tone, hex + `24`). Radene i øktlista
fargelegges ikke lenger.

**Kalendertoner:** ferie og fridager varm `#f3efe6`, helligdag (rød dag)
rosa `#f6e4df` med kant `#c98f80`, hendelse (skolen går) kjølig `#eaeef5`,
samtaledag hvit med aksentkant, økt i konflikt rød kant (`feil`).

**Heatmap for skoleåret** (kalenderens høyre kolonne): fem trinn etter hvor
mye som skjer en dag — `#f4f2f9`, `#e3ddf0`, `#c4b8e3`, `#9584c8`,
`#5e4f9e`. Bygger på aksenten, så det følger paletten.

## 5. Typografi

**Geist** til alt (SIL OFL), lagt lokalt i `public/fonts/` som Fira er i dag.
Fira Sans, Fira Sans Condensed og Georgia går ut. Georgia ble prøvd mot
Geist og passet ikke.

- **Store overskrifter (24 px og over): Geist Light (300)**, sperring
  −0,015 em. Det er dette som gir lettheten: datoen på «I dag», måned og uke
  i kalenderen, elevnavnet, tittelen på årsplanen, oppsettveiviseren.
- **Titler (17–19 px): Medium (500).** Økttitler, paneltitler.
- **Seksjonsoverskrifter: 15 px, 600, vanlig skrift.** Ikke versaler med
  sperring — det leste som mal. Versaler med sperring (`etikett`) brukes
  bare på kolonnehoder og små etiketter i sidekolonner.
- **Brødtekst og tabeller: Regular (400).**

**Tabulære sifre er bærende.** Alt som står i kolonner har `tabular-nums`.
Sjekk at fontfila til Geist har `tnum` før Fira fjernes.

Skala (ganges med `--tekst-skala`, som settes i Innstillinger › Generelt med
Mindre / Vanlig / Større):

| Token | px | Bruk |
|---|---|---|
| `mikro` | 11 | Kalenderruter |
| `etikett` | 12 | Kolonnehoder |
| `liten` | 13 | Hjelpetekst, skåringslista |
| `brod` | 15 | Brødtekst, tabeller |
| `medium` | 16 | Søkefelt |
| `tittel` | 19 | Paneltitler |
| `overskrift` | 26–32 | Skjermoverskrifter, Light |

## 6. Form og komponenter

**Radier:** 4 px på felt og knapper, 6 px på merkelapper og små flater,
10 px på hovedflaten, 22 px på glassflater (§7). Med glass på får knappene
i verktøylinja kapselform. ⌘K-vinduet har 26 px.

**Kontroller har felles høyde** (`KONTROLL`, 2,2 em).

**Knapper, fire roller:** `primar` (én per skjerm), `vanlig`, `stille`,
`farlig`. Spør alltid før noe slettes.

**Sidemeny til venstre** (erstatter menyraden øverst):

- Logo, «Økta» og skoleåret øverst
- Søk (⌘K) som felt
- I dag · Økter · Elever · Vurderinger · Samtaler, hver med snarvei til
  høyre: G D, G Ø, G E, G V, G S, G P (Plasser og grupper, med kartene som
  undermeny — SPEC §4.11)
- Innstillinger (⌘,) nederst

**Undermeny som følger skjermen** (valgt 06.10, «A» i lerretet). Sidemenyen
viser bare skjermene. Lister hører til en skjerm og står som innrykket
undermeny under den, med en tynn loddrett strek foran:

- under **Økter**: Alle fag og fagene i år (fagfirkant + kode), ⌘1–9 (⌘0 er zoom, 10.6)
- under **Samtaler**: trekningene (navn, fag og datoer) og «+ Ny trekning»

Undermenyen er alltid åpen under skjermen du står i. Under de andre
rulles den ut når musa holdes over punktet, etter 140 ms (så den ikke
blafrer når musa bare passerer). Punktet og undermenyen får da en felles
glassflate som vokser nedover: høyde, uskarphet (5 px → 0) og en liten
forskyvning går samtidig, 260 ms med `--ease-inn`. Ingen sprett. Med
redusert bevegelse åpnes den uten animasjon. Et klikk på selve
skjermpunktet gir skjermens oversikt (Samtaler: Planlagt · Utkast ·
Gjennomført).

Nederst i sidemenyen, over Innstillinger: **Gi tilbakemelding**, i samme
stil som Innstillinger-raden. Et klikk kopierer versjon, system og skjerm,
viser «Kopiert. Lim inn under «Versjon og skjerm».» i raden (12,5 px, grå,
kan bryte over to linjer) og åpner skjemaet litt over ett sekund etter.

Hovedflaten ligger som et hvitt ark ved siden av, 8–10 px fra kanten, med
radius 10 px. Verktøylinja øverst i arket.

**Får ikke skjermens knapper plass i verktøylinja**, toner høyre kant ut
(28 px) og en vinkelpil (⌄) kommer ytterst til høyre. Den bretter linja ut
over flere rader: kapselen blir et rundet rektangel (radius 24 px), det som
bryter står til venstre, og pila snur. Blir det plass igjen, legger linja
seg sammen og pila går. Ny skjerm: én rad.

**Visningsbryteren i Økter står i verktøylinja**, rett etter tittelen og på
samme sted i alle visningene. Uten fag: «Økter» og Liste | Kalender. Med et
fag valgt (fra undermenyen eller ⌘1–9): fagfirkant og kode som tittel, og
Oversikt | Økter | Kalender. Et fag i undermenyen åpner alltid Oversikt (fagsiden), også fra lista eller kalenderen.
Periodevisningen er tatt bort. Kalenderen har sin egen bryter, Uke | Måned.

**Merkelapper** (piller) brukes der noe skal kunne tas i: periodene, fagfilter,
elevnavn i en gruppesamtale. Ikke som pynt.

**Elevbilder der elever vises.** Har eleven bilde (fra InSchool), står det
som en rund miniatyr foran navnet overalt der et navn står: skåringslista
(20 px), elevlister og tabeller (20–24 px), «Elever som glipper», gjøremål
med elev, samtaletimeplanen og fordelingen, kalenderens samtaletimeplan,
⌘K-treff og elevkortet (56–72 px). Uten bilde vises en enkel illustrasjon
— jente, gutt eller nøytral etter `elev.kjonn` — i palettens farger: lys
grunn (`--pal-lys`), ansikt og kropp i mellomtone (`--pal-mid`), hår i
aksenten med 70 % dekning. Den bytter farge med paletten. Ikke initialer. Bildet går aldri ut av
appen (eksport, utskrift, CalDAV, oppsettfil).

**Vurderinger merkes med ikon foran tittelen.** 16 × 16, radius 4, gull
(`#c9922e`) med hvitt symbol: snakkeboble for muntlig, blyant for skriftlig.
Ikonet henger ut i margen, så titlene står på linje. Raden får en gyllen
strek (inset 3 px) til venstre. Kolonnen «Vurdering» viser bare typen.

**Skjermnavn i lenketekst står i kursiv:** «Åpne i *Samtaler* →».

**Tastestripe.** Der en flate har egne taster, står de i en tonet stripe
nederst (`#ece9f3`, 11–11,5 px, tastene i små rammer), med hovedknappen
til høyre i stripa. Ikke som egen tasteoversikt.

**Fagfirkanten står i egen kolonne.** Der en tittel har fag over eller under
seg, står firkanten på linje med tittelen, og begge tekstlinjene starter på
samme sted. Firkanten skal ikke skyves inn i en tekstlinje.

**Kontekstmeny og søkevindu** legger seg over alt annet og lukkes med Esc
eller et trykk utenfor. Menyene tegnes rett i `<body>`, så de aldri havner
under eller utenfor et ark.

**Nedtrekksmenyen** (`ui/Velger.tsx`, lerretet «Nedtrekk») erstatter alle
`<select>`. Feltet er 32 px, radius 7, hvitt med kant; vinkelpila snur med
S-kurven, og åpent får feltet aksentkant og en svak ring. Variantene liten
(26 px, i tabeller) og stille (uten ramme). Menyen er glass (hvit 94 %,
blur 22, radius 14), 6 px under feltet, eller over når det ikke er plass,
og kommer inn på 170 ms. Rader 30 px: hake i aksent på det valgte, prikk
eller fagfirkant, hint til høyre, grupper med versaletiketter, «Ingen …»
først og dempet, en handling nederst i aksent. Markøren glir med
S-kurven. Over åtte valg: søkefelt. Kontekstmenyene har samme glass, rader
og markør.

**Zoom.** ⌘+ og ⌘− skalerer hele vinduet i trinnene 80, 90, 100, 110, 125
og 150 %, ⌘0 tilbake til 100 %. Valget huskes. Står også i View-menyen
(Større, Mindre, Faktisk størrelse). Noe annet enn Tekststørrelse i
Innstillinger, som bare endrer teksten.

**Tomme tilstander** sier hva som mangler og har en knapp dit det fikses.

**Bolker legges sammen** med et klikk på overskriften (`ui/Sammenleggbar.tsx`).

**Notater skrives i markdown** (`src/ui/markdown.ts`), med samme lille utvalg
som før.

**Logo: Bolk med glass** (valgt 05.10). Tre stående felt som avtar i bredde
og styrke, på en avrundet plate — samme form som fagfirkanten og rutene i
heatmapet. Glasset er en lys innerkant på plata, lys kant på feltene og en
svak skygge under det brede feltet. Tre varianter i `src/assets/`: mørk
(hovedvariant og appikon), lys (felt i aksenten) og tonet (hvitt på mørkt,
for macOS sitt tonede utseende). Under 32 px tegnes den uten glass.

## 7. Glass

Sidepanelet, verktøylinja, ⌘K-vinduet og kontekstmenyer er gjennomsiktige
glassflater over et **fargeteppe** — store, uskarpe fargeflater i palettens
farger som ligger i selve appvinduet. Det er ikke macOS-glass, men CSS
(`backdrop-filter`) over et teppe appen tegner selv. Da trengs ingen native
kode, og det ser likt ut på alle maskiner.

**Aldri glass under innhold** (§3).

Oppskrift, lys:

```
sidepanel   background: rgba(255,255,255,.50)
            backdrop-filter: blur(28px) saturate(170%)
            border: 1px solid rgba(255,255,255,.75)
            box-shadow: inset 0 1px 0 rgba(255,255,255,.95),
                        0 10px 30px rgba(36,31,51,.14)
            radius 22px, 10px fra vinduskanten
verktøylinje background: rgba(255,255,255,.68), kapsel, flyter 10px inn
⌘K          background: rgba(255,255,255,.74), blur(40px) saturate(180%)
ark         background: rgba(255,255,255,.93), blur(22px) saturate(105%)
            (økta, notatvindu, samtalenotat), radius 24px, slør
            rgba(36,31,51,.20) bak
valgt punkt rgba(255,255,255,.88) med skygge, radius 10px
meny        background: rgba(255,255,255,.90), blur(30px) saturate(180%)
            kant rgba(255,255,255,.9), skygge 0 18px 44px rgba(36,31,51,.26),
            radius 14px (kontekst-, ⋯- og Del-menyer)
hover       rgba(255,255,255,.55), blur(12px) saturate(160%), lys innerkant;
            på hvit flate (menyer, Innstillinger) med en svak tone av aksenten
```

**Fargeteppet** er tre store, myke flater som i lerretet: lilla oppe til
venstre, blågrønn nede til venstre, lys lavendel oppe til høyre, dempet med
et lag i bordfargen. Andre paletter regner flatene ut fra aksenten. Flatene
er radialgradienter, ikke sirkler med `filter: blur`: WebKit klipper
uskarpheten i kanten og gir en skarp linje.

**Hvor det er glass:** sidemenyen, verktøylinja (48 px kapsel), ⌘K
(`.74`), menyene, hover-markøren og alle arkene (økta, elevkortet,
vurdering og fag, samtalenotatet).

Mørk: flatene er `rgba(42,36,58,.55)` (sidepanel), `rgba(40,35,54,.72)`
(verktøylinje), `rgba(36,31,50,.80)` (⌘K), kant `rgba(255,255,255,.12)`.

**Lesbarhet:** sekundærtekst på glass er mørkere enn ellers (`#4b4560` i
stedet for `blekk-dempet`), fordi den vanlige gråtonen blir for svak.

**Glass kan skrus av** i Innstillinger › Utseende (På / Av). Av gir tette
flater (`#f3f1f7` / mørk `#1e1a29`) og fjerner teppet. Står «Reduser
gjennomsiktighet» på i macOS (`prefers-reduced-transparency`), er glass av
uansett hva som er valgt.

## 8. Dybde og bevegelse

Tre skyggenivåer: `shadow-lav`, `shadow-panel`, `shadow-ark`.

**Ark som glir.** Velger du en økt, en elev, en vurdering eller et fag,
legger kortet seg som et ark over lista. Ark over ark: arket under skyves
32 px mot venstre, krymper til 98 % og dempes. Lukk, «Tilbake» og Esc går
ett nivå tilbake. Ett felles sted: `src/ui/Arkstabel.tsx`.

**Et ark lukkes med samme bevegelse som det åpnes, baklengs.**

**Inngang uten sprett** (`useInngang` i `ui/bevegelse.ts`). Ark, elevkort,
⌘K, samtalenotatet og menyene monteres i starttilstand, én frame går, og så
glir de over til sluttilstanden med en vanlig overgang. Ingen keyframes og
ingen S-kurve på det som kommer til syne. Glass tones **aldri** med
`opacity`: WebKit tegner ikke uskarpheten mens noe har opacity under 1, og da
blinker det. Bakgrunn, kant, skygge og innhold tones i stedet, og sløret bak
tones med fargen.

```
--tid-inn     180ms
--tid-ut      130ms
--tid-markor   90ms   markør med piltaster (aldri med talltaster)
--ease-inn    cubic-bezier(.2, .9, .25, 1)
--ease-ut     cubic-bezier(.4, 0, .9, .4)
```

**Nå-streken** i uka viser klokka: lilla med prikk og klokkeslett i dagens
kolonne, stiplet resten av uka.

**Bevegelse** kan settes til På / Dempet / Av i Innstillinger › Utseende,
med `prefers-reduced-motion` som utgangspunkt.

**Markør som glir.** Der en markør flytter seg i en liste (skåringen,
utfoldet økt), er den én flate som glir, ikke en bakgrunn som hopper fra rad
til rad: 340 ms, `--ease-sprett: cubic-bezier(.34,1.32,.5,1)` — S-kurve med
et lite overskudd. Det som settes, «popper» kort (skala .4 → 1.18 → 1,
380 ms). Aldri mer enn det. Av med redusert bevegelse.

Samme kurve brukes overalt der noe flytter seg (lerretet: `Bevegelse`):
valgt punkt i sidemenyen glir, og undermenyen åpner seg (høyde, 420 ms);
tommelen i alle brytere (Liste | Kalender, Uke | Måned, Plasser | Grupper,
Fordel etter) glir under teksten; markøren i ⌘K, øktlista, elevlista og
samtaletimeplanen glir med piltastene; ved «Stokk på nytt» glir elevene til
de nye plassene (560 ms, 18 ms etterslep per plass, låste står stille).
Rader som gjør plass når man drar i samtaletimeplanen, glir 240 ms med
`cubic-bezier(0.2, 0.8, 0.2, 1)`, og kortet som slippes glir fra der det
ble sluppet til plassen sin. Klokkeslettet på kortet ruller tegnvis
(`ui/Ticker.tsx`, `--tid-inn`).
**All dra og slipp i appen skal føles likt med samtaletimeplanen** (bestemt
14.10): det som dras er et hvitt kort med skygge som følger pekeren uten
forsinkelse, naboer gjør plass når kortet dekker 30 % av dem (240 ms,
`cubic-bezier(0.2, 0.8, 0.2, 1)`), kortet glir på plass ved slipp, ingen
tekstmarkering, og ingen hopp eller blink. Én felles mekanikk i `src/ui/`,
ikke en ny variant per skjerm: `ui/dra.ts`, brukt i samtaletimeplanen og
øktplanen (tidslinjen og lista). Grupper og klassekart står igjen.
Aldri på tekst som skrives, scrolling eller tall som endres.

**Hover er én glassflate som glir** (`ui/Hovermarkor.tsx`), 220 ms med
`--ease-sprett`, fra punkt til punkt: i sidemenyen med undermenyene, i alle
menyer, i Innstillinger og på radene i Elever. Kommer musa inn utenfra,
står flaten der med en gang og tones fram; går den ut, tones den bort.

## 9. Trafikklyset

**Alle symbolene er helfylte.** Grønn, gul og rød er fylte sirkler i
skåringslista og fylte, avrundede kvadrater i heatmapet.

| Verdi | Tegnes som |
|---|---|
| Grønn | fylt, `lys-gronn` |
| Gul | fylt, `lys-gul` |
| Rød | fylt, `lys-rod` |
| Ikke i økta | fylt, lys grå (`lys-borte`) |
| Ikke skåret | ingenting |

Dette erstatter den gamle regelen om fylt / halvfylt / ring. Formen bærer
ikke lenger betydningen, så andre ting må gjøre det:

- **Fast plassering i skåringslista.** Plottet til høyre har alltid rekkefølgen
  rød · gul · grønn · ikke i økta. Valgt verdi står i full styrke, de andre
  er nesten usynlige (18 %).
- **Verktøytips med navn** på hver rute i heatmapet.
- Gul er klart lysest av de tre, så rød og grønn kan skilles på lyshet.

En økt ingen er skåret i, er et hull i heatmapet.

## 10. Skjermene

**I dag.** Datoen (Light, 32 px). Under: «Dagens økter» — tid i egen kolonne
(22 px, tabulær), så fagfirkant og tittel, med fagkode, rom og periode på
linja under (ikke fagnavnet). «Notat fra forrige økt» er en sammenleggbar boks under tittelen,
med lister og avkrysning. Ingen oppsummeringssetning øverst — den gjentok
bare «Dagens økter». Så uka som kalender, med tidsakse og nå-strek; tiden
som har gått i dag har dempede fagfarger (ikke grått). Timeregnskapet:
per fag en stolpe mot årstimetallet, der det planlagte står i en lys tone
av fagfargen, det som er holdt til nå i full farge, og en strek der man
står. Streken flytter seg minutt for minutt, også midt i en økt. Til høyre:
gjøremål med en sammenleggbar logg over det som er gjort siste 14 dager,
vurderingsfrister (bare de som ikke er ferdig ført), elever som glipper
(samme regel som Elever: minst to røde av de fem siste; lavest snitt
først; tom: «Ingen elever glipper nå»). Nederst over hele bredden:
**Innsats over tid** (lerretet `InnsatsTid`), forklaringen «Fravær».

**Økter — liste.** Fagfilter, søk, timeregnskap med en tynn stolpe delt på
periodene. Periodene står som filtre over lista (klikk = vis bare den).
Hver rad har perioden som merkelapp; marker rader og trykk P for å sette
periode. Temaet skrives rett i lista.

**Økter: kalender, måned.** Alle månedene i skoleåret står under hverandre
i én liste som ruller. Mandag til fredag med ukenummer, fast cellehøyde,
«+n til». Hver økt er en brikke i to linjer (lerretet «KalenderTitler»):
fagkode i fagfarge og klokkeslett dempet, så tittelen i inntil to linjer;
radius 5, svak fagtone, «FAG · 08:30 · tittel» i verktøytipset.
Mentorsamtaler på én linje. Dagens dato i et aksentfarget merke, også i
uka. Fagbrikkene øverst til høyre (ett per fag og Mentorsamtaler) skjuler
og viser et fag i uke, måned og heatmap; valget huskes. Fridager, helligdager og hendelser med navn og tone (§4).
Månedsnavnet i toppen følger rullingen. Høyre kolonne: skoleåret
august til juni som heatmap (§4), der måneden som er synlig er markert, og
et klikk ruller dit.

**Økter — kalender, uke.** Timerutenett, rad for heldagshendelser, valgt økt
i et panel til høyre (dato, tid, rom, periode, vurdering; Åpne, Flytt,
Dupliser), og timer per fag den uka, med samtaletimer på egen linje.
Samtaledager viser timeplanen med elever, pause og lunsj.

**Fagsiden (Økter › Oversikt).** Fagnavn (Light, 32 px), og under: klasser,
antall elever, rom, faste tider og lenke til læreplanen hos Udir. Tre kort:
Timer (holdt mot årstimetall, stolpe per periode, «I rute» eller «Bak» mot
jevnt tempo), Neste økter og Kommende vurderinger. «Klassen, økt for økt»:
elever mot de siste 16 øktene, sortert etter snitt. «Elevene nå» (siste 6
økter): Går godt og Trenger oppfølging, og under dem fravær mot
10 %-grensen. Kompetansemål med én strek per økt som dekker målet, og
Dekket, Påbegynt eller Ikke ennå. Logg: øktloggene som tidslinje med
fordelingen av skåringene til høyre. Bare visning; alt åpnes som ark.
«Rediger fag» i verktøylinja.

**Økta: to moduser i samme ark** (§7, «ark»), med bryteren Skåring og logg
| Planlegging øverst til høyre. Fra I dag åpner den i skåring; ellers etter
tidspunktet: fram i tid i planlegging, pågår eller ferdig i skåring. Topp
med luft: fagfirkant, kode i fagfarge, tittel (Light, 28 px), et merke for
når økta er («om 3 dager», «Pågår · n min igjen», uten pulserende prikk),
esc og en liten
Ferdig-knapp (28 px, ⌘↵). Under: naturlig dato · tid · rom · periode og
bryteren. ⌘← og ⌘→ blar til forrige og neste økt i faget.

**Økta: skåring og logg.** Over lista «n av 28 skåret» med tynn
fremdriftslinje. Rad (38 px): markør, **trafikklyset**, bilde (28 px), navn,
klasse, notat fra denne økta. Trafikklyset står først, så blikket ikke må
hoppe ut til høyre kant. N åpner notatfeltet i raden; uten notat vises
forrige økts notat i grå kursiv. Høyre kolonne: «Fra forrige økt · tor
1.10», Plan, Øktlogg. Tastene i stripa nederst.

**Økta: live** (lerretet «OktLiveVertikal», `skjermer/Oktlive.tsx`). Med
Øktplan: Full, den dagen økta er, blir planen i høyre kolonne (360 px) en
loddrett tidslinje på 480 px: klokkeslett til venstre, ett felt per
aktivitet med høyde etter minuttene, strek ved øktas slutt og nå-markøren
tvers over med klokkeslettet i en aksentpille. Ferdige felt tonet, pausen
skravert, den aktive med aksentkant, fylt ovenfra etter hvert som tida
går, og «+5 min» nederst. Over: «5 min forlenget · siste går 5 min over»,
«Starter om 12 min · Først: …» eller «Ferdig 10:00 · 3 av 4 aktiviteter
krysset av». Avkrysning når tida er ute (lysere hake) eller med et klikk
(mørk hake; neste starter). Det som havner etter slutt, står tonet. Aldri
rødt. Oppdateres ved hvert minuttskifte, uten overgang. Den vannrette
stripa (lerretet «OktLive») ble bygget først og erstattet 14.10. Med
Enkel står det én linje under arkhodet, og planen er en vanlig liste.

**Økta: planlegging** (lerretet «OktPlanNy», `skjermer/Oktplan.tsx`).
Faktaraden på én linje med etiketter over: dato, tid, rom, periode og
vurdering; lekse og agenda i to kolonner under. Plan med summen i
overskriften («90 av 90 min · går opp»), en 48 px tidslinje (felt med
bredde etter minuttene, pause skravert, luft stiplet, strek ved slutt,
klokkeslett hvert kvarter) og lista under: ⋮⋮, starttid, tittel, − / + i
steg på fem, ▸ for beskrivelsen. Man drar i skillet for å flytte tid, i
enden for å gi eller fylle luft, og feltene eller ⋮⋮ for å stokke om.
Pauser står fast til de er valgt. «30 min» åpner lengdevalget. Øktas
lengde er et tak: blir et punkt lengre enn luften rekker, tas tiden fra den
lengste andre aktiviteten (ned til 5 min; pauser og ferdige punkter røres
ikke). Bare når økta selv er gjort kortere, kan planen stå over; da sies
det i vanlig blekk med «Trekk N min fra …». Øktas lengde endres aldri. Kompetansemålene er foldet til valgte og periodens
mål, med «Vis alle 17 ▾».

**Øktplan: Enkel | Full** (Innstillinger › Generelt, standard Enkel,
lerretet «OktPlanEnkel»). Enkel er en ren liste med minutter og en 6 px
stolpe uten tekst; «Film · 15 min» kan skrives inn. Ingen dra, ingen egen
pausetype, beskrivelser skjult men beholdt, kompetansemålene på én linje
og vurderingen ute av faktaraden. Høyre: fra forrige
økt, «Følg opp i økta» (rød to ganger på rad, borte sist, åpent
oppfølgingspunkt; bare fornavn og grunn, aldri hva et notat sier) og hvor i
perioden økta ligger. Planen lagres som markdown i `okt.plan`
(«- [ ] Tekst · 10 min», beskrivelsen innrykket under, «- Pause · 10 min»,
«· +5 min» og «· ferdig 09:16»), så den samme lista står i skåringen.

**Utfoldet økt i øktlista** (variant F): to spalter — fakta til venstre,
plan og forrige notat til høyre — og tastestripa nederst med «Åpne økta ↵».

**Elever.** Søk, «Lim inn liste» og «Ny elev» i verktøylinja. Gruppering
Klasse | Fag | Alfabetisk (huskes) og filterpiller for fagene, «Uten fag»
og Mentorelever. Rad (46 px): bilde (30 px), **fornavn** og etternavn, M for
mentorelev, klasse, fag med fagfirkant, innsatsen de siste ti øktene som
ruter, fravær i prosent med en liten stolpe mot 10 % (grå, gul fra 7,5 %,
rød over 10 %) og rød prikk når eleven glipper (to røde blant de fem siste).
Hover glir. Klikk åpner elevkortet, og det er der eleven endres. Klassene
ligger bak ⋯.

**Elevkort.** Et ark i stabel som glir inn fra høyre over det du kom fra.
Bilde eller plassholder (76 px), navn (Light, 32 px), skoleår, klasse, fag,
og kjønn som en liten bryter (gjettet vises stiplet). Høyre spalte: åpne
oppfølginger, klassekart, og «Fravær i år»: én rad per fag med prosent,
stolpe mot 10 %-grensen, «9 av 24 økter · 15,8 t» og merket (Halvveis, Nær
grensen, Over grensen), og en fotnote om at InSchool er fasit. Kjønn står
alltid, også når det ikke er satt. Heatmap per fag med
måned for måned, vurderingene rett under. Heatmapet i elevkortet er kvadratiske ruter, hele
skoleåret på én linje per fag, uke for uke i felles kolonner; kommende
økter som tomme ruter. Notater og møtelogg som tidslinje:
dato, prikk på en loddrett strek (fagfirkant for notater fra økta, lilla
prikk for møtelogg), kilde, tekst, avkrysning.

**Årsplanen på papir** (`skjermer/Arsplan.tsx`, lerretet «ArsplanPdf1–3»).
A4-sider. Side 1: logo, «Årsplan · skoleåret», sist oppdatert; fagkode i
fagfarge og fagnavn (Light, 38 px); faglærer, rom og tid til høyre; en
timeboks med stolpe per periode; «Om faget i år» og nummererte
kompetansemål med lenke til Udir. Tabell: Uke · Dag · Dato · Tema · Lekse ·
Vurdering, perioder som overskrifter med prikk, uker, økter, timer og
«Mål 1, 2, 4»; vurderinger med gullikon i margen og tonet rad; ferier i
kursiv. Neste sider: smal topplinje og «<periode> fortsetter». Nederst
«Årsplan <fag> · skoleåret» og «Side n av N». Radene har fast høyde (22 px,
lang tekst kuttes), så sidene deles i `data/arsplansider.ts`.

**Innstillinger.** Venstremeny i grupper: Vanlig (Generelt, Skoleår,
Utseende, Skalaer), Trygghet (Sikkerhetskopi, Personvern), Kollegaer (Del
oppsett), Sjelden i bruk (Kalenderserver, Arkiv). Hvert valg
er en rad med etikett til venstre og kontroll + hjelpetekst til høyre.
Hjelpeteksten er hverdagsspråk.

**Samtaletrekkeren.** De planlagte trekningene står i sidemenyen under
Samtaler. Verktøylinja har trekningens navn og eksporten (Teams, markdown,
utskrift, slett). Til venstre oppsettet i én kolonne med blokker; til høyre
resultatet med Timeplan | Fordeling | Alfabetisk. Er det for få plasser,
står et gult varsel øverst som sier hvem som mangler tid. Hver dag har
overskrift i Light (22 px) med tid og antall. Raden: plass, tid, navn,
oppgavenummer som liten rute i temafargen, tema, merknad i vanlig grå tekst
(«tidlig 2× på rad»), lås og «møtte ikke» som ikonknapper. Møtte ikke gir
gjennomstreket navn og tonet rad. Lunsj som egen, tonet rad. Temafargene er
svake pastelltoner, bare til å kjenne igjen oppgaven.

**Dra i timeplanen.** Klokkeslettene hører til plassene og står fast i sin
kolonne; bare elevene glir. Raden som dras er et hvitt kort med skygge, og
har sitt eget klokkeslett (aksent, medium) som viser tida på plassen den er
over; sifrene som endres, ruller som et telleverk (opp når tida øker).
Klokkeslettet under plassen kortet er over, skjules. En nabo gjør plass når
kortet dekker 30 % av den; mellom dager avgjør midten av kortet. Ingen
tekstmarkering mens det dras.

**Førstegangsoppsett.** Eget vindu med stegene til venstre: Velkommen ·
Skoleåret · Fagene dine · Elevene · Ferdig. Større tekst (15–17 px) enn
resten av appen. Første steg tilbyr oppsettfil fra en kollega (anbefalt)
eller å sette opp selv. Alt lagres med en gang; «Fortsett senere» alltid
synlig. Duplikater spørres om med «Ja, samme elev / Nei, en annen» og kan
angres.

## 11. Mørk modus

Samme tokens med andre verdier, i `index.css` under `:root[data-tema="mork"]`.
Valget står i Innstillinger: som macOS, lys eller mørk. Aksenten er lys
(`#b3a6ec`) og tekst på aksentflater er mørk (`text-ark`). Fagfarger lysnes
gjennom `fagfarge()`. Trafikklyset har egne mørke verdier. Glass har egne
mørke verdier (§7), og fargeteppet er dempet.

## 12. La være

Prøvd eller vurdert, og valgt bort. Står her så det ikke dukker opp igjen.

- Inter, `system-ui` eller Roboto som gjennomgående skrift
- **Georgia eller annen serif i overskrifter** (prøvd 05.10, passet ikke med Geist)
- **Tynn fargestrek i venstremarg** for fag (leste som KI-mal)
- **Versaler med sperring på seksjonsoverskrifter**
- **Halvfylte og ringformede trafikklys** (erstattet av helfylte)
- **Egen periodevisning som tidslinje** (perioder er merkelapper)
- **Oppsummeringssetning over «Dagens økter»**
- Kremhvit grunn med terrakotta-aksent
- Gradienter som pynt. Fargeteppet bak glass er det eneste unntaket
- Emoji som ikoner
- Store tall som «stat-kort», grafer på forsiden
- Tailwinds standardpalett som identitet
- Luftig midtstilt layout der innholdet ikke bruker bredden
- Løpende statistikk mens man skårer (fremdriften «n av 28 skåret» er ikke
  statistikk og er med)
- **Initialer som erstatning for elevbilde** (byttet til illustrasjon 06.10)
- **Grå for passert tid** (byttet til dempede fagfarger 06.10)
- **Emoji for muntlig/skriftlig** (egne ikoner)

## 13. Ikke bygget ennå

Alt fra redesignet 05.10 og runde 7 til 13 er bygget. Det som står igjen:

- Masseredigering i Elever: merke flere elever og endre fag, klasse eller
  mentor på alle samtidig, eller slette. Skal tegnes i lerretet først.
- Klassekart med farge per gruppe, plasser fra gruppene og logg over
  tidligere kart (tegnes i neste runde).
- Vurderinger som kalender (tegnes i neste runde).
- Mørk modus for det nye fra runde 7 til 13 (avventer).
- Stagger og FLIP (fra før).
