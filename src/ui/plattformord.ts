import { erMac } from "./taster";

/**
 * Ord som er forskjellige på Mac og Windows (ARBEIDSLISTE 14.3 og 14.5).
 * Samlet her, så de kan testes uten en Windows-maskin.
 */

/** Der passordet til kalenderen lagres: «nøkkelringen» på Mac. */
export function nokkelringen(mac: boolean = erMac): string {
  return mac ? "nøkkelringen" : "Windows legitimasjonsbehandling";
}

/** Filbehandleren: «Finder» på Mac, «Filutforsker» på Windows. */
export function filbehandler(mac: boolean = erMac): string {
  return mac ? "Finder" : "Filutforsker";
}

/** Systemet selv, i «Som macOS» for lys/mørk og bevegelse. */
export function systemnavn(mac: boolean = erMac): string {
  return mac ? "macOS" : "Windows";
}

/** Hjelpeteksten under Glass. Windows har ingen «Reduser gjennomsiktighet». */
export function glasshjelp(mac: boolean = erMac): string {
  const grunn =
    "Sidemenyen og søket er gjennomsiktige, med farge bak. Av gir hele flater.";
  return mac
    ? `${grunn} Står «Reduser gjennomsiktighet» på i macOS, er glasset av uansett.`
    : grunn;
}

/** Hjelpeteksten under Bevegelse. */
export function bevegelseshjelp(mac: boolean = erMac): string {
  const innstilling = mac
    ? "«Reduser bevegelse» er på i systemet"
    : "«Animasjonseffekter» er av i Windows";
  return `Kort, myk bevegelse når noe åpnes, foldes ut eller dras. Skåringen beveger seg aldri. «Som ${systemnavn(mac)}» slår den av når ${innstilling}.`;
}

/**
 * Advarselen om synkmapper. På Windows ligger Dokumenter og Skrivebord
 * ofte i OneDrive uten at man vet det, så den nevnes først og for seg.
 */
export function synkadvarsel(mac: boolean = erMac): string {
  const hvorfor =
    "Synk kan skrive delvis tilbake i ei åpen SQLite-fil, og da blir den ødelagt uten forvarsel.";
  return mac
    ? `Mappa skal aldri legges i iCloud, Dropbox eller annen synktjeneste. ${hvorfor}`
    : `Mappa skal aldri legges i OneDrive, Dropbox eller annen synktjeneste. På Windows ligger Dokumenter og Skrivebord ofte i OneDrive, så velg ikke en mappe der. ${hvorfor}`;
}
