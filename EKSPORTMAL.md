# Eksportmal — Obsidian

Guide for tekstarkivet appen skriver ut. Målet er at filene skal se ut som noe
et menneske har skrevet, ikke som en database dumpet til markdown.

Gjelder alle filene i eksporten: `README.md`, `elever/*.md`, `fag/*.md`,
`oppfolging.md`.

---

## 1. Sju regler

**1. Tabell bare når minst to kolonner varierer.** Én kolonne med data og tre
tomme er ikke en tabell — det er en liste med rammer rundt. Bruk punktliste
eller prosa i stedet.

**2. Aldri en tom kolonne.** Har ingen rad innhold i «Betydning», skal ikke
kolonnen skrives. Kolonner bestemmes av dataene som faktisk finnes, ikke av
hvilke felter tabellen har.

**3. Aldri en kolonne der alle verdiene er like.** «Teller: ja, ja, ja» sier
ingenting. Er det ett unntak, nevn unntaket i en setning under tabellen.

**4. Aldri interne verdier.** `rod`, `gul`, `gronn`, `skaring`, `vurdering`,
`teller_ikke` er databasens ord. Skriv «Rød», «Grønn», «skåring av økter»,
«teller ikke med».

**5. Datoer i prosa skrives ut.** «17. august 2026», ikke «2026-08-17». ISO
brukes i frontmatter og i tabellkolonner der de skal sorteres.

**6. Ingen tom seksjon.** Er det ingen oppfølgingspunkter, skriv «Ingen åpne
oppfølgingspunkter.» — ikke en overskrift med ingenting under.

**7. Ingen vurderende setninger.** Eksporten skal ikke kommentere. «MFL2 er så
vidt påbegynt» kan være sant i august og sårende i mars. Sorter heller tabellen
slik at leseren ser det selv.

## 1b. Farge i markdown

Markdown har ingen farge. Skåringen vises derfor med emoji, i to sett — samme
skille som i appen, der skåringsflyten har sirkler og heatmapet har kvadrater:

| Verdi | Enkeltskåring | Heatmap |
|---|---|---|
| Grønn | 🟢 | 🟩 |
| Gul | 🟡 | 🟨 |
| Rød | 🔴 | 🟥 |
| Ikke i økta | ⚪ | ⬜ |
| Ikke skåret | *(ingenting)* | *(ingenting)* |

**Sirkler** brukes der én skåring står for seg selv: en tabellcelle, en rad i en
øktoversikt, en enkeltoppføring.

**Kvadrater** brukes i den sammenhengende stripa — én rute per økt på rad. De
har ingen luft mellom seg og danner en ubrutt linje, som er nettopp det som gjør
en stripe lesbar som et forløp. Sirkler etterlater hull og leses som prikker.

Fire regler rundt dem:

**Emoji alene, overalt der en skåring vises.** Ingen ord ved siden av, ingen
tekst i parentes. En skåring er 🟢, ikke `🟢 Grønn`.

**Unntaket er forklaringen.** Nøkkelen i README skal ha både tegn og ord — det
er der leseren slår opp hva sirklene betyr, og uten den er eksporten uleselig
for noen som ikke har appen. Har elevfilene og fagfilene sin egen kortnøkkel,
gjelder det samme der.

**Ett oppslag, ikke ett per visning.** Emojiene slås opp fra `skalaverdi.farge`
på samme måte som hex-fargene i `src/ui/farger.ts` — samme sted, samme
mekanikk. Ingen visning skriver emojien selv.

**De bryter kolonnejustering.** Emoji er bredere enn tegnene rundt seg. En
skåringskolonne skal derfor inneholde bare sirkler, aldri sirkler blandet med
tekst eller tomme celler. Er en økt ikke skåret, står cella tom — ikke med en
strek eller en tekst.

**Femtrinnsskalaen mangler tegn.** Datamodellen har fem trinn — grønngul og
guloransje i tillegg til de tre. 🟠 dekker guloransje, men det finnes ingen
grønngul sirkel. Blir de tatt i bruk, må den falle tilbake på ord alene. Ikke
finn på en tilnærming som 🟢🟡 ved siden av hverandre; det leses som to
skåringer.

## 2. Frontmatter

Alle filer får YAML-frontmatter. Det er der det maskinlesbare hører hjemme — da
virker Obsidians egenskaper og Dataview, og selve teksten slipper å bære det.

```yaml
---
skolear: 2026/27
type: arkiv
elever: 13
fag: [KRØ, MFL1, MFL2]
start: 2026-08-17
slutt: 2027-06-20
eksportert: 2026-08-10
tags: [elevtracking, skolear/2026-27]
---
```

Elevfiler får `elev`, `klasse`, `fag`, `skolear`. Fagfiler får `fag`, `navn`,
`elever`, `okter`, `timer`, `arstimer`.

## 3. README.md — mal

````markdown
---
skolear: 2026/27
type: arkiv
elever: 13
fag: [MFL1, KRØ, MFL2]
start: 2026-08-17
slutt: 2027-06-20
eksportert: 2026-08-10
tags: [elevtracking, skolear/2026-27]
---

# Skoleåret 2026/27

Tretten elever fordelt på tre fag, fra 17. august 2026 til 20. juni 2027.

## Fag

| Fag | Navn | Elever | Økter | Timer |
| --- | --- | ---: | ---: | --- |
| [[mfl1\|MFL1]] | Markedsføring og ledelse 1 | 5 | 41 | 123 av 140 |
| [[kroe\|KRØ]] | Kroppsøving | 7 | 39 | 78 av 90 |
| [[mfl2\|MFL2]] | Markedsføring og ledelse 2 | 2 | 2 | 6 av 140 |

Elevtallene summerer til mer enn tretten fordi flere elever går i to fag.

## Hva skåringen betyr

Fargen er **innsats i den enkelte økta**, ikke en karakter.

- 🟢 **Grønn** — jobbet med det som var planlagt
- 🟡 **Gul** — delvis innsats, eller kom sent i gang
- 🔴 **Rød** — ikke i gang med faget denne økta
- ⚪ **Ikke i økta** — eleven var ikke der å vurdere. Teller ikke med noe sted.

I sammenhengende striper brukes kvadrater i stedet: 🟩 🟨 🟥 ⬜

## Vurderingsskalaer i bruk

- **Godkjent** — Ikke levert · Ikke godkjent · Godkjent
- **Karakter 1–6** — 1 til 6
- **Lav–middels–høy** — Lav · Middels · Høy

## Mappene

- `elever/` — én fil per elev, kronologisk
- `fag/` — årsplanen per fag, med skåringer og vurderinger som CSV
- `oppfolging.md` — oppfølgingspunkter

---

Skrevet ut av Økta 10. august 2026. Filene overskrives ved hver
eksport — rediger dem ikke. De kan leses uten appen.
````

### Hva som er endret, og hvorfor

- **Frontmatter** bærer det maskinlesbare. Overskriften trenger ikke lenger en
  linje med punktummer mellom tallene.
- **Fagtabellen er sortert etter aktivitet**, ikke alfabetisk. Da ser leseren
  selv at MFL2 er nettopp startet, uten at filen sier det.
- **Timer og årstimer er slått sammen** til «123 av 140». To kolonner der den
  ene bare er kontekst for den andre er én kolonne.
- **Tallkolonner er høyrestilt** med `---:`. Sifre som flukter leses raskere.
- **Skåringen har fått sirkler.** Se §1b — emoji og ord sammen, aldri emoji
  alene utenfor kompakte striper.
- **De fire skalatabellene er borte.** Trafikklyset er en punktliste med
  betydningen skrevet ut. Vurderingsskalaene er én linje hver — de har ingen
  farger, så de hørte aldri hjemme under «hva fargene betyr».
- **Forbeholdet er flyttet nederst** og kortet ned. Det er fotnote, ikke
  innledning.

## 4. Filer jeg ikke har sett

Reglene i §1 gjelder også `elever/*.md`, `fag/*.md` og `oppfolging.md`, men jeg
kjenner ikke formatet på dem. Vis meg én av hver etter at README er endret, før
du tar malen videre.

Fire ting å se etter i dem:

- **Elevfiler:** kronologien skal være lesbar som en historie, ikke som en
  logg. Grupper på fag og måned. En rad per økt der bare datoen og fargen
  varierer, hører hjemme som en kompakt linje eller en CSV — ikke som en tabell
  med tomme celler. Det er her sirkelstripa hører hjemme: én sirkel per økt,
  gruppert på måned, som en lesbar linje. Dette er heatmapet i tekstform, og
  det er det som gjør elevfilene lesbare uten appen. Bruk kvadratsettet her.
  Eksempel: `🟩🟩🟨🟩 ⬜🟩🟩🟥 🟩🟩🟩🟨`
- **Fagfiler:** skill tydelig mellom det som er plan og det som er registrert.
- **CSV-ene:** de er for maskiner. La dem være rå, og ikke prøv å gjøre dem
  pene — men nevn i fagfilen hva de inneholder.
- **oppfolging.md:** hvis den er tom, skal den si det i én setning.
