# Slik lager du en release

En release er en nedlastbar versjon på GitHub
(<https://github.com/fbedsvaag/okta/releases>). Mac-versjonen bygges på
din egen Mac; Windows-versjonen bygges av GitHub når releasen publiseres.

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

Tar rundt ti minutter. Fila havner i `dist-dmg/Økta 0.3.0.dmg`, med
guiden, testheftet og den oppdiktede klasselista inni.

## 3. Publiser

Beta (testversjon for kolleger) får `--prerelease`:

```
gh release create v0.3.0 "dist-dmg/Økta 0.3.0.dmg" \
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
