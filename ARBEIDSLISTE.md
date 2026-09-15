# Økta — arbeidsliste

Prioritert rekkefølge. Punktene er de samme som i forbedringslista, bare
sortert etter hva som blokkerer hva, og hva som koster hva.

Kryss av underveis. Legg nye punkter nederst i riktig bolk, ikke øverst.

---

## 0. Blokkerende

- [ ] **Sletting av skoleår låser appen.** Fikses tre steder: ved sletting
  (repek `aktivt_skolear`), ved oppstart (fall tilbake på nyeste år, ellers
  veiviseren — aldri heng), og sletting av siste år skal gi veiviseren.
  Gå gjennom om andre innstillinger som peker på rader har samme problem.
  Tester for begge tilfellene.

Dette er ikke en irritasjon. Det er en database som kan bli utilgjengelig,
og det finnes allerede baser med den døde pekeren i seg.

## 1. Layout — én ordentlig runde

Dashbordet som flytter seg og kalenderen som ikke er fast er samme problem.
Det er forsøkt lappet mange ganger uten å løse seg.

- [ ] **Finn årsaken før du fikser.** Hva er det som gjør at høyden varierer?
  Rullesoner inni hverandre, prosenthøyder, innhold som bestemmer
  containerstørrelse. Beskriv den før du rører noe.
- [ ] Dashbordet står fast fra «dagens økt» og ned
- [ ] Kalenderen har fast cellehøyde. Korte uker og uker med mange hendelser
  er like høye, og hendelser tar fast plass

## 2. Billige fikser

Hver av disse er under en time og fjerner daglig friksjon.

- [ ] Riktig timetelling per fag, regnet ut fra øktene som faktisk ligger inne
- [ ] Batch-slett økter
- [ ] Batch-slett elever
- [ ] Høyreklikk på økt: rediger, slett
- [ ] Lim inn liste i formatet `navn; klasse`
- [ ] Kopier-knapp til Teams
- [ ] Generell hendelse i skoleruta med egen tag, som blokkerer undervisning
  («eksamen i annet fag»)

## 3. Mentorelever — grunnmur

Låser opp både Samtaletrekkeren og Klassekart. Bygges før dem.

- [ ] Mentorgruppe som undergruppe av en klasse (typisk 16 av 32)
- [ ] Elever kan legges inn som mentorelever **uten** å være i noe fag.
  Gå gjennom import, elevoversikt, filtre, elevside og duplikatgjenkjenning
  — flere av dem antar i dag at en elev har minst ett fag
- [ ] Kontaktmøte med mentorelev: notater fra flere møter samlet på ett sted
- [ ] Bygg §4.7 møtelogg. Migrer elev.notat inn som første rad
      (dato = elev.endret, ikke dagens dato — notatet ble skrevet
      en gang, ikke i dag). Migreringen skriver før den sletter,
      i én transaksjon. Tomme felter skal ikke gi tomme notater.
      Fjern feltet fra elevpanelet etterpå.
- [ ] Rydd §3.5 og §5.4 når møteloggen er bygget — de blir
      foreldreløse av §4.7, men vi vet ikke hvordan tabellen skal
      se ut før den finnes.

## 4. Store funksjoner

Tas én om gangen, etter at 0–3 er gjort.

- [ ] **Samtaletrekkeren.** Spec-seksjon først, bygging etterpå
- [ ] **Klassekart.** Spec-seksjon først. Rom må kunne lages enkelt, ellers
  blir den ubrukt
- [ ] Ukesvisning av økter
- [ ] AND/OR i filtrering av elever, for å finne hvem som har flere like fag

## Ikke nå

Ting som er vurdert og lagt bort med vilje. Står her så de ikke dukker opp
igjen som nye ideer.

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
