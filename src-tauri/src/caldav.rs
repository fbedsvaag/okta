//! Publisering av timeplanen til brukerens egen kalenderserver, SPEC §8.1.
//!
//! # Hvorfor dette er lov
//!
//! §1 sier null nettverkskall. §8.1 gjør ett avgrenset unntak, godkjent av
//! eieren: appen kan skrive timeplanen til én CalDAV-adresse brukeren selv
//! har lagt inn. Fem felter går ut — fag, tittel, dato, klokkeslett, sted.
//!
//! # Tre egenskaper som holder unntaket smalt
//!
//! 1. **Enveis.** Modulen har `PUT` og `DELETE`, ingen `GET` eller `REPORT`.
//!    Den kan ikke hente kalenderdata inn i basen, uansett hva serveren
//!    svarer. En kompromittert server kan derfor ikke påvirke databasen.
//! 2. **Dum.** Den vet ikke hva den sender. Innholdet lages i `ical.ts`, som
//!    er det ene stedet feltlista håndheves. Denne fila skal aldri lese fra
//!    databasen selv.
//! 3. **Passordet ligger i nøkkelringen**, ikke i basen. Databasen kopieres
//!    til `backup/` og kan bli delt; legitimasjon hører ikke hjemme der.

use keyring::Entry;
use std::time::Duration;

/// Klient med tidsgrenser.
///
/// Uten dem kan en tilkobling som ikke svarer henge i det uendelige. En
/// skolelaptop bytter nett midt i dagen, og da skal publiseringen gi opp og
/// prøve igjen senere — ikke bli stående.
fn klient() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(8))
        .timeout(Duration::from_secs(20))
        .resolver(ipv4_forst)
        .build()
}

/// Slår opp verten og setter IPv4 først.
///
/// Mange maskiner har en IPv6-adresse uten å ha en vei ut på IPv6 — en
/// VPN som Tailscale gir deg en, og da ser stakken ut som om IPv6 virker.
/// Har tjeneren både A- og AAAA-oppslag, treffer et IPv6-forsøk da veggen
/// med «No route to host», mens nettleseren ved siden av virker fint. Den
/// prøver nemlig begge samtidig og bruker den som svarer først.
///
/// Vi gjør det enklere: IPv4 først, IPv6 som reserve. Det holder for en
/// app som skriver til én server brukeren har valgt selv.
fn ipv4_forst(netloc: &str) -> std::io::Result<Vec<std::net::SocketAddr>> {
    use std::net::ToSocketAddrs;
    let alle: Vec<std::net::SocketAddr> = netloc.to_socket_addrs()?.collect();
    let mut sortert: Vec<_> = alle.iter().copied().filter(|a| a.is_ipv4()).collect();
    sortert.extend(alle.iter().copied().filter(|a| a.is_ipv6()));
    Ok(sortert)
}

const TJENESTE: &str = "no.elevtracking.app";
const KONTO: &str = "caldav";

fn nokkelring() -> Result<Entry, String> {
    Entry::new(TJENESTE, KONTO).map_err(|e| format!("fikk ikke tilgang til nøkkelringen: {e}"))
}

#[tauri::command]
pub fn caldav_lagre_passord(passord: String) -> Result<(), String> {
    // App-passord limes ofte inn med et linjeskift eller mellomrom på slutten.
    // Det gir 401 uten at noe ser galt ut, så vi klipper det bort her.
    nokkelring()?
        .set_password(passord.trim())
        .map_err(|e| format!("klarte ikke lagre passordet: {e}"))
}

#[tauri::command]
pub fn caldav_har_passord() -> bool {
    nokkelring().and_then(|e| e.get_password().map_err(|x| x.to_string())).is_ok()
}

#[tauri::command]
pub fn caldav_glem_passord() -> Result<(), String> {
    match nokkelring()?.delete_credential() {
        Ok(()) => Ok(()),
        // Ikke en feil å glemme noe som ikke er der.
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("klarte ikke slette passordet: {e}")),
    }
}

fn passord() -> Result<String, String> {
    nokkelring()?
        .get_password()
        .map_err(|_| "Ingen passord lagret. Legg det inn i innstillingene.".to_string())
}

/// Samlingens URL, med skråstrek på slutten så sammenslåing blir riktig.
fn samling(url: &str) -> String {
    if url.ends_with('/') {
        url.to_string()
    } else {
        format!("{url}/")
    }
}

/// Sjekker at adressen svarer og at innlogingen holder.
///
/// Bruker `OPTIONS`, som bare returnerer hvilke metoder serveren støtter —
/// ingen kalenderdata. Det er nok til å skille «feil passord» fra «feil
/// adresse», uten å hente noe innhold.
/// MERK: `async` med `spawn_blocking` er ikke pynt. Tauri kjører synkrone
/// kommandoer på hovedtråden, og da fryser hele grensesnittet mens nettverket
/// arbeider — brukeren får badeball. Nettverkskall skal aldri være synkrone
/// kommandoer.
#[tauri::command]
pub async fn caldav_test(url: String, bruker: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || test_blokkerende(url, bruker))
        .await
        .map_err(|e| format!("intern feil: {e}"))?
}

fn test_blokkerende(url: String, bruker: String) -> Result<String, String> {
    let pw = passord()?;
    let svar = klient()
        .request("OPTIONS", &samling(&url))
        .set("Authorization", &basic(&bruker, &pw))
        .call();

    match svar {
        Ok(r) => {
            let dav = r.header("DAV").unwrap_or("").to_string();
            if dav.contains("calendar-access") {
                Ok("Tilkoblingen virker.".into())
            } else {
                Ok("Serveren svarte, men meldte ikke kalenderstøtte. Sjekk at \
                    adressen peker på en kalender, ikke på forsiden."
                    .into())
            }
        }
        Err(ureq::Error::Status(401, _)) => Err(format!(
            "Serveren avviste innloggingen (401).\n\nPrøvde: {}\nBrukernavn: {}\n\nSjekk at brukernavnet er det du logger inn med, ikke visningsnavnet eller e-postadressen, og at app-passordet er kopiert i sin helhet.",
            samling(&url),
            bruker
        )),
        Err(ureq::Error::Status(404, _)) => Err(format!(
            "Fant ingenting på {}.\n\nAdressen skal slutte med brukernavnet ditt, \
             uten kalendernavn.",
            samling(&url)
        )),
        Err(ureq::Error::Status(kode, _)) => {
            Err(format!("Serveren svarte {kode} på {}.", samling(&url)))
        }
        Err(e) => Err(format!("Fikk ikke kontakt: {e}")),
    }
}

#[derive(serde::Deserialize)]
pub struct Hendelse {
    pub uid: String,
    pub ics: String,
}

#[derive(serde::Serialize, Default)]
pub struct Resultat {
    pub skrevet: usize,
    pub slettet: usize,
    /// Feil som ikke stoppet resten. Vises samlet i innstillingene.
    pub feil: Vec<String>,
    /// Sant hvis vi ga opp fordi serveren ikke svarte i det hele tatt.
    pub avbrutt: bool,
}

/// Skriver hendelsene og fjerner dem som er slettet.
///
/// Frontend bestemmer hva som skal skrives og hva som skal bort — den vet
/// hvilke økter som fantes sist. Serveren spørres aldri om hva den har.
#[tauri::command]
pub async fn caldav_publiser(
    url: String,
    bruker: String,
    hendelser: Vec<Hendelse>,
    fjern: Vec<String>,
) -> Result<Resultat, String> {
    tauri::async_runtime::spawn_blocking(move || {
        publiser_blokkerende(url, bruker, hendelser, fjern)
    })
    .await
    .map_err(|e| format!("intern feil: {e}"))?
}

fn publiser_blokkerende(
    url: String,
    bruker: String,
    hendelser: Vec<Hendelse>,
    fjern: Vec<String>,
) -> Result<Resultat, String> {
    let pw = passord()?;
    let agent = klient();
    let auth = basic(&bruker, &pw);
    let base = samling(&url);
    let mut ut = Resultat::default();

    for h in hendelser {
        let mal = format!("{base}{}.ics", h.uid);
        match agent
            .put(&mal)
            .set("Authorization", &auth)
            .set("Content-Type", "text/calendar; charset=utf-8")
            .send_string(&h.ics)
        {
            Ok(_) => ut.skrevet += 1,
            // En statusfeil gjelder denne ene ressursen — vi går videre.
            Err(e @ ureq::Error::Status(_, _)) => {
                ut.feil.push(format!("{}: {e}", h.uid))
            }
            // En transportfeil betyr at serveren ikke er der. Da er det
            // ingen vits i å prøve resten: 80 timeouter til er elleve
            // minutter med nytteløst arbeid.
            Err(e) => {
                ut.feil.push(format!("{}: {e}", h.uid));
                ut.avbrutt = true;
                return Ok(ut);
            }
        }
    }

    for uid in fjern {
        let mal = format!("{base}{uid}.ics");
        match agent.delete(&mal).set("Authorization", &auth).call() {
            Ok(_) => ut.slettet += 1,
            // Borte fra før er et greit utfall for en sletting.
            Err(ureq::Error::Status(404, _)) => ut.slettet += 1,
            Err(e @ ureq::Error::Status(_, _)) => ut.feil.push(format!("{uid}: {e}")),
            Err(e) => {
                ut.feil.push(format!("{uid}: {e}"));
                ut.avbrutt = true;
                return Ok(ut);
            }
        }
    }

    Ok(ut)
}

fn basic(bruker: &str, passord: &str) -> String {
    use base64::Engine;
    let par = format!("{bruker}:{passord}");
    format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(par)
    )
}

#[cfg(test)]
mod tester {
    use super::ipv4_forst;

    /// localhost slår opp til både 127.0.0.1 og ::1, så den er en grei prøve
    /// på at sorteringen faktisk skjer.
    #[test]
    fn setter_ipv4_forst() {
        let adr = ipv4_forst("localhost:443").expect("oppslag");
        let v4 = adr.iter().position(|a| a.is_ipv4());
        let v6 = adr.iter().position(|a| a.is_ipv6());
        if let (Some(a), Some(b)) = (v4, v6) {
            assert!(a < b, "IPv4 skal komme før IPv6, fikk {adr:?}");
        }
    }

    #[test]
    fn mister_ingen_adresser() {
        use std::net::ToSocketAddrs;
        let fasit = "localhost:443".to_socket_addrs().unwrap().count();
        assert_eq!(ipv4_forst("localhost:443").unwrap().len(), fasit);
    }
}
