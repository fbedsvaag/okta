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
            sikkerhetskopi::gjenopprett_fra,
            kalenderfeed::sett_kalenderfeed,
            kalenderfeed::kalenderfeed_url,
            kalenderfeed::kalenderfeed_kjorer,
            kalenderfeed::start_kalenderfeed,
            kalenderfeed::skriv_kalenderfil,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
