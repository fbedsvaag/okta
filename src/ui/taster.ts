/**
 * Hurtigtaster på Mac og Windows (ARBEIDSLISTE 14.2).
 *
 * Mac bruker ⌘ der Windows bruker Ctrl. All kode som spør om hovedtasten
 * eller viser en snarvei, går gjennom denne fila, så forskjellen står ett
 * sted og kan testes uten en Windows-maskin.
 */

type Modifikatorer = {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

/** Kjører appen på en Mac? Leses én gang fra nettleseren. */
export const erMac: boolean =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/i.test(
    (navigator as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ??
      navigator.platform ??
      navigator.userAgent,
  );

/** Hovedtasten: ⌘ på Mac, Ctrl ellers. */
export function hovedtast(e: Modifikatorer, mac: boolean = erMac): boolean {
  return mac ? e.metaKey : e.ctrlKey;
}

/**
 * Er en tast som gjør bokstaven til noe annet enn en bokstav trykket?
 * Bokstavsnarveiene (G E, N, R …) skal bare virke uten dem.
 */
export function harModifikator(e: Modifikatorer): boolean {
  return e.metaKey || e.ctrlKey;
}

const WIN: Record<string, string> = {
  "⌘": "Ctrl",
  "⇧": "Shift",
  "⌥": "Alt",
  "⌃": "Ctrl",
};
const REKKEFOLGE = ["Ctrl", "Shift", "Alt"];

/**
 * En snarvei slik den skal vises: «⇧⌘E» på Mac, «Ctrl+Shift+E» ellers.
 * Skriv alltid snarveien med Mac-tegnene; denne gjør om for Windows.
 */
export function tast(snarvei: string, mac: boolean = erMac): string {
  if (mac) return snarvei;
  const tegn = [...snarvei];
  const mod = new Set<string>();
  let i = 0;
  while (i < tegn.length && WIN[tegn[i]]) mod.add(WIN[tegn[i++]]);
  const resten = tegn
    .slice(i)
    .join("")
    .replace("↵", "Enter")
    .replace("⌫", "Backspace");
  const deler = REKKEFOLGE.filter((m) => mod.has(m));
  if (resten) deler.push(resten);
  return deler.join("+");
}

/**
 * Snarveier WebView2 på Windows ellers tar selv: skriv ut, søk på siden,
 * last inn på nytt og lukk. Appen skal få dem, nettleseren ikke.
 */
export function nettleserSnarvei(
  e: Modifikatorer & { key: string },
  mac: boolean = erMac,
): boolean {
  if (mac) return false;
  if (e.key === "F5" || e.key === "F3") return true;
  if (!e.ctrlKey || e.altKey) return false;
  return ["p", "f", "r", "w", "g"].includes(e.key.toLowerCase());
}
