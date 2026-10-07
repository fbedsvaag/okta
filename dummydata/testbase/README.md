# Testbasen

Fiktive data for et helt skoleår, til å prøve appen med realistiske
mengder. Ingen ekte elever. Ingen bilder (opphavsrett).

```
npm run testdata
```

Lukk appen først. Skriptet (`scripts/lag-testdata.ts`) tar en kopi av
arbeidsfila ved siden av den (`elevtracking-for-testdata-<tid>.sqlite` i
`~/Library/Application Support/no.elevtracking.app/`), tømmer alt om elever
og undervisning, og bygger basen på nytt fra filene her. Innstillingene
(utseende, zoom og så videre) og de innebygde skalaene står. Hver kjøring
gir samme base.

## Filene

| Fil | Innhold |
|-----|---------|
| `3STA-sopranos.txt` | 32 elever fra The Sopranos (de 30 fra `../1STC-MFL1.md`, Jennifer Melfi og Tony Blundetto) |
| `3STB-andeby.txt` | 32 elever fra Andeby, med norske navn |
| `3STC-tolkien.txt` | 32 elever fra Tolkiens univers |
| `fag.json` | skoleåret med fridager, lærernavnet, de tre fagene, og tekstene skriptet trekker fra |

Listene står som `fornavn etternavn; klasse`, slik lim-inn-parseren tar dem.

## Hva basen får

- **Skoleåret 2026/27** med høstferie, planleggingsdag, jule-, vinter- og
  påskeferie og eksamensperioden.
- **Tre fag**, ett per klasse, med ekte Udir-koder og kompetansemål:
  Norsk vg3 (NOR1267, 3STA), Historie vg3 (HIS1010, 3STB) og Religion og
  etikk (REL1003, 3STC). Faste tider, rom og årstimetall; øktene går opp i
  årstimetallet.
- **Perioder** med fiktive titler på alle økter, og kompetansemålene hver
  periode dekker.
- **Fram til i dag:** skåringer for alle, logger, noen notater på elevene
  i øktene. Hver elev har sitt nivå. Fire i hver klasse er mye borte
  (omtrent 60, 30, 20 og 12 prosent av øktene), så fraværsmerkene har noe
  å vise.
- **Framover:** agenda og plan på de neste øktene, lekser her og der.
- **Vurderinger** (karakter 1 til 6) med resultater når fristen er passert.
- **Mentorgruppa:** de første 16 i 3STA.
- **Oppfølging:** et forfalt punkt, et åpent, et lukket, og to gjøremål.

Ingen tankestrek i titlene.
