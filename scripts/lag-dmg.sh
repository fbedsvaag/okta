#!/bin/zsh
# Lager test-dmg-en til kolleger: Økta.app, en snarvei til Programmer og
# guide_read_me.pdf i samme vindu.
#
#   npm run dmg
#
# Bygger appen for både Apple-brikke og Intel (universal-apple-darwin),
# signert lokalt (signingIdentity "-" i tauri.conf.json, uten Apple-konto).
# Guiden skrives ut fra docs/guide/guide_read_me.html med Chrome.
set -euo pipefail
cd "$(dirname "$0")/.."

versjon=$(node -p "require('./package.json').version")
app="src-tauri/target/universal-apple-darwin/release/bundle/macos/Økta.app"
ut="dist-dmg"
dmg="$ut/Økta $versjon.dmg"

if [[ "${HOPP_OVER_BYGG:-}" != "1" ]]; then
  npm run tauri build -- --target universal-apple-darwin
fi
[[ -d "$app" ]] || { echo "Fant ikke $app"; exit 1; }

# Guiden, skrevet ut på nytt så den alltid følger HTML-en.
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ -x "$chrome" ]]; then
  "$chrome" --headless=new --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="docs/guide/guide_read_me.pdf" \
    "file://$PWD/docs/guide/guide_read_me.html" >/dev/null 2>&1
fi

# Ingen data skal følge med: databasen ligger i Application Support, aldri
# i appen. Sjekk det likevel.
if find "$app" -iname "*.sqlite*" -o -iname "*.okta" | grep -q .; then
  echo "Appen inneholder en database eller oppsettfil. Stopper."; exit 1
fi

rm -rf "$ut/innhold" && mkdir -p "$ut/innhold"
cp -R "$app" "$ut/innhold/"
ln -s /Applications "$ut/innhold/Programmer"
cp docs/guide/guide_read_me.pdf "$ut/innhold/"
rm -f "$dmg"
hdiutil create -volname "Økta $versjon" -srcfolder "$ut/innhold" -ov -format UDZO "$dmg" >/dev/null
rm -rf "$ut/innhold"

echo "Ferdig: $dmg"
codesign -dv "$app" 2>&1 | grep -E "Signature|Identifier" || true
lipo -archs "$app/Contents/MacOS/okta"
