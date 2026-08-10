# Dummydata for Økta

Fire fiktive klasselister til bruk under utvikling. Ingen ekte elevdata.
Navnene er karakterer fra The Sopranos. De siste 22 i `1STA-ENGVG1.md` er
konstruerte navn i samme register, fordi serien ikke har nok navngitte
karakterer til å fylle fire klasser.

## Filene

| Fil | Fag | Antall | Format |
|-----|-----|--------|--------|
| `1STC-MFL1.md` | MFL1 | 30 | `Fornavn Etternavn`, ren liste |
| `2STA-MFL2.md` | MFL2 | 29 | Markdown-punktliste med `-` |
| `1STB-ENG1.md` | ENG1 | 28 | `Etternavn, Fornavn` |
| `1STA-ENGVG1.md` | Engelsk VG1 | 29 | `Fornavn Etternavn;Klasse` |

Til sammen 116 elever.

## Hvorfor fire formater

Formatene er med vilje forskjellige. Til sammen dekker de alle reglene i §7 i
spec-en, så de fungerer som testdata for lim-inn-parseren og ikke bare som
navnefyll. Får parseren alle fire riktig, tåler den også det InSchool spytter ut.

Merk at hver fil har en overskriftslinje med `#`. Den skal hoppes over.

## Kanter parseren må tåle

Listene inneholder med vilje navn som bryter enkle antakelser:

- **Flerdelte etternavn:** `Adriana La Cerva`, `Richard La Penna`,
  `Valentina La Paz`, `Feech La Manna`. Regelen «siste ord er etternavn» gir
  feil resultat her. Disse skal ende opp med `La Cerva` som etternavn, ikke
  `Cerva`.
- **Samme etternavn på flere elever:** seks `Soprano`, tre `Moltisanti`,
  tre `Aprile`, tre `Scatino`, to `Barese`. Duplikatsjekken må se på hele
  navnet, ikke bare etternavnet.
- **Store og små bokstaver midt i navn:** `DeTrolio`, `DeConcini`, `DiMeo`.
  Ikke normaliser til `Detrolio`.

## Duplikattest

`Tony Soprano` finnes bare i 1STC. For å teste duplikathåndteringen og
`elev_fag`-koblingen: lim inn 1STC i MFL1, og lim deretter de fem første
navnelinjene fra samme fil inn i ENG1. De skal gjenkjennes som eksisterende
elever og kobles til begge fag, ikke opprettes på nytt.
