# Slik lager du en release

En release er en nedlastbar versjon på GitHub
(<https://github.com/fbedsvaag/okta/releases>). Mac-versjonen bygges på
din egen Mac; Windows-versjonen bygges av GitHub når releasen publiseres.

## 0. Engangsoppsett: signering og notarisering (Mac)

Med Apple Developer-kontoen signeres Økta med et «Developer ID»-sertifikat
og godkjennes (notariseres) av Apple. Da åpner den uten advarsel hos
kolleger. `npm run dmg` gjør resten selv når dette er på plass.

1. **Sertifikatet.** Xcode → Settings → Accounts → velg Apple-ID-en og
   teamet → *Manage Certificates…* → **+** → *Developer ID Application*.
   Sjekk i Terminal:

   ```
   security find-identity -v -p codesigning
   ```

   Det skal stå en linje med «Developer ID Application: …».

2. **Innlogging for notariseringen.** Lag et app-spesifikt passord på
   <https://account.apple.com> (Logg på og sikkerhet → App-spesifikke
   passord), og lagre det i nøkkelringen under navnet `okta`:

   ```
   xcrun notarytool store-credentials okta --apple-id <din Apple-ID> --team-id <team-ID>
   ```

   Team-ID-en står i parentes etter navnet i sertifikatet, eller på
   developer.apple.com under Membership. Passordet limes inn når den spør,
   og ligger bare i nøkkelringen, aldri i repoet.

Uten sertifikatet bygger `npm run dmg` som før, med lokal signatur, og
sier fra.

En prøvebygging som ikke skal skrive over en utgitt dmg, legges et annet
sted med `UT=<mappe> npm run dmg`.

## 1. Nytt versjonsnummer

Hver release får et nytt nummer, også om det bare er en liten retting.
Ellers kan ingen se forskjell på to filer med samme navn.

Endre nummeret fem steder:

- `package.json` (`"version"`)
- `src-tauri/Cargo.toml` (`version`)
- `src-tauri/tauri.conf.json` (`"version"`)
- `docs/guide/guide_read_me.html` (forsiden og filnavnet i steg 1)
- `docs/guide/betatest.html`

Commit og push.

## 2. Bygg dmg-en

```
npm run dmg
```

Tar rundt ti minutter, og noen minutter til mens Apple sjekker appen og
dmg-en. Fila havner i `dist-dmg/Økta 0.3.0.dmg`, med guiden, testheftet og
den oppdiktede klasselista inni. Til slutt skriver skriptet hva Gatekeeper
sier: «accepted · source=Notarized Developer ID» betyr at alt er i orden.

## 3. Publiser

Beta (testversjon for kolleger) får `--prerelease`:

Lag først en kopi av dmg-en med fast navn. Hjemmesiden lenker rett til
`releases/latest/download/Okta-mac.dmg` (og `Okta-windows.exe`, som
Windows-bygget laster opp selv), så navnet må være likt i hver release:

```
cp "dist-dmg/Økta 0.3.0.dmg" dist-dmg/Okta-mac.dmg
```

```
gh release create v0.3.0 "dist-dmg/Økta 0.3.0.dmg" dist-dmg/Okta-mac.dmg \
  docs/guide/guide_read_me_windows.pdf \
  docs/guide/betatest.pdf \
  docs/guide/oppdiktet-klasseliste-1STA-1STB.pdf \
  --prerelease --title "Økta 0.3.0 beta" \
  --notes "Testversjon. Mac: last ned dmg-en, guiden og testheftet ligger inni. Windows: last ned -setup.exe (kommer etter 15–20 minutter), guide_read_me_windows.pdf, betatest.pdf og den oppdiktede klasselista."
```

PDF-ene ligger ved siden av dmg-en fordi Windows-brukerne ikke åpner
dmg-en. `npm run dmg` skriver dem ut på nytt hver gang.

En ferdig versjon er den samme kommandoen uten `--prerelease`, og med en
tittel uten «beta».

Når releasen er publisert, starter Windows-bygget av seg selv på GitHub
(`.github/workflows/windows.yml`). Etter 15–20 minutter ligger
`.exe`-installeren i den samme releasen. Følg med på
<https://github.com/fbedsvaag/okta/actions>.

## 4. Hjemmesiden

Knappene lenker til den nyeste releasen og trenger ingen endring. Bare
versjonsnummeret i nedlastingskortene i `site/index.html` («Versjon
0.3.0 · …») endres. Hjemmesiden publiseres av seg selv når `site/` pushes.
Push den når Windows-installeren ligger i releasen, ellers peker
Windows-knappen på en fil som ikke finnes ennå.

Bare releaser *uten* `--prerelease` blir «latest». En beta som skal på
hjemmesiden, publiseres derfor som vanlig release med «beta» i tittelen.

## Aldri

- **Aldri gjenbruk et versjonsnummer.** Finnes `v0.3.0` allerede, lag
  `v0.3.1`.
- **Aldri `--clobber`.** Den bytter ut filer i en release som allerede er
  lastet ned, så folk sitter med ulike filer under samme navn.

## Hvor mange har lastet ned?

```
gh api repos/fbedsvaag/okta/releases \
  --jq '.[] | "\(.tag_name): " + ([.assets[] | "\(.name) \(.download_count)"] | join(", "))'
```
