//! Økta — undervisningsplanlegging og elevoppfølging.
//!
//! MERK at bundle-identifikatoren i tauri.conf.json fortsatt er
//! `no.elevtracking.app`, fra før appen fikk navn. Den er med vilje ikke
//! endret: `app_data_dir()` bygger på den, så en ny identifikator ville lagt
//! databasen, sikkerhetskopiene og nøkkelringoppføringen et nytt sted — og
//! alt brukeren har lagt inn ville sett ut som det var borte. Samme grunn
//! til at databasefila fortsatt heter `elevtracking.sqlite`.
//!
//! Skal de endres, må dataene flyttes i samme operasjon.

mod arkiv;
mod caldav;
mod kalenderfeed;
mod sikkerhetskopi;

use tauri_plugin_sql::{Migration, MigrationKind};

// Migrasjoner er nummererte SQL-filer, ikke ad hoc CREATE TABLE IF NOT EXISTS.
// Ny fil -> nytt versjonsnummer -> ny linje her. Aldri rediger en som har kjørt.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "grunnschema",
            sql: include_str!("../migrations/001_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed skalaer og innstillinger",
            sql: include_str!("../migrations/002_seed_skalaer.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "lesbar elevkode",
            sql: include_str!("../migrations/003_elevkode.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "notatfelt på eleven",
            sql: include_str!("../migrations/004_elevnotat.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "fridager i skoleåret",
            sql: include_str!("../migrations/005_fridag.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "sted på økta",
            sql: include_str!("../migrations/006_okt_sted.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "agenda på økta",
            sql: include_str!("../migrations/007_okt_agenda.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "fagkode fra Udir",
            sql: include_str!("../migrations/008_fag_grep.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "kompetansemål per periode",
            sql: include_str!("../migrations/009_periode_kompetansemal.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "mentorgruppe som delmengde av klassen",
            sql: include_str!("../migrations/010_mentor.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Utskrift, SPEC §4.9.
///
/// `window.print()` i frontend gjør ingenting: WKWebView på macOS kobler den
/// ikke opp, og Tauri viderefører ikke kallet. Utskriftsdialogen må startes
/// fra Rust-siden, som her.
#[tauri::command]
fn skriv_ut(vindu: tauri::WebviewWindow) -> Result<(), String> {
    vindu.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:elevtracking.sqlite", migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            skriv_ut,
            sikkerhetskopi::forbered_sikkerhetskopi,
            sikkerhetskopi::sikkerhetskopier,
            sikkerhetskopi::rydd_sikkerhetskopier,
            sikkerhetskopi::sikkerhetskopimappe,
            sikkerhetskopi::arkivmappe,
            sikkerhetskopi::gjenopprett_fra,
            kalenderfeed::sett_kalenderfeed,
            kalenderfeed::kalenderfeed_url,
            kalenderfeed::kalenderfeed_kjorer,
            kalenderfeed::start_kalenderfeed,
            kalenderfeed::skriv_kalenderfil,
            caldav::caldav_lagre_passord,
            caldav::caldav_har_passord,
            caldav::caldav_glem_passord,
            caldav::caldav_test,
            caldav::caldav_publiser,
            arkiv::skriv_arkiv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
