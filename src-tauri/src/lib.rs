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
mod filer;
mod kalenderfeed;
mod sikkerhetskopi;
mod system;

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
        Migration {
            version: 11,
            description: "notater og møtelogg per elev",
            sql: include_str!("../migrations/011_motelogg.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "samtaledager og samtaler",
            sql: include_str!("../migrations/012_samtale.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "notatet fra en samtale hører til møteloggen",
            sql: include_str!("../migrations/013_samtalenotat.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "årsplanarket: rom, faglærer, kompetansemål, arknotat, lekse",
            sql: include_str!("../migrations/014_arsplanark.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "vurderinger knyttes til økta på fristdagen",
            sql: include_str!("../migrations/015_vurdering_okt.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "én vurdering over flere økter, samtaledag i en økt",
            sql: include_str!("../migrations/016_vurdering_flere_okter.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "perioden står på økta: fargelegging i stedet for datoer",
            sql: include_str!("../migrations/017_periode_malt.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "et fag kan ha et kallenavn",
            sql: include_str!("../migrations/018_fag_alias.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "rydd bort data som henger igjen etter slettede elever",
            sql: include_str!("../migrations/019_rydd_slettede_elever.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 20,
            description: "kompetansemål knyttet til en økt",
            sql: include_str!("../migrations/020_okt_kompetansemal.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 21,
            description: "bilde av eleven",
            sql: include_str!("../migrations/021_elevbilde.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 22,
            description: "notatet i en økt, uavhengig av skåringen",
            sql: include_str!("../migrations/022_oktnotat.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 23,
            description: "gjøremål uten elev",
            sql: include_str!("../migrations/023_gjoremal.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 24,
            description: "klassekart, rom og kjønn på eleven",
            sql: include_str!("../migrations/024_klassekart.sql"),
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

/// Oppsettfila som er åpnet med dobbeltklikk (ARBEIDSLISTE 5.13), til
/// appen spør etter den. macOS kan sende fila før vinduet er klart, så den
/// holdes her i stedet for bare å sendes som hendelse.
#[derive(Default)]
struct ApnetFil(std::sync::Mutex<Option<String>>);

/// Henter og glemmer stien til en oppsettfil som er åpnet med dobbeltklikk.
#[tauri::command]
fn ta_apnet_oppsettfil(tilstand: tauri::State<ApnetFil>) -> Option<String> {
    tilstand.0.lock().ok()?.take()
}

/// Leser en oppsettfil. Bare `.okta`, og bare små filer: dette er ikke en
/// generell måte å lese filer på disken.
#[tauri::command]
fn les_oppsettfil(sti: String) -> Result<String, String> {
    if !sti.to_lowercase().ends_with(".okta") {
        return Err("Det er ikke en oppsettfil (.okta).".into());
    }
    let meta = std::fs::metadata(&sti).map_err(|e| format!("Fant ikke fila: {e}"))?;
    if meta.len() > 2_000_000 {
        return Err("Fila er for stor til å være en oppsettfil.".into());
    }
    std::fs::read_to_string(&sti).map_err(|e| format!("Kunne ikke lese fila: {e}"))
}

/// Stien til en .okta-fil blant argumentene programmet fikk (14.4). På
/// Windows kommer en dobbeltklikket fil slik, både ved oppstart og når
/// en ny prosess sender den videre. En relativ sti gjøres om fra `mappe`.
fn oppsettfil_i_argumenter(argumenter: &[String], mappe: &std::path::Path) -> Option<String> {
    argumenter
        .iter()
        .skip(1) // programmet selv
        .find(|a| a.to_lowercase().ends_with(".okta"))
        .map(|a| {
            let sti = std::path::Path::new(a);
            if sti.is_absolute() {
                a.clone()
            } else {
                mappe.join(sti).to_string_lossy().into_owned()
            }
        })
}

/// Hold stien til en åpnet oppsettfil, og si fra til vinduet.
fn ta_imot_oppsettfil(app: &tauri::AppHandle, sti: String) {
    use tauri::{Emitter, Manager};
    if let Ok(mut f) = app.state::<ApnetFil>().0.lock() {
        *f = Some(sti);
    }
    let _ = app.emit("oppsettfil-apnet", ());
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let bygger = tauri::Builder::default();

    // Windows og Linux: en ny prosess (dobbeltklikk på en .okta-fil mens
    // appen kjører) sender argumentene hit og avslutter. Pluginen må stå
    // først. Mac gjør dette selv, med RunEvent::Opened lenger ned.
    #[cfg(not(target_os = "macos"))]
    let bygger = bygger.plugin(tauri_plugin_single_instance::init(
        |app, argumenter, mappe| {
            use tauri::Manager;
            if let Some(sti) = oppsettfil_i_argumenter(&argumenter, std::path::Path::new(&mappe)) {
                ta_imot_oppsettfil(app, sti);
            }
            if let Some(vindu) = app.get_webview_window("main") {
                let _ = vindu.unminimize();
                let _ = vindu.set_focus();
            }
        },
    ));

    // Windows og Linux: appen startet med dobbeltklikk på en .okta-fil.
    let ved_oppstart = if cfg!(target_os = "macos") {
        None
    } else {
        let argumenter: Vec<String> = std::env::args().collect();
        let mappe = std::env::current_dir().unwrap_or_default();
        oppsettfil_i_argumenter(&argumenter, &mappe)
    };

    bygger
        .manage(ApnetFil(std::sync::Mutex::new(ved_oppstart)))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:elevtracking.sqlite", migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            skriv_ut,
            filer::lagre_fil,
            system::systemversjon,
            sikkerhetskopi::forbered_sikkerhetskopi,
            sikkerhetskopi::sikkerhetskopier,
            sikkerhetskopi::rydd_sikkerhetskopier,
            sikkerhetskopi::sikkerhetskopimappe,
            sikkerhetskopi::gjenopprett_fra,
            kalenderfeed::sett_kalenderfeed,
            kalenderfeed::kalenderfeed_url,
            kalenderfeed::kalenderfeed_kjorer,
            kalenderfeed::start_kalenderfeed,
            caldav::caldav_lagre_passord,
            caldav::caldav_har_passord,
            caldav::caldav_glem_passord,
            caldav::caldav_test,
            caldav::caldav_publiser,
            arkiv::skriv_arkiv,
            arkiv::hent_arkivmappe,
            arkiv::velg_arkivmappe,
            ta_apnet_oppsettfil,
            les_oppsettfil,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, hendelse| {
            // Dobbeltklikk på en .okta-fil: hold stien, og si fra til
            // vinduet hvis det allerede kjører.
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = hendelse {
                if let Some(sti) = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned())
                    .find(|p| p.to_lowercase().ends_with(".okta"))
                {
                    ta_imot_oppsettfil(app, sti);
                }
            }
            #[cfg(not(any(target_os = "macos", target_os = "ios")))]
            let _ = (app, hendelse);
        });
}

#[cfg(test)]
mod tester {
    use super::oppsettfil_i_argumenter;
    use std::path::Path;

    fn arg(a: &[&str]) -> Vec<String> {
        a.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn finner_oppsettfila_blant_argumentene() {
        let mappe = std::env::temp_dir();
        let full = mappe.join("Skolen.okta").to_string_lossy().into_owned();
        assert_eq!(
            oppsettfil_i_argumenter(&arg(&["okta.exe", &full]), &mappe),
            Some(full.clone())
        );
        // Store bokstaver i endelsen, og andre argumenter foran.
        let stor = mappe.join("SKOLEN.OKTA").to_string_lossy().into_owned();
        assert_eq!(
            oppsettfil_i_argumenter(&arg(&["okta.exe", "--flagg", &stor]), &mappe),
            Some(stor)
        );
    }

    #[test]
    fn relativ_sti_gjores_om_fra_mappa() {
        let mappe = std::env::temp_dir();
        assert_eq!(
            oppsettfil_i_argumenter(&arg(&["okta.exe", "Skolen.okta"]), &mappe),
            Some(mappe.join("Skolen.okta").to_string_lossy().into_owned())
        );
    }

    #[test]
    fn ingen_oppsettfil() {
        let mappe = Path::new(".");
        assert_eq!(oppsettfil_i_argumenter(&arg(&["okta.exe"]), mappe), None);
        assert_eq!(
            oppsettfil_i_argumenter(&arg(&["okta.exe", "notat.txt"]), mappe),
            None
        );
        // Programmet selv teller ikke, selv om det skulle hete noe.okta.
        assert_eq!(oppsettfil_i_argumenter(&arg(&["app.okta"]), mappe), None);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_sti_med_mellomrom_og_stasjon() {
        let sti = r"C:\Users\Lærer Navn\Downloads\Skolen 2026.okta";
        assert_eq!(
            oppsettfil_i_argumenter(&arg(&["okta.exe", sti]), Path::new(r"C:\")),
            Some(sti.to_string())
        );
    }
}
