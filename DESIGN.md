# Elevtracking — designoppdrag og merkevareguide

Denne fila erstatter både `DESIGNOPPDRAG.md` og tidligere `DESIGN.md`, og
erstatter §13 i `SPEC.md`. Er de uenige, gjelder denne.

Den er skrevet så den kan leses av noen som aldri har sett prosjektet.

---

## 1. Hva appen er

En lokal desktop-app for undervisningsplanlegging og elevoppfølging. Tauri 2 +
SQLite + Vite/React/TypeScript + Tailwind 4. Bygget av én lærer i norsk
videregående skole, til eget bruk.

Den er lærerens eget arbeidsmateriale. Ikke et rapporteringssystem, ikke et
dashbord, ikke et produkt som skal selges inn. Den blir sett på i sekunder om
gangen, i et lyst klasserom, ofte stående.

**Brukeren er ikke utvikler.** Forklar valgene dine på norsk, med vanlige ord.

## 2. Retningen: ark som glir

Appen er lag som skyves inn og ut. Velger du en elev, glir elevpanelet inn fra
høyre og lista trekker seg sammen. Lukker du det, glir det ut og lista brer seg
tilbake. Ingenting bytter side, ingenting blinker, ingenting lastes på nytt.

Det er sant om strukturen: du er alltid i en liste og går inn i én ting av
gangen. Navigasjonen er dybde, ikke sidebytte.

**Signaturen er bevegelsen.** De fleste verktøy i denne sjangeren står helt
stille. Dette skal ikke det. Men bevegelsen er kort, retningsbestemt og alltid
den samme veien, så den forteller deg hvor du er i stedet for å underholde.

Flatene er kort med skygge på en kjøligere grunn. Dybde kommer fra lagdeling,
ikke fra rammer.

**Én grense, og den er absolutt:** skåringsflyten animeres aldri. Se §7.

## 3. Hva som allerede er bygget

Appen virker. 73 tester passerer. Du bytter uttrykk, ikke funksjon.

| Skjerm | Hva den er |
|---|---|
| `Veiviser` | Førstegangsoppsett: skoleår → fag → elevlister |
| `IDag` | Startskjerm. Dagens økter som kort |
| `Skolekalender` | Året som månedsrutenett, kun mandag–fredag |
| `Skoleruta` | Ferier og fridager, toner ut dager i kalenderen |
| `Fag` | Fagene i året, tabell + `FagPanel` |
| `Elever` | Hovedtabellen: navn, klasse, fag, økter, siste + `ElevPanel` |
| `LimInn` | Lim inn klasseliste, forhåndsvisning med duplikathåndtering |
| `Okter` | Øktene kronologisk + `OktPanel` — her skåres elevene |
| `Perioder` | Året som vannrett tidslinje |
| `Vurderinger` | Vurderingsoppgaver per fag + `VurderingPanel` |
| `Innstillinger` | Skoleår, fagbank, fag i år, skalaer, sikkerhetskopi |
| `Arsplan` | Utskriftsvisning (print-stylesheet) |

**Mønstre som skal respekteres:**

- **Liste til venstre, panel til høyre** — `lg:w-1/3` / `lg:w-2/3`. Lista
  komprimerer seg når panelet åpnes. Dette er layouten bevegelsen må passe.
- **Felt lagrer når de forlates.** Ingen lagre-knapper. Enter bekrefter,
  Escape angrer.
- **Navigasjonshistorikk** som i en nettleser, ⌘[ og ⌘].
- **Kolonnevelgere** i Elever og Økter.
- **Skåringsflyten i `OktPanel`:** `0`–`3` setter verdi og flytter markøren
  videre. Tastene utledes av skalaens rangering.

Ikke bygget: oppfølging og tekstarkiv-eksport. Ikke design deg inn i et hjørne
som gjør dem vanskelige.

## 4. Ufravikelig

**Null nettverkskall mens appen kjører.** Ingen Google Fonts, ingen CDN, ingen
`@import url()` mot nett, ingen ikonpakke som hentes ved kjøring.

Merk hva det *ikke* betyr: en fontfil i `public/` som lastes fra disk er like
lokal som en PNG. Du står fritt i valg av skrift — den må bare følge med
installasjonen.

**Skalafarger er data.** `skalaverdi.farge` lagrer et navn (`gronn`, `gul`,
`rod`), ikke en hex. Oppslaget skjer i `src/ui/farger.ts`. Bytt paletten der —
aldri i den enkelte visningen, aldri i databasen.

**28px radhøyde.** Tretti elever pluss tabellhode skal få plass uten scrolling
på en 14-tommer. Dette er den viktigste enkeltverdien i hele dokumentet. Test
det faktisk, ikke anta. En smal skrift kjøper deg plass i kolonnene.

**Utskriften må virke.** `src/index.css` har print-stylesheet med
`.ikkeutskrift` / `.kunutskrift` og sideskift per fag. Alt skal være lesbart i
svart-hvitt på papir.

**Ikke rør** `src/data/`, `src/db/`, `src/import/`, `src-tauri/migrations/`,
eller tastaturflyten. Trenger du en ny opplysning for å tegne noe, si fra.

## 5. Farge — her skal vi prøve oss fram

Ingenting er låst. Foreslå **tre palettretninger**, og vis alle tre på samme
skjerm så de er sammenliknbare.

Rammer som gjelder alle tre:

- **Lys grunn.** Klasserom er lyse. Mørk modus kommer til slutt, om i det hele
  tatt.
- **Kort på en kjøligere grunn**, med ekte skygge. Tre nivåer: liste, panel,
  ark som legger seg over.
- **Fag har egne, tydelige farger** — 12 dempede blekkfarger finnes i dag
  (`#2f5d8a`, `#7a4b2a`, `#3f6b4a` og flere). De vises som 3px strek i
  venstremarg og som prikk ved fagkoden. Aldri som flatefarge.
- **Trafikklyset har fem trinn** i datamodellen, selv om v1 bruker tre. Dagens
  verdier er `#2dc937 · #99c140 · #e7b416 · #db7b2b · #cc3232`, valgt for
  lesbarhet. Grønnen er skarp — foreslå gjerne noe roligere.
- **Kontrast er et krav.** Dette leses på avstand i et lyst rom.

Blåen som brukes i dag ligger strødd som hex i komponentene og skal samles til
navngitte tokens: `#1d4e7c` primær, `#194365` hover, `#eaf0f6` aktiv fane,
`#f4f7fa` radhover, `#b3261e` feil.

Forbudet mot fiolett i den forrige brief-en er opphevet. Det som gjelder er
§9, ikke en liste over enkeltfarger.

## 6. Typografi

**Skriften skal velges, ikke arves.** Appen har ingen `font-family` satt i dag —
det er fravær av en beslutning, ikke en beslutning.

Ett funksjonelt krav: **tabulære sifre.** Datoer, klokkeslett, timetall og
elevantall står i kolonner som skal flukte. En skrift uten `tnum` kan brukes til
navn og UI, men da trengs en annen til tallene.

**Stående forslag:** Archivo og Archivo Narrow. Én familie i to bredder, åpen
lisens, laget for tetthet, med ordentlig tegnet ø, å og æ, og tabulærsifre — så
ingen egen monofont trengs. Kondensert til elevnavn og øktrader, vanlig til
resten.

Har du et bedre forslag, legg det fram. Kommersielle skrifter er i orden hvis
lisensen dekker å pakke dem med en app — nevn det som et spørsmål, ikke en
innvending.

Dagens størrelser: 13px brødtekst i tabeller, 11–12px etiketter, 15px
overskrifter, 10px i kalenderruter. Sett også `<title>` i `index.html` — den
står fortsatt på «Tauri + React + Typescript».

## 7. Bevegelse

Bevegelsen er en del av uttrykket, ikke pynt.

```
--tid-rask   90ms    markørflytting, hover, tilstandsbytte
--tid-inn   180ms    panel og ark som glir inn
--tid-ut    130ms    ut — alltid raskere enn inn
--kurve     cubic-bezier(.2, .9, .25, 1)
--kurve-ut  cubic-bezier(.4, 0, .9, .4)
```

**Panel inn:** glir inn fra høyre mens lista komprimerer fra full bredde til
1/3. De to bevegelsene er samtidige og har samme varighet, så det leses som at
lista gjør plass — ikke som at to ting skjer.

**Panel ut:** motsatt vei, raskere. Lista er tilbake i full bredde før panelet
er helt borte. Ventetid oppleves verre på vei ut enn på vei inn.

**Ark over ark:** åpner du noe fra et panel, legger det nye seg over med
`skygge-3`. Det under skaleres til 98% og dempes, så lagdelingen leses.

**Liste som lastes:** 12 ms forsinkelse per rad, maks ti rader med stagger.
Resten står ferdig. Uten det taket blir tretti elever en forestilling.

**Rader som flyttes** — dra en periode, endre rekkefølge på skalaverdier —
bruker FLIP, ikke reflow-hopp.

### Grensen

**Skåringsflyten animeres aldri.** Tastetrykk → farge → neste elev er null
millisekunder. Kravet er tretti elever på under tjue sekunder. Selv 90 ms per
trykk er tre sekunder tapt og en markør som henger etter fingeren.

Animer navigasjon. Aldri inntasting.

### Bryteren

**I Innstillinger**, under Generelt: **Bevegelse — På / Dempet / Av**.

- **På** er standard, verdiene over
- **Dempet** halverer alle tider og fjerner stagger
- **Av** setter alt til 0 ms

`prefers-reduced-motion: reduce` setter den til Av første gang. Brukeren kan
overstyre.

## 8. Trafikklyset

Farge alene er ikke nok — verken for fargesyn eller på avstand. Form skiller i
tillegg til farge:

| Verdi | Form |
|---|---|
| Grønn | fylt sirkel |
| Gul | halvfylt sirkel |
| Rød | tom sirkel, tykk ring |
| Ikke i økta | tomt omriss, tynn strek |
| Ikke skåret | ingenting |

I heatmapet er de avrundede kvadrater. «Ikke i økta» er alltid tom, aldri farge.

## 9. Det skal ikke se «Claudsk» ut

Det finnes et gjenkjennelig utseende språkmodeller faller ned på med frie
tøyler. Det er feil her — ikke fordi det er stygt, men fordi det er anonymt, og
fordi det er dashbord-språk brukt på et arbeidsverktøy.

**La være:**

- Inter, `system-ui` eller Roboto som gjennomgående skrift
- Kremhvit bakgrunn rundt `#F4F1EA` med terrakotta-aksent rundt `#D97757`
- Gradienter, særlig i topptekst, knapper og hero-flater
- Emoji som ikoner
- Pill-formede merkelapper med pastellbakgrunn overalt
- Luftig midtstilt `max-w-4xl`-layout — tettheten er poenget
- Store tall som «stat-kort» øverst på skjermer
- Tailwinds standardpalett (`slate-500`, `zinc-100`) som hele identiteten
- shadcn/ui rett ut av eska

**Testen:** ser det ut som et skjema eller som et produkt? Det skal se ut som et
skjema — bare skarpere, og med lag som beveger seg.

Skygger og kort er *tillatt* her, i motsetning til i forrige brief. Men de er
dybde, ikke dekorasjon: tre nivåer, ikke en skygge rundt hver seksjon.

## 10. Hva jeg vil ha tilbake

En **merkevareguide for appen**, ikke ferdig kode:

1. **Tre palettretninger**, hver vist på samme skjerm — Elever-tabellen med
   tretti rader, ekte norske navn, panelet åpent.
2. **Typografiforslag** med skalaen satt, vist i tett tabell.
3. **Komponentoversikt:** knapper, tabellrad, inputfelt, nedtrekksliste,
   trafikklys i alle fem tilstander, heatmap-rad, øktrad, tom tilstand,
   feilmelding, bryteren for bevegelse.
4. **Bevegelsen vist**, ikke bare beskrevet: panel inn og ut.
5. Én setning per valg om **hvorfor**.

Tretti rader, ikke fem. Fem elever ser fint ut uansett — det er ved tretti du
ser om tettheten holder.

## 11. Ikke oppdraget

- Nye funksjoner eller skjermer
- Endringer i datamodell, spørringer, migrasjoner eller tastaturflyt
- Nye avhengigheter uten å spørre
- Å gjøre appen om til et dashbord
