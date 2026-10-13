//! Operativsystemet appen kjører på, til «Gi tilbakemelding» (13.1).
//! Leses lokalt; ingenting sendes noe sted.

/// «macOS 15.1», «Windows 11 (26100)» eller bare navnet.
#[tauri::command]
pub fn systemversjon() -> String {
    let info = os_info::get();
    let typ = match info.os_type() {
        os_info::Type::Macos => "macOS",
        os_info::Type::Windows => "Windows",
        _ => "",
    };
    beskriv(
        if typ.is_empty() { None } else { Some(typ) },
        &info.version().to_string(),
        info.edition(),
    )
}

/// Ren funksjon, så formatet kan testes på alle plattformer.
fn beskriv(typ: Option<&str>, versjon: &str, utgave: Option<&str>) -> String {
    match typ {
        Some("macOS") => {
            // «15.1.0» → «15.1»
            let deler: Vec<&str> = versjon.split('.').collect();
            let kort = match deler.as_slice() {
                [a, b, "0"] => format!("{a}.{b}"),
                _ => versjon.to_string(),
            };
            format!("macOS {kort}")
        }
        Some("Windows") => {
            // os_info gir «Windows 11 Home» som utgave og «10.0.26100» som
            // versjon; bygget skiller Windows 10 fra 11.
            let bygg = versjon.rsplit('.').next().unwrap_or(versjon);
            let navn = utgave
                .and_then(|u| u.split_whitespace().nth(1))
                .filter(|n| n.chars().all(|c| c.is_ascii_digit()))
                .map(|n| format!("Windows {n}"))
                .unwrap_or_else(|| "Windows".to_string());
            format!("{navn} ({bygg})")
        }
        _ => {
            if versjon.is_empty() || versjon == "Unknown" {
                std::env::consts::OS.to_string()
            } else {
                format!("{} {versjon}", std::env::consts::OS)
            }
        }
    }
}

#[cfg(test)]
mod tester {
    use super::beskriv;

    #[test]
    fn macos_kortes_til_to_ledd() {
        assert_eq!(beskriv(Some("macOS"), "15.1.0", None), "macOS 15.1");
        assert_eq!(beskriv(Some("macOS"), "26.5.1", None), "macOS 26.5.1");
    }

    #[test]
    fn windows_med_utgave_og_bygg() {
        assert_eq!(
            beskriv(Some("Windows"), "10.0.26100", Some("Windows 11 Home")),
            "Windows 11 (26100)"
        );
        assert_eq!(
            beskriv(Some("Windows"), "10.0.19045", Some("Windows 10 Pro")),
            "Windows 10 (19045)"
        );
    }

    #[test]
    fn windows_uten_utgave() {
        assert_eq!(
            beskriv(Some("Windows"), "10.0.26100", None),
            "Windows (26100)"
        );
    }

    #[test]
    fn faktisk_maskin_gir_noe() {
        assert!(!super::systemversjon().is_empty());
    }
}
