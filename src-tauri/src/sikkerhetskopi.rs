//! Rullerende sikkerhetskopi av arbeidsfila, SPEC §8.
//!
//! Kopien tas ved appstart, én gang i døgnet, og de 30 nyeste beholdes.
//! Filene ligger i `backup/` ved siden av databasen — altså i appens
//! data-mappe, ikke i en synkmappe. En åpen SQLite-fil i iCloud eller
//! Dropbox blir korrupt uten forvarsel.
//!
//! Selve kopieringen skjer med `VACUUM INTO` fra frontend, ikke med en vanlig
//! filkopi. Grunnen er at en kopi av ei åpen SQLite-fil kan bli ubrukelig
//! hvis noe skrives mens kopieringen står på; `VACUUM INTO` skriver en
//! konsistent base uansett hva som foregår. Rust her gjør bare filarbeidet:
//! finner mappa, sier om dagens kopi mangler, og rydder de gamle.

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Prefikset de daglige kopiene har. Bare disse inngår i 30-grensa —
/// sikringskopiene fra en gjenoppretting skal aldri ryddes bort automatisk.
const DAGLIG: &str = "elevtracking-";

#[derive(serde::Serialize)]
pub struct Kopi {
    pub navn: String,
    pub bytes: u64,
    /// false for sikringskopier tatt før en gjenoppretting
    pub daglig: bool,
}

fn backupmappe(app: &AppHandle) -> Result<PathBuf, String> {
    let mappe = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("fant ikke appens data-mappe: {e}"))?
        .join("backup");
    fs::create_dir_all(&mappe).map_err(|e| format!("klarte ikke lage {mappe:?}: {e}"))?;
    Ok(mappe)
}

fn filnavn(dato: &str) -> String {
    format!("elevtracking-{dato}.sqlite")
}

/// Full sti til dagens kopi hvis den mangler, ellers `None`.
///
/// `tvungen` sletter dagens kopi først, slik at knappen «Ta kopi nå» virker
/// selv når det allerede finnes en fra i dag.
#[tauri::command]
pub fn forbered_sikkerhetskopi(
    app: AppHandle,
    dato: String,
    tvungen: bool,
) -> Result<Option<String>, String> {
    let mal = backupmappe(&app)?.join(filnavn(&dato));

    if mal.exists() {
        if !tvungen {
            return Ok(None);
        }
        fs::remove_file(&mal).map_err(|e| format!("klarte ikke erstatte {mal:?}: {e}"))?;
    }

    Ok(Some(mal.to_string_lossy().into_owned()))
}

/// Kopiene som finnes, nyeste først.
#[tauri::command]
pub fn sikkerhetskopier(app: AppHandle) -> Result<Vec<Kopi>, String> {
    let mappe = backupmappe(&app)?;
    let mut kopier: Vec<Kopi> = fs::read_dir(&mappe)
        .map_err(|e| format!("klarte ikke lese {mappe:?}: {e}"))?
        .filter_map(|f| f.ok())
        .filter(|f| {
            f.file_name()
                .to_string_lossy()
                .ends_with(".sqlite")
        })
        .map(|f| {
            let navn = f.file_name().to_string_lossy().into_owned();
            Kopi {
                daglig: navn.starts_with(DAGLIG),
                bytes: f.metadata().map(|m| m.len()).unwrap_or(0),
                navn,
            }
        })
        .collect();

    // Navnet inneholder datoen, så alfabetisk sortering er kronologisk.
    kopier.sort_by(|a, b| b.navn.cmp(&a.navn));
    Ok(kopier)
}

/// Sletter de eldste kopiene til det står `behold` igjen. Returnerer antall slettede.
#[tauri::command]
pub fn rydd_sikkerhetskopier(app: AppHandle, behold: usize) -> Result<usize, String> {
    let mappe = backupmappe(&app)?;
    let kopier = sikkerhetskopier(app.clone())?;

    let mut slettet = 0;
    for kopi in kopier.iter().filter(|k| k.daglig).skip(behold) {
        if fs::remove_file(mappe.join(&kopi.navn)).is_ok() {
            slettet += 1;
        }
    }
    Ok(slettet)
}

/// Mappa tekstarkivet legges i, ved siden av databasekopiene.
///
/// Arkivet skrives hit uansett om brukeren har valgt en eksportmappe. Det er
/// forsikringen: en `.sqlite`-fil krever denne appen for å leses, mens
/// markdown kan åpnes av hva som helst. Ligger de to sammen, er det ikke
/// mulig å ha den ene uten den andre.
///
/// Bare én utgave, som overskrives. De daterte `.sqlite`-filene er
/// historikken; dette er en lesbar utgave av nåtilstanden.
#[tauri::command]
pub fn arkivmappe(app: AppHandle) -> Result<String, String> {
    let mappe = backupmappe(&app)?.join("arkiv");
    fs::create_dir_all(&mappe).map_err(|e| format!("klarte ikke lage {mappe:?}: {e}"))?;
    Ok(mappe.to_string_lossy().into_owned())
}

/// Mappa kopiene ligger i, til «Vis i Finder» og til visning i innstillingene.
#[tauri::command]
pub fn sikkerhetskopimappe(app: AppHandle) -> Result<String, String> {
    Ok(backupmappe(&app)?.to_string_lossy().into_owned())
}

// ---------------------------------------------------------- gjenoppretting

const SQLITE_MAGIC: &[u8; 16] = b"SQLite format 3\0";

fn arbeidsfil(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("fant ikke appens data-mappe: {e}"))?
        .join("elevtracking.sqlite"))
}

/// Sjekker at fila i det hele tatt er en SQLite-database før vi rører noe.
fn er_sqlite(sti: &PathBuf) -> Result<(), String> {
    let data = fs::read(sti).map_err(|e| format!("klarte ikke lese {sti:?}: {e}"))?;
    if data.len() < 100 || &data[..16] != SQLITE_MAGIC {
        return Err(format!(
            "{} ser ikke ut som en SQLite-database.",
            sti.file_name().unwrap_or_default().to_string_lossy()
        ));
    }
    Ok(())
}

/// Bytter ut arbeidsfila med en annen database, og starter appen på nytt.
///
/// Den nåværende basen legges først i `backup/` under et eget navn, slik at
/// gjenopprettingen selv kan angres. WAL- og SHM-filene til den gamle basen
/// må bort — blir de liggende, spilles de av mot den nye fila ved neste
/// oppstart, og da er begge ødelagt.
///
/// Frontend skal ha lukket databasetilkoblingen før dette kalles.
#[tauri::command]
pub fn gjenopprett_fra(
    app: AppHandle,
    sti: String,
    tidsstempel: String,
) -> Result<(), String> {
    let kilde = PathBuf::from(&sti);
    er_sqlite(&kilde)?;

    let mal = arbeidsfil(&app)?;
    if kilde == mal {
        return Err("Fila er allerede arbeidsfila.".into());
    }

    if mal.exists() {
        let trygg = backupmappe(&app)?.join(format!("for-gjenoppretting-{tidsstempel}.sqlite"));
        fs::copy(&mal, &trygg)
            .map_err(|e| format!("klarte ikke sikre den nåværende basen: {e}"))?;
    }

    for etterslep in ["elevtracking.sqlite-wal", "elevtracking.sqlite-shm"] {
        let f = mal.with_file_name(etterslep);
        if f.exists() {
            fs::remove_file(&f).map_err(|e| format!("klarte ikke fjerne {f:?}: {e}"))?;
        }
    }

    fs::copy(&kilde, &mal).map_err(|e| format!("klarte ikke skrive arbeidsfila: {e}"))?;

    app.restart();
}
