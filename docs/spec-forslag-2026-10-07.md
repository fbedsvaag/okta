# Forslag til SPEC.md, 07.10.2026

Eieren har bestemt at appen slik den er etter runde 13 gjelder. Disse
avsnittene i SPEC.md stemmer ikke lenger. Teksten under kan limes inn som
den er. Claude Code skriver ikke i SPEC.md selv (CLAUDE.md).

---

## §4.3, erstatter fra «Motstykket til Elever-fanen» til og med «Klikk på navnet åpner §4.5.»

Motstykket til Elever-fanen i Excel, og limet mellom alt annet. En liste
med alle elevene i det aktive skoleåret, gruppert på klasse, fag eller
alfabetisk (valget huskes):

```
2STA  8 elever
  Artie Bucco         2STA   MFL1  MFL2   ▪▪▪▪▪▪▪▪▪▪   –
  Christopher Moltisanti M   MFL2  ENG1   ▪▪▪▪▪▪▪▪▪▪   ▬ 11 %   ●
```

- Per rad: bilde, fornavn og etternavn, M for mentorelev, klasse, fagene
  med fagfirkant, innsatsen de siste ti øktene som ruter, og fraværet i
  prosent av fagets timer med en liten stolpe mot 10 %-grensen (det
  høyeste faget; se §4.12). En rød prikk når eleven glipper: minst to
  røde blant de fem siste øktene.
- Filterpiller for fagene, «Uten fag» og Mentorelever, fritt kombinert.
  Søk i verktøylinja.
- Klikk åpner elevkortet (§4.5). **Eleven endres der:** klasse, fag,
  mentor, kjønn, bilde og sletting. Lista har ingen redigering i radene.
- Elever med et åpent, forfalt oppfølgingspunkt får et merke ved navnet.
  Merket sier bare at noe venter, aldri hva.
- **Endringer på mange elever samtidig** (merke flere og endre fag,
  klasse eller mentor, eller slette) skal tegnes i lerretet før det bygges.
- Sletter man en elev, forsvinner alt som hører til eleven: skåringer,
  vurderingsresultater, notater, samtaler og koblinger.

#### Elever inn i appen

Elevene kommer inn med **Lim inn liste** (§7): InSchool-PDF-en, eller en
liste skrevet som `fornavn etternavn; klasse`, én per linje. «Ny elev» i
verktøylinja lager én elev og åpner elevkortet. Det finnes ingen tom rad
for manuell innlegging nederst i lista.

(Avsnittet «Manuell innlegging» utgår. «Lim inn liste», «Klasser» og
«Klasseopprykk» står som før; Klasser ligger bak ⋯ i verktøylinja.)

---

## §4.4, erstatter fra «Øverst en kompakt topplinje» til og med tabellen over tastene

Økta har **to moduser i samme ark**, med en bryter øverst til høyre:
**Skåring og logg** og **Planlegging**. Åpnes økta fra I dag, eller pågår
den eller er den ferdig, åpner den i skåring. Ligger den fram i tid, åpner
den i planlegging. ⌘← og ⌘→ blar til forrige og neste økt i faget.

Øverst: fag, tittel, når økta er («om 3 dager», «Pågår · 50 min igjen»),
dato, tid, rom og periode, og Ferdig (⌘↵).

**Skåring og logg.** Elevlista for faget, alfabetisk på fornavn, én rad per
elev (38 px). Trafikklyset står **først**, foran bildet (28 px) og navnet,
så blikket ikke må hoppe:

```
 ▸  ●  ○  ○  ○   Anna Reistad       2STB   notat fra økta
    ○  ○  ●  ○   Benjamin Holm      2STA
```

Til høyre: notatet fra forrige økt, planen med avkrysning og øktloggen.

**Planlegging.** Dato, tid, rom, periode og vurdering; lekse og agenda til
elevene; planen som en sjekkliste med minutter per punkt og summen mot
øktas lengde; kompetansemålene i økta med avkrysning, der periodens mål er
merket. Til høyre: forrige økt, «Følg opp i økta» (rød to ganger på rad,
borte sist, åpent oppfølgingspunkt; bare fornavn og grunn) og hvor i
perioden økta ligger.

(Tastetabellen står som før.)

---

## Ny §4.12 Fravær mot 10 %-grensen

Fravær regnes i timer: summen av varigheten på de avholdte øktene der
eleven står som «ikke i økta», mot 10 % av fagets årstimetall (140 t gir
14 t). Har faget ikke årstimetall, regnes det av timene som er planlagt i
faget. Elever som kom inn i faget etter en økt, får ikke fravær for den.

Det vises i Elever (høyeste fag), på fagsiden (bolken «Fravær mot
10 %-grensen») og i elevkortet («Fravær i år», én rad per fag: prosent,
stolpe, «9 av 24 økter · 15,8 t»). Merker: Halvveis (minst 50 % av
grensen), Nær grensen (minst 75 %) og Over grensen.

Appen skiller ikke dokumentert fra udokumentert fravær. Teksten sier det:
«Udokumentert fravær over 10 % av timene i faget kan gi IV. InSchool er
fasit; her regnes «ikke i økta».»

---

## §4.2, tillegg under «Tre visninger»

Med et fag valgt har Økter en fjerde inngang først: **Oversikt**, fagsiden.
Bryteren er da Oversikt | Økter | Kalender. Fagsiden viser timene mot
årstimetallet, neste økter, kommende vurderinger, klassen økt for økt,
elevene nå med fraværet, kompetansemålene med hvor langt de er dekket, og
øktloggene.

## §4.9, tillegg under «Skriv ut / lagre som PDF»

PDF-en har egne A4-sider: toppen med fag, faglærer, rom, tid, timene per
periode, teksten om faget og kompetansemålene på første side; en smal
topplinje og «<periode> fortsetter» på de neste; «Side n av N» nederst.
Ferier står som egne linjer i kursiv.
