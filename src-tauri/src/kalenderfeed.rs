//! Lokal iCalendar-strøm, slik at kalenderen kan abonnere på årsplanen.
//!
//! # Om §1
//!
//! SPEC §1 sier null nettverkskall i appen. Den regelen handler om at appen
//! ikke skal ringe *ut* — ingen telemetri, ingen oppdateringssjekk, ingen
//! API-er. Dette er det motsatte: en lytter på loopback som bare svarer på
//! spørsmål fra samme maskin. Ingen data forlater maskinen herfra.
//!
//! Tre valg som følger av det:
//!
//! 1. **Bindes til `127.0.0.1`, aldri `0.0.0.0`.** Loopback betyr at ingen
//!    annen maskin kan nå den, heller ikke på samme nettverk.
//! 2. **Av som standard.** Ingenting lytter før brukeren slår det på.
//! 3. **Bare den som kjenner adressen, og bare via loopback-navnet (#11).**
//!    Adressen har en tilfeldig nøkkel (`/<nøkkel>/arsplan.ics`), så andre
//!    programmer på maskinen ikke kan gjette den. Og `Host` må være
//!    `127.0.0.1:8787` eller `localhost:8787`: en nettside som får sitt eget
//!    domenenavn til å peke på 127.0.0.1 (DNS rebinding), sender sitt eget
//!    navn i `Host` og blir avvist.
//! 4. **Bare timeplanen serveres.** Innholdet lages i frontend, som holder
//!    elevnavn, skåringer og arbeidsnotater utenfor. Denne fila vet ikke hva
//!    den serverer, og skal ikke begynne å lese databasen selv.
//!
//! Merk at abonnementet i macOS Calendar kan lagres i iCloud. Da lastes
//! innholdet opp til Apple, uansett hvor lokal denne serveren er. Det er et
//! bevisst valg brukeren tar når abonnementet opprettes.

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::thread;
use tauri::{AppHandle, Manager};

pub const PORT: u16 = 8787;
const FIL: &str = "arsplan.ics";
const NOKKELFIL: &str = "kalenderfeed-nokkel.txt";

/// Den hemmelige delen av adressen. Lages én gang og huskes i appens
/// datamappe, så abonnementet i kalenderen virker etter omstart.
fn nokkel(app: &AppHandle) -> Result<String, String> {
    static NOKKEL: OnceLock<String> = OnceLock::new();
    if let Some(n) = NOKKEL.get() {
        return Ok(n.clone());
    }
    let fil: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("fant ikke appens data-mappe: {e}"))?
        .join(NOKKELFIL);
    let lagret = std::fs::read_to_string(&fil)
        .ok()
        .map(|t| t.trim().to_string())
        .filter(|t| t.len() == 32 && t.bytes().all(|b| b.is_ascii_hexdigit()));
    let n = match lagret {
        Some(n) => n,
        None => {
            let mut bytes = [0u8; 16];
            getrandom::fill(&mut bytes).map_err(|e| format!("tilfeldige tall: {e}"))?;
            let n: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
            if let Some(f) = fil.parent() {
                std::fs::create_dir_all(f).map_err(|e| e.to_string())?;
            }
            std::fs::write(&fil, &n).map_err(|e| format!("klarte ikke lagre nøkkelen: {e}"))?;
            n
        }
    };
    Ok(NOKKEL.get_or_init(|| n).clone())
}

/// Skal forespørselen få timeplanen? Riktig `Host` og riktig sti med nøkkel.
fn godta(host: Option<&str>, url: &str, nokkel: &str) -> bool {
    let host_ok = host.is_some_and(|h| {
        let h = h.trim().to_ascii_lowercase();
        h == format!("127.0.0.1:{PORT}") || h == format!("localhost:{PORT}")
    });
    let sti = url.split(['?', '#']).next().unwrap_or("");
    host_ok && sti == format!("/{nokkel}/{FIL}")
}

/// Innholdet som serveres. Frontend skyver en ny versjon hit hver gang
/// øktene endrer seg; serveren leser bare.
fn innhold() -> &'static Mutex<String> {
    static INNHOLD: OnceLock<Mutex<String>> = OnceLock::new();
    INNHOLD.get_or_init(|| Mutex::new(String::new()))
}

/// Om lytteren er startet. Én gang per prosess — den kan ikke stoppes igjen
/// uten å avslutte appen, så «av» betyr at den aldri ble startet.
fn startet() -> &'static Mutex<bool> {
    static STARTET: OnceLock<Mutex<bool>> = OnceLock::new();
    STARTET.get_or_init(|| Mutex::new(false))
}

#[tauri::command]
pub fn sett_kalenderfeed(ics: String) {
    *innhold().lock().unwrap() = ics;
}

#[tauri::command]
pub fn kalenderfeed_url(app: AppHandle) -> Result<String, String> {
    Ok(format!("http://127.0.0.1:{PORT}/{}/{FIL}", nokkel(&app)?))
}

#[tauri::command]
pub fn kalenderfeed_kjorer() -> bool {
    *startet().lock().unwrap()
}

/// Starter lytteren hvis den ikke alt kjører. Returnerer feilteksten hvis
/// porten er opptatt, slik at innstillingene kan si fra i stedet for å la
/// brukeren lure på hvorfor kalenderen er tom.
#[tauri::command]
pub fn start_kalenderfeed(app: AppHandle) -> Result<String, String> {
    let mut pa = startet().lock().unwrap();
    if *pa {
        return kalenderfeed_url(app);
    }
    let hemmelig = nokkel(&app)?;

    let tjener = tiny_http::Server::http(("127.0.0.1", PORT))
        .map_err(|e| format!("klarte ikke lytte på port {PORT}: {e}"))?;

    thread::spawn(move || {
        for foresporsel in tjener.incoming_requests() {
            let host = foresporsel
                .headers()
                .iter()
                .find(|h| h.field.equiv("Host"))
                .map(|h| h.value.as_str().to_string());
            let treff = godta(host.as_deref(), foresporsel.url(), &hemmelig);
            let svar = if treff {
                let tekst = innhold().lock().unwrap().clone();
                tiny_http::Response::from_string(tekst)
                    .with_header(
                        "Content-Type: text/calendar; charset=utf-8"
                            .parse::<tiny_http::Header>()
                            .unwrap(),
                    )
                    // Kalenderen skal se endringer med en gang, ikke en
                    // mellomlagret kopi fra forrige henting.
                    .with_header(
                        "Cache-Control: no-store"
                            .parse::<tiny_http::Header>()
                            .unwrap(),
                    )
                    .boxed()
            } else {
                tiny_http::Response::empty(404).boxed()
            };
            let _ = foresporsel.respond(svar);
        }
    });

    *pa = true;
    kalenderfeed_url(app)
}

#[cfg(test)]
mod tester {
    use super::godta;
    const N: &str = "0123456789abcdef0123456789abcdef";

    #[test]
    fn riktig_host_og_nokkel_faar_svar() {
        let sti = format!("/{N}/arsplan.ics");
        assert!(godta(Some("127.0.0.1:8787"), &sti, N));
        assert!(godta(Some("localhost:8787"), &sti, N));
        assert!(godta(Some("LOCALHOST:8787"), &format!("{sti}?x=1"), N));
    }

    #[test]
    fn dns_rebinding_avvises() {
        let sti = format!("/{N}/arsplan.ics");
        assert!(!godta(Some("angriper.example:8787"), &sti, N));
        assert!(!godta(Some("127.0.0.1.angriper.example:8787"), &sti, N));
        assert!(!godta(None, &sti, N));
    }

    #[test]
    fn uten_riktig_nokkel_avvises() {
        assert!(!godta(Some("127.0.0.1:8787"), "/arsplan.ics", N));
        assert!(!godta(Some("127.0.0.1:8787"), "/feil/arsplan.ics", N));
        assert!(!godta(Some("127.0.0.1:8787"), &format!("/{N}/annet.ics"), N));
        assert!(!godta(Some("127.0.0.1:8787"), &format!("/{N}/arsplan.ics/x"), N));
    }
}

