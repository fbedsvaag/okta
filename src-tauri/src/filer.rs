//! Lagring av eksportfiler: årsplanen (.md, .csv, .docx), klassekartet
//! (.png) og oppsettfila (.okta). Issue #1.
//!
//! Rust åpner lagre-dialogen selv og skriver fila. Stien går aldri via
//! webvisningen, så et skript i vinduet kan ikke skrive noe annet sted enn
//! der brukeren selv har pekt i dialogen.

use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// Åpner lagre-dialogen og skriver `innhold` dit brukeren velger.
/// Gir stien tilbake, eller `None` hvis dialogen ble avbrutt.
#[tauri::command]
pub async fn lagre_fil(
    app: AppHandle,
    filnavn: String,
    filternavn: String,
    endelse: String,
    innhold: Vec<u8>,
) -> Result<Option<String>, String> {
    let endelse = ren_endelse(&endelse)?;
    let forslag = rent_filnavn(&filnavn);
    let valgt = tauri::async_runtime::spawn_blocking({
        let endelse = endelse.clone();
        move || {
            app.dialog()
                .file()
                .set_file_name(forslag)
                .add_filter(filternavn, &[endelse.as_str()])
                .blocking_save_file()
        }
    })
    .await
    .map_err(|e| format!("intern feil: {e}"))?;

    let Some(valgt) = valgt else { return Ok(None) };
    let sti = valgt
        .into_path()
        .map_err(|e| format!("ugyldig sti fra dialogen: {e}"))?;
    let sti = med_endelse(&sti, &endelse);
    std::fs::write(&sti, innhold)
        .map_err(|e| format!("klarte ikke skrive {}: {e}", sti.display()))?;
    Ok(Some(sti.to_string_lossy().into_owned()))
}

/// Bare de endelsene appen faktisk lagrer. Alt annet avvises.
fn ren_endelse(endelse: &str) -> Result<String, String> {
    let e = endelse.trim_start_matches('.').to_lowercase();
    match e.as_str() {
        "md" | "csv" | "docx" | "png" | "okta" | "pdf" | "ics" => Ok(e),
        _ => Err(format!("kan ikke lagre filer av typen .{e}")),
    }
}

/// Filnavnet som foreslås i dialogen: bare navnet, ingen mapper.
fn rent_filnavn(navn: &str) -> String {
    let n: String = navn
        .chars()
        .map(|c| if matches!(c, '/' | '\\' | ':' | '\0') { '-' } else { c })
        .collect();
    let n = n.trim().trim_start_matches('.').to_string();
    if n.is_empty() { "Uten navn".into() } else { n }
}

/// Legger på endelsen hvis brukeren skrev den bort i dialogen.
fn med_endelse(sti: &Path, endelse: &str) -> PathBuf {
    let har = sti
        .extension()
        .is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case(endelse));
    if har {
        sti.to_path_buf()
    } else {
        let mut s = sti.as_os_str().to_owned();
        s.push(format!(".{endelse}"));
        PathBuf::from(s)
    }
}

#[cfg(test)]
mod tester {
    use super::*;

    #[test]
    fn bare_kjente_endelser() {
        assert_eq!(ren_endelse("png").unwrap(), "png");
        assert_eq!(ren_endelse(".DOCX").unwrap(), "docx");
        assert!(ren_endelse("sh").is_err());
        assert!(ren_endelse("plist").is_err());
        assert!(ren_endelse("").is_err());
    }

    #[test]
    fn filnavnet_kan_ikke_peke_ut_av_mappa() {
        assert_eq!(rent_filnavn("Årsplan MFL1.md"), "Årsplan MFL1.md");
        assert_eq!(rent_filnavn("../../.zshrc"), "-..-.zshrc");
        assert_eq!(rent_filnavn(r"C:\Windows\x.png"), "C--Windows-x.png");
        assert_eq!(rent_filnavn("  "), "Uten navn");
    }

    #[test]
    fn endelsen_legges_paa_hvis_den_mangler() {
        let d = std::env::temp_dir();
        assert_eq!(med_endelse(&d.join("kart"), "png"), d.join("kart.png"));
        assert_eq!(med_endelse(&d.join("kart.PNG"), "png"), d.join("kart.PNG"));
        // En annen endelse blir ikke byttet ut, men får riktig i tillegg.
        assert_eq!(
            med_endelse(&d.join("plan.command"), "md"),
            d.join("plan.command.md")
        );
    }
}
