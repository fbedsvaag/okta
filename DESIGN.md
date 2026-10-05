# Økta — designguide

Slik appen skal se ut og oppføre seg. Utdyper §13 i `SPEC.md`. Tokenene står
i `src/index.css`, og felleskomponentene i `src/ui/felles.tsx`.

**Skrevet om 05.10.2026** etter redesignrunden i Claude Design-lerretet
(«Økta — redesign»). Lerretet viser alle skjermene og er referansen når
noe her er uklart. Mye av dette er **bestemt, men ikke bygget ennå**. Det
står samlet i §13. Byggerekkefølgen står i `ARBEIDSLISTE.md` §5.

§13 i SPEC.md beskriver fortsatt den gamle retningen (Georgia, fargestreker,
trafikklys med form). Forslag til ny tekst ligger i
`docs/spec-forslag-2026-10-05.md`. Inntil eieren har bestemt seg, gjelder
denne fila for det visuelle.

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

**Skåringslista holder 28 px rader.** Tretti elever pluss tabellhode får
plass uten å rulle på en 14-tommer. Resten av appen har 34 px.

**Skåringen animeres aldri.** Tastetrykk → farge → neste elev er null
millisekunder. Animer navigasjon, aldri inntasting.

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
- I dag · Økter · Elever · Vurderinger · Samtaler · Klassekart, hver med
  snarvei til høyre: G D, G Ø, G E, G V, G S, G K
- «Fag i år»: fagfirkant, kode og navn. Klikk åpner faget
- Innstillinger (⌘,) nederst

Hovedflaten ligger som et hvitt ark ved siden av, 8–10 px fra kanten, med
radius 10 px. Verktøylinja øverst i arket.

**Visningsbryteren i Økter er Liste | Kalender.** Periodevisningen er tatt
bort. Kalenderen har sin egen bryter, Uke | Måned.

**Merkelapper** (piller) brukes der noe skal kunne tas i: periodene, fagfilter,
elevnavn i en gruppesamtale. Ikke som pynt.

**Fagfirkanten står i egen kolonne.** Der en tittel har fag over eller under
seg, står firkanten på linje med tittelen, og begge tekstlinjene starter på
samme sted. Firkanten skal ikke skyves inn i en tekstlinje.

**Kontekstmeny og søkevindu** legger seg over alt annet og lukkes med Esc
eller et trykk utenfor.

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
valgt punkt rgba(255,255,255,.88) med skygge, radius 10px
```

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
(22 px, tabulær), så fagfirkant og tittel, med fag, rom og periode på linja
under. «Notat fra forrige økt» er en sammenleggbar boks under tittelen,
med lister og avkrysning. Ingen oppsummeringssetning øverst — den gjentok
bare «Dagens økter». Så uka som kalender. Til høyre: gjøremål,
vurderingsfrister, elever som glipper (med lite heatmap).

**Økter — liste.** Fagfilter, søk, timeregnskap med en tynn stolpe delt på
periodene. Periodene står som filtre over lista (klikk = vis bare den).
Hver rad har perioden som merkelapp; marker rader og trykk P for å sette
periode. Temaet skrives rett i lista.

**Økter — kalender, måned.** Mandag–fredag med ukenummer, fast cellehøyde,
«+n til». Fridager, helligdager og hendelser med navn og tone (§4). Høyre
kolonne: skoleåret august–juni som heatmap (§4), måned for måned, til å
hoppe med.

**Økter — kalender, uke.** Timerutenett, rad for heldagshendelser, valgt økt
i et panel til høyre (dato, tid, rom, periode, vurdering; Åpne, Flytt,
Dupliser), og timer per fag den uka, med samtaletimer på egen linje.
Samtaledager viser timeplanen med elever, pause og lunsj.

**Økt — skåring.** Full skjerm, minimal ramme. Rad: markør, bilde,
navn (150–230 px), klasse, **notat fra denne økta**, plottet. N åpner
notatfeltet rett i raden; står markøren på en elev uten notat, vises
forrige økts notat i grå kursiv. Høyre kolonne: forrige økt, plan,
øktlogg, taster.

**Elevkort.** Navn (Light, 30 px), skoleår, klasse, fag. Heatmap per fag med
måned for måned, vurderingene rett under. Notater og møtelogg som tidslinje:
dato, prikk på en loddrett strek (fagfirkant for notater fra økta, lilla
prikk for møtelogg), kilde, tekst, avkrysning.

**Innstillinger.** Venstremeny i grupper: Vanlig (Generelt, Skoleår,
Utseende, Skalaer), Trygghet (Sikkerhetskopi, Personvern), Kollegaer (Del
oppsett), Sjelden i bruk (Kalenderstrøm, Kalenderserver, Arkiv). Hvert valg
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
- Løpende statistikk mens man skårer

## 13. Ikke bygget ennå

Bestemt 05.10, men ikke i koden. Rekkefølgen står i `ARBEIDSLISTE.md` §5.

- Geist lokalt, Light-overskrifter, Fira og Georgia ut
- Sidemenyen
- Glass, fargeteppe og bryteren i Utseende
- Seks paletter
- Helfylte trafikklys og det nye skåringsplottet
- Notat på raden i skåringslista
- Fagfirkant i stedet for fargestrek
- «I dag» med tid i egen kolonne og sammenleggbart notat
- Perioder som merkelapper, periodevisningen ut
- Årsheatmap og helligdagstone i kalenderen
- Ny ukevisning
- Innstillinger med venstremeny og grupper, tekststørrelse
- Ny oppsettveiviser og oppsettfila (`docs/oppsettfil.md`)
- Ny logo med glass (`src/assets/logo-glass*.svg`)
- Bevegelsesbryter, stagger og FLIP (fra før)
