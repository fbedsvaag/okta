# Forslag til endringer i SPEC.md — 05.10.2026

Etter redesignrunden i Claude Design-lerretet. **Ikke godkjent.** Eieren
bestemmer hva som skal inn; Claude Code skriver ikke i SPEC.md.

## §13 Visuell retning — ny tekst

Detaljene — tokens, komponenter, bevegelse — står i `DESIGN.md`. Her står
retningen, og det som ikke skal fravikes.

Et godt Mac-verktøy: rolig, tett og raskt med tastaturet. Sett på i sekunder
om gangen, i et lyst klasserom, ofte mens noen snakker til deg. Enkelt nok
til at en kollega kan sette det opp alene.

- **Palett:** blekk med et kjølig fiolett stikk. Én aksent for primærknapp,
  markert rad og fokus. Brukeren kan velge mellom seks paletter; blekk,
  trafikklys og fagfarger er like i alle. Fag skilles med en liten firkant i
  fagfargen, ikke med streker eller flater.
- **Trafikklyset** er det eneste stedet med mettet farge. Symbolene er
  helfylte. Fast rekkefølge i skåringsplottet og verktøytips med navn bærer
  betydningen sammen med fargen.
- **Type:** Geist til alt, Light i store overskrifter. Tabulære sifre på alt
  som står i kolonner. Skriftene ligger lokalt (§1).
- **Tetthet:** skåringslista holder 28 px rader. Dette er den viktigste
  enkeltbeslutningen i UI-et. Resten har 34 px; bredden brukes og navn
  brekker aldri.
- **Glass:** sidemeny, verktøylinje og ⌘K er glass over et fargeteppe i
  vinduet. Aldri under innhold. Kan skrus av, og er av når macOS ber om
  redusert gjennomsiktighet.
- **Bevegelse:** navigasjonen er dybde, ikke sidebytte. Skåringen animeres
  aldri.
- **Mørk modus:** bygget. Utskriften er alltid lys.

(Avsnittet om forsiden som villet unntak beholdes som det er.)

## §4.0 Førstegangsoppsett — tillegg

Første steg er «Velkommen», med valget mellom å lese inn en oppsettfil fra
en kollega (§8.2) og å sette opp selv. Stegene er da: Velkommen, Skoleåret,
Fagene dine, Elevene, Ferdig.

## §4.1 I dag — endring

Setningen «Én økt i dag: …» under datoen tas bort; «Dagens økter» sier det
samme. Notatet fra forrige økt står under hver økt og kan foldes ut.

## §4.2 Årsplan — endring

Periodevisningen tas bort. Bryteren er Liste | Kalender. «Periodisering er
fargelegging» erstattes av: **perioden er en merkelapp på økta.** Periodene
står som filtre over lista med antall økter og timer. Marker økter og trykk
P for å sette periode. Radene fargelegges ikke.

## §4.4 Skåring — endring

Notatet fra denne økta står i en egen kolonne på raden, ikke som en rad
under. N åpner feltet i raden. Står markøren på en elev uten notat, vises
siste skåringsnotat i grått der (erstatter hjelpeteksten under raden).

## §8.2 Oppsettfil — ny

Se del A i `docs/oppsettfil.md`.
