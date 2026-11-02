#!/bin/zsh
# Lager test-dmg-en til kolleger: Økta.app, en snarvei til Programmer,
# guide_read_me.pdf, testheftet betatest.pdf og den oppdiktede klasselista
# i samme vindu.
#
#   npm run dmg
#
# Bygger appen for både Apple-brikke og Intel (universal-apple-darwin).
# Guiden skrives ut fra docs/guide/guide_read_me.html med Chrome.
#
# Signering og notarisering (docs/release.md): finnes et «Developer ID
# Application»-sertifikat i nøkkelringen, signeres appen med det, og appen
# og dmg-en sendes til Apple og godkjennes (notarytool-profilen «okta»).
# Da åpner Økta uten advarsel hos kolleger. Uten sertifikatet signeres den
# lokalt som før (signingIdentity "-" i tauri.conf.json), med advarsel.
set -euo pipefail
cd "$(dirname "$0")/.."

profil="${NOTAR_PROFIL:-okta}"
id=$(security find-identity -v -p codesigning \
  | sed -n 's/.*"\(Developer ID Application: [^"]*\)".*/\1/p' | head -1)
if [[ -n "$id" ]]; then
  echo "Signerer med: $id"
  # Tauri bruker denne framfor signingIdentity i tauri.conf.json, og slår
  # på hardened runtime, som notariseringen krever.
  export APPLE_SIGNING_IDENTITY="$id"
  xcrun notarytool history --keychain-profile "$profil" >/dev/null 2>&1 || {
    echo "Fant ikke innloggingen «$profil» for notarytool. Se docs/release.md."; exit 1; }
else
  echo "Fant ikke noe «Developer ID Application»-sertifikat."
  echo "Bygger med lokal signatur; kolleger får en advarsel ved første åpning."
fi

versjon=$(node -p "require('./package.json').version")
app="src-tauri/target/universal-apple-darwin/release/bundle/macos/Økta.app"
# UT=<mappe> legger dmg-en et annet sted, til en prøvebygging som ikke
# skal skrive over en utgitt versjon.
ut="${UT:-dist-dmg}"
dmg="$ut/Økta $versjon.dmg"

if [[ "${HOPP_OVER_BYGG:-}" != "1" ]]; then
  npm run tauri build -- --target universal-apple-darwin
fi
[[ -d "$app" ]] || { echo "Fant ikke $app"; exit 1; }

# Guiden og testheftet, skrevet ut på nytt så de alltid følger HTML-en.
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[[ -x "$chrome" ]] || { echo "Trenger Google Chrome for å skrive ut PDF-ene"; exit 1; }
# Windows-guiden følger ikke dmg-en, men lastes opp til releasen
# (docs/release.md).
for navn in guide_read_me guide_read_me_windows betatest; do
  "$chrome" --headless=new --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="docs/guide/$navn.pdf" \
    "file://$PWD/docs/guide/$navn.html" >/dev/null 2>&1
done

# Ingen data skal følge med: databasen ligger i Application Support, aldri
# i appen. Sjekk det likevel.
if find "$app" -iname "*.sqlite*" -o -iname "*.okta" | grep -q .; then
  echo "Appen inneholder en database eller oppsettfil. Stopper."; exit 1
fi

# Notariser appen og fest godkjenningen til den, så den åpner uten
# nettverk også når den er kopiert ut av dmg-en.
notariser() {
  local svar
  svar=$(xcrun notarytool submit "$1" --keychain-profile "$profil" --wait 2>&1) || true
  print -r -- "$svar"
  if [[ "$svar" != *"status: Accepted"* ]]; then
    echo "Apple godtok ikke $1. Se hvorfor med:"
    echo "  xcrun notarytool log <id over> --keychain-profile $profil"
    exit 1
  fi
}
if [[ -n "$id" ]]; then
  codesign --verify --deep --strict "$app"
  zip="$ut/notarisering.zip"
  mkdir -p "$ut" && rm -f "$zip"
  ditto -c -k --keepParent "$app" "$zip"
  echo "Sender appen til Apple (noen minutter) …"
  notariser "$zip"
  rm -f "$zip"
  xcrun stapler staple "$app"
fi

rm -rf "$ut/innhold" && mkdir -p "$ut/innhold"
cp -R "$app" "$ut/innhold/"
ln -s /Applications "$ut/innhold/Programmer"
cp docs/guide/guide_read_me.pdf docs/guide/betatest.pdf \
  docs/guide/oppdiktet-klasseliste-1STA-1STB.pdf "$ut/innhold/"
# Lesbare for alle, også på en annen brukerkonto enn den som bygde.
chmod 644 "$ut/innhold/"*.pdf
rm -f "$dmg"
hdiutil create -volname "Økta $versjon" -srcfolder "$ut/innhold" -ov -format UDZO "$dmg" >/dev/null
rm -rf "$ut/innhold"

if [[ -n "$id" ]]; then
  codesign --sign "$id" --timestamp "$dmg"
  echo "Sender dmg-en til Apple …"
  notariser "$dmg"
  xcrun stapler staple "$dmg"
  # Slik Gatekeeper ser det hos en kollega.
  spctl --assess --type open --context context:primary-signature -v "$dmg"
  spctl --assess --type execute -v "$app"
fi

echo "Ferdig: $dmg"
codesign -dv "$app" 2>&1 | grep -E "Authority=Developer|Signature|Identifier|flags" || true
lipo -archs "$app/Contents/MacOS/okta"
