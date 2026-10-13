//! Skriving av arkivet til disk, SPEC §8.
//!
//! Innholdet lages i frontend; her gjøres bare filarbeidet. Skillet er det
//! samme som ellers i appen — logikken ett sted, ikke fordelt over to språk.
//!
//! Til forskjell fra arbeidsfila **kan** denne mappa ligge i en skytjeneste.
//! Det er vanlige tekstfiler som ingenting skriver til samtidig, så det er
//! ingen fare for halvskrevne filer slik en åpen SQLite-base har.

use std::path::{Component, Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

#[derive(serde::Deserialize)]
pub struct Fil {
    pub sti: String,
    pub innhold: String,
}

#[derive(serde::Serialize, Default)]
pub struct Resultat {
    pub skrevet: usize,
    pub feil: Vec<String>,
}

/// Slår sammen mappe og relativ sti, og nekter alt som prøver seg oppover.
///
/// Stiene kommer fra elevnavn via en slugg-funksjon, så de skal være
/// harmløse. Men en sti bygget av brukerdata skal aldri kunne peke ut av
/// mappa den hører hjemme i, uansett hvor trygg kilden ser ut.
fn trygg_sti(rot: &Path, relativ: &str) -> Result<PathBuf, String> {
    let rel = Path::new(relativ);
    for del in rel.components() {
        match del {
            Component::Normal(_) => {}
            _ => return Err(format!("ugyldig sti: {relativ}")),
        }
    }
    Ok(rot.join(rel))
}

// ------------------------------------------------------------ mappevalget
//
// Issue #1: mappa arkivet skrives til, velges og huskes her, ikke i
// webvisningen. Før lå den i databasen og ble sendt med hvert kall, og da
// kunne et skript i vinduet få `skriv_arkiv` til å skrive hvor som helst.
// Nå kan arkivet bare havne i mappa brukeren har pekt på i dialogen, eller
// ved siden av sikkerhetskopiene.

const VALGT_MAPPE: &str = "arkivmappe.txt";

fn valgfil(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("fant ikke appens data-mappe: {e}"))?
        .join(VALGT_MAPPE))
}

fn valgt_mappe(app: &AppHandle) -> Option<PathBuf> {
    let tekst = std::fs::read_to_string(valgfil(app).ok()?).ok()?;
    let mappe = PathBuf::from(tekst.trim());
    mappe.is_dir().then_some(mappe)
}

/// Mappa brukeren har valgt for arkivet, til visning i Innstillinger.
#[tauri::command]
pub fn hent_arkivmappe(app: AppHandle) -> Option<String> {
    valgt_mappe(&app).map(|p| p.to_string_lossy().into_owned())
}

/// Lar brukeren velge mappa i en dialog, og husker den.
#[tauri::command]
pub async fn velg_arkivmappe(app: AppHandle) -> Result<Option<String>, String> {
    let a = app.clone();
    let valgt = tauri::async_runtime::spawn_blocking(move || {
        a.dialog().file().blocking_pick_folder()
    })
    .await
    .map_err(|e| format!("intern feil: {e}"))?;
    let Some(valgt) = valgt else { return Ok(None) };
    let mappe = valgt
        .into_path()
        .map_err(|e| format!("ugyldig mappe fra dialogen: {e}"))?;
    let fil = valgfil(&app)?;
    if let Some(f) = fil.parent() {
        std::fs::create_dir_all(f).map_err(|e| e.to_string())?;
    }
    std::fs::write(&fil, mappe.to_string_lossy().as_bytes())
        .map_err(|e| format!("klarte ikke huske mappa: {e}"))?;
    Ok(Some(mappe.to_string_lossy().into_owned()))
}

/// Hvor arkivet skal: mappa brukeren har valgt, eller ved siden av
/// sikkerhetskopiene.
#[derive(serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Hvor {
    Valgt,
    Backup,
}

/// Skriver arkivet. Gir `None` hvis brukeren ikke har valgt noen mappe.
#[tauri::command]
pub async fn skriv_arkiv(
    app: AppHandle,
    hvor: Hvor,
    filer: Vec<Fil>,
) -> Result<Option<Resultat>, String> {
    let mappe = match hvor {
        Hvor::Valgt => match valgt_mappe(&app) {
            Some(m) => m,
            None => return Ok(None),
        },
        Hvor::Backup => crate::sikkerhetskopi::arkivmappe(&app)?,
    };
    tauri::async_runtime::spawn_blocking(move || skriv(&mappe, filer).map(Some))
        .await
        .map_err(|e| format!("intern feil: {e}"))?
}

fn skriv(rot: &Path, filer: Vec<Fil>) -> Result<Resultat, String> {
    if !rot.is_dir() {
        return Err(format!("{} er ikke en mappe.", rot.display()));
    }

    let mut ut = Resultat::default();
    for f in filer {
        let mal = match trygg_sti(rot, &f.sti) {
            Ok(p) => p,
            Err(e) => {
                ut.feil.push(e);
                continue;
            }
        };
        if let Some(foreldre) = mal.parent() {
            if let Err(e) = std::fs::create_dir_all(foreldre) {
                ut.feil.push(format!("{}: {e}", f.sti));
                continue;
            }
        }
        match std::fs::write(&mal, f.innhold) {
            Ok(()) => ut.skrevet += 1,
            Err(e) => ut.feil.push(format!("{}: {e}", f.sti)),
        }
    }
    Ok(ut)
}

#[cfg(test)]
mod tester {
    use super::trygg_sti;
    use std::path::Path;

    #[test]
    fn godtar_vanlige_stier() {
        assert!(trygg_sti(Path::new("/tmp/a"), "elever/tony-soprano.md").is_ok());
    }

    #[test]
    fn nekter_a_gaa_oppover() {
        assert!(trygg_sti(Path::new("/tmp/a"), "../../etc/passwd").is_err());
        assert!(trygg_sti(Path::new("/tmp/a"), "/etc/passwd").is_err());
    }
}
