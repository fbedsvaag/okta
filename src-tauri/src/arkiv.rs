//! Skriving av arkivet til disk, SPEC §8.
//!
//! Innholdet lages i frontend; her gjøres bare filarbeidet. Skillet er det
//! samme som ellers i appen — logikken ett sted, ikke fordelt over to språk.
//!
//! Til forskjell fra arbeidsfila **kan** denne mappa ligge i en skytjeneste.
//! Det er vanlige tekstfiler som ingenting skriver til samtidig, så det er
//! ingen fare for halvskrevne filer slik en åpen SQLite-base har.

use std::path::{Component, Path, PathBuf};

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

#[tauri::command]
pub async fn skriv_arkiv(mappe: String, filer: Vec<Fil>) -> Result<Resultat, String> {
    tauri::async_runtime::spawn_blocking(move || skriv(mappe, filer))
        .await
        .map_err(|e| format!("intern feil: {e}"))?
}

fn skriv(mappe: String, filer: Vec<Fil>) -> Result<Resultat, String> {
    let rot = PathBuf::from(&mappe);
    if !rot.is_dir() {
        return Err(format!("{mappe} er ikke en mappe."));
    }

    let mut ut = Resultat::default();
    for f in filer {
        let mal = match trygg_sti(&rot, &f.sti) {
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
