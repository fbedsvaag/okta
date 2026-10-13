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
//! 3. **Bare timeplanen serveres.** Innholdet lages i frontend, som holder
//!    elevnavn, skåringer og arbeidsnotater utenfor. Denne fila vet ikke hva
//!    den serverer, og skal ikke begynne å lese databasen selv.
//!
//! Merk at abonnementet i macOS Calendar kan lagres i iCloud. Da lastes
//! innholdet opp til Apple, uansett hvor lokal denne serveren er. Det er et
//! bevisst valg brukeren tar når abonnementet opprettes.

use std::sync::{Mutex, OnceLock};
use std::thread;

pub const PORT: u16 = 8787;
const STI: &str = "/arsplan.ics";

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
pub fn kalenderfeed_url() -> String {
    format!("http://127.0.0.1:{PORT}{STI}")
}

#[tauri::command]
pub fn kalenderfeed_kjorer() -> bool {
    *startet().lock().unwrap()
}

/// Starter lytteren hvis den ikke alt kjører. Returnerer feilteksten hvis
/// porten er opptatt, slik at innstillingene kan si fra i stedet for å la
/// brukeren lure på hvorfor kalenderen er tom.
#[tauri::command]
pub fn start_kalenderfeed() -> Result<String, String> {
    let mut pa = startet().lock().unwrap();
    if *pa {
        return Ok(kalenderfeed_url());
    }

    let tjener = tiny_http::Server::http(("127.0.0.1", PORT))
        .map_err(|e| format!("klarte ikke lytte på port {PORT}: {e}"))?;

    thread::spawn(move || {
        for foresporsel in tjener.incoming_requests() {
            let treff = foresporsel.url().starts_with(STI);
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
    Ok(kalenderfeed_url())
}

