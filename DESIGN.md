# Økta — designguide

Hvordan appen ser ut og oppfører seg, slik det er valgt. Erstatter §13 i
`SPEC.md`; er de uenige, gjelder denne. Tokenene står i `src/index.css`,
felleskomponentene i `src/ui/felles.tsx`.

Guiden var til 30.09.2026 et designoppdrag («foreslå tre paletter …»). Den er
nå skrevet om til det som faktisk er bestemt. Står noe under «Ikke bygget
ennå», er det fortsatt retningen — ikke noe som finnes.

---

## 1. Hva appen er

En lokal desktop-app for én lærer i norsk videregående: planlegge året, skåre
elevene underveis, se eleven over tid. Den er lærerens eget arbeidsmateriale,
sett på i sekunder om gangen, i et lyst klasserom, ofte stående.

**Det skal se ut som et skjema — bare skarpere, og med lag som beveger seg.**
Ikke et dashbord, ikke et produkt som selges inn.

## 2. Tre prinsipper

**Færrest mulig klikk.** Det som er kjent, fylles ut. Det som gjøres mange
ganger, kan gjøres på én gang: tema skrives rett i lista, perioder males over
mange økter, serier legges inn samlet.

**Bredden brukes.** Tettheten er poenget, men tett betyr ikke trangt. En
tabell skal ikke klemme kolonnene sammen mens halve skjermen står tom til
høyre. Kolonner får den bredden innholdet trenger; det som er til overs, går
til den kolonnen som har mest tekst (navn, tema).

**Navn brekker aldri.** Et elevnavn står på én linje — også dobbeltnavn som
«Anne-Marie Holm Johansen». Er det for trangt, kuttes navnet med «…», og hele
navnet står i verktøytipset. En rad som blir to linjer høy, ødelegger rytmen i
hele tabellen.

## 3. Ufravikelig

**Null nettverkskall mens appen kjører.** Skriftene ligger i `public/fonts/`
og lastes fra disk. Ingen CDN, ingen `@import url()` mot nett.

**Skalafarger er data.** `skalaverdi.farge` lagrer et navn (`gronn`, `gul`,
`rod`), ikke en hex. Oppslaget skjer i `src/ui/farger.ts`.

**Skåringslista holder 28 px rader.** Tretti elever pluss tabellhode får
plass uten å rulle på en 14-tommer. Den bruker `text-liten` for å holde
tettheten; resten av appen har luftigere rader (34 px).

**Skåringen animeres aldri.** Tastetrykk → farge → neste elev er null
millisekunder. Animer navigasjon, aldri inntasting.

**Utskriften må virke.** Årsplanarket (§4.9) er lesbart i svart-hvitt og
flyter over så mange sider som trengs. `.ikkeutskrift` og `.kunutskrift` i
`index.css` styrer hva som kommer på papir.

## 4. Farge

Nøytralene har et kjølig fiolett stikk framfor å være rent grå. Alt er tokens
i `@theme` i `index.css` — aldri hex i komponentene.

| Rolle | Token | Bruk |
|---|---|---|
| Blekk | `blekk` `#241f33` | Tekst |
| | `blekk-dempet` `#645d7a` | Sekundærtekst, etiketter |
| | `blekk-svak`, `blekk-svakest` | Hint, plassholdere |
| Flater | `bord` `#eceaf1` | Grunnen appen står på |
| | `ark` `#ffffff` | Kort, panel, felt |
| | `flate`, `flate-svak` | Hover, merkelapper, månedsoverskrifter |
| | `valgt` `#e3ddf0` | Valgt rad, aktiv fane |
| Linjer | `linje`, `linje-medium`, `linje-svak`, `linje-sterk` | Referansen er linjert papir |
| Aksent | `aksent` `#4a3d7d` (+ `-mork`, `-dyp`) | Primærknapp, fokus, aktiv fane |
| Feil | `feil` `#b3261e`, `feil-flate` | Sletting, feilmeldinger |

**Trafikklyset er det eneste mettede i appen**, i en roligere variant:
grønn `#3f9d49`, gulgrønn `#8ba33e`, gul `#d9a92f`, oransje `#cf7a35`,
rød `#c04a3d`, «borte» `#b6bcc4`. Formen bærer betydningen sammen med fargen
(§8).

**Fagfarger** — tolv dempede blekkfarger (`FAGFARGER` i `farger.ts`). Vises
som 3 px strek i venstremarg og som prikk ved fagkoden. Aldri som flate.

**Periodefarger** — åtte (`PERIODEFARGER` i `perioder.ts`), tydelig ulike
fagfargene. Vises som en svak tone over hele raden (hex + `1f`, ca. 12 %
dekning) og som prikk på penselen. Tonen skal leses som fargelegging, ikke
som et varsel.

## 5. Typografi

**Fira Sans** til UI og brødtekst, **Fira Sans Condensed** der bredde er
knapp (`font-smal`). Begge under SIL OFL, lokalt i `public/fonts/`.
**Georgia** til overskrifter (`font-display`) — en serif i toppen mot sans i
tabellene gir hierarki uten å gjøre tabelldata tyngre. Georgia ligger på
maskinen og koster ingen fontfil.

**Tabulære sifre er bærende.** Fira har ulik sifferbredde som standard. Alt
som står i kolonner — datoer, klokkeslett, timer, antall — har
`tabular-nums`.

Skala (ganges med `--tekst-skala`, som settes i Innstillinger):

| Token | px | Bruk |
|---|---|---|
| `mikro` | 11 | Kalenderruter |
| `etikett` | 12 | Kolonnehoder, seksjonsetiketter — versaler med sperring |
| `liten` | 13 | Hjelpetekst, skåringslista |
| `brod` | 15 | Brødtekst, tabeller |
| `medium` | 16 | Søkefelt, fremhevet |
| `tittel` | 19 | Paneltitler |
| `overskrift` | 24 | Skjermoverskrifter |

## 6. Form og komponenter

**Radier er små:** 3 / 4 / 6 px (`liten`, `vanlig`, `stor`). Et skjema, ikke
kort med runde hjørner.

**Kontroller har felles høyde** (`KONTROLL`, 2,2 em): knapper, felt og
nedtrekkslister på samme verktøylinje flukter.

**Knapper, fire roller:**
- `primar` — aksentfylt. Én per skjerm, det man er der for («+ Ny økt»).
- `vanlig` — hvit med kant.
- `stille` — uten kant, til det sekundære.
- `farlig` — rød tekst, til sletting. Spør alltid før noe slettes.

**Menyen** er én rad: I dag · Økter · Elever · Vurderinger · Samtaler · Fag,
og til høyre Søk (⌘K), skoleåret, Innstillinger. Ingen underfane-rader.

**Visningsbryteren** (Liste | Kalender | Perioder) er en segmentert kontroll
først i verktøylinja. Visningene den bytter mellom har samme bredde, så den
står på samme sted — ingenting hopper.

**Merkelapper** (piller) brukes sparsomt, der noe skal kunne tas i: pensler
for perioder, elevnavn i en gruppesamtale som kan dras. Ikke som pynt.

**Kontekstmeny og søkevindu** er ark over alt annet, med `shadow-ark`. De
lukkes med Esc eller et trykk utenfor.

**Tomme tilstander** sier hva som mangler og har en knapp dit det fikses.

## 7. Dybde og bevegelse

Tre skyggenivåer: `shadow-lav` (kort), `shadow-panel` (panel),
`shadow-ark` (det som legger seg over). Dybde, ikke dekorasjon.

**Ark som glir.** Velger du noe i en liste, glir panelet inn fra høyre og
lista trekker seg sammen til en tredjedel. Navigasjonen er dybde, ikke
sidebytte. Unntak: elevkortet åpnet fra søket dekker hele bredden, uten
lista — der er lista bare forstyrrende.

**Ark over ark — kortlogikken.** Åpner du noe fra et panel eller et kort —
en elev fra en økt, en økt fra en elevs heatmap, en økt fra forsiden eller
kalenderen — legger det seg som et nytt ark over det du sto i. Du blir på
siden du var på. Arket under skyves 32 px mot venstre, krymper til 98 % og
dempes, så kanten stikker fram og lagene kan leses. Lukk, «Tilbake», Esc
eller et klikk utenfor tar deg ett nivå tilbake — ikke helt ut. Én felles
stabel (`src/ui/Arkstabel.tsx`) gjør dette for hele appen.

```
--tid-inn     180ms   panel inn
--tid-ut      130ms   ut — alltid raskere enn inn
--tid-markor   90ms   markør med piltaster (aldri med talltaster)
--ease-inn    cubic-bezier(.2, .9, .25, 1)
--ease-ut     cubic-bezier(.4, 0, .9, .4)
```

**Rulling skal være myk og treffe riktig.** Horisontal bla (uka på «I dag»)
bruker `scroll-snap`, så den alltid lander på en hel uke. Lister åpner der det
er naturlig å begynne — øktlista på dagens dato.

## 8. Trafikklyset

Farge alene er ikke nok — verken for fargesyn eller på avstand:

| Verdi | Form |
|---|---|
| Grønn | fylt sirkel |
| Gul | halvfylt sirkel |
| Rød | tom sirkel, tykk ring |
| Ikke i økta | tomt omriss, tynn strek |
| Ikke skåret | ingenting |

I heatmapet er de avrundede kvadrater. «Ikke i økta» er alltid tom, aldri
farge. En økt ingen er skåret i, er et hull.

## 9. La være

- Inter, `system-ui` eller Roboto som gjennomgående skrift
- Kremhvit grunn med terrakotta-aksent
- Gradienter
- Emoji som ikoner — symbolene i `Ikon` er tegnet og arver fargen
- Store tall som «stat-kort», grafer på forsiden
- Tailwinds standardpalett (`slate-500`, `zinc-100`) som identitet
- Luftig midtstilt layout der innholdet ikke bruker bredden (§2)

## 10. Ikke bygget ennå

- **Bevegelsesbryter** i Innstillinger (På / Dempet / Av), med
  `prefers-reduced-motion` som utgangspunkt.
- **Stagger** når lister lastes (12 ms per rad, maks ti rader).
- **FLIP** når rader flyttes.
- **Mørk modus.** Lav prioritet; klasserom er lyse.
