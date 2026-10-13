//! Flere skrivinger som enten går gjennom alle sammen, eller ingen (issue #2).
//!
//! tauri-plugin-sql har en pulje av tilkoblinger. `BEGIN`, setningene og
//! `COMMIT` sendt som hvert sitt kall fra webvisningen kan havne på hver sin
//! tilkobling, og da virker ikke transaksjonen. Her tas én tilkobling ut av
//! den samme puljen, og alt kjøres på den mellom `begin()` og `commit()`.
//!
//! Hva som skal skrives, bestemmes fortsatt i TypeScript (src/db), der
//! logikken og testene er. Rust sørger bare for at det skjer samlet.

use serde_json::Value;
use sqlx::{Pool, Sqlite};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

/// Samme fil som `FIL` i src/db/index.ts.
const FIL: &str = "sqlite:elevtracking.sqlite";

#[derive(serde::Deserialize)]
pub struct Setning {
    pub sql: String,
    pub verdier: Vec<Value>,
}

#[tauri::command]
pub async fn transaksjon(
    db: State<'_, DbInstances>,
    setninger: Vec<Setning>,
) -> Result<(), String> {
    let puljer = db.0.read().await;
    let pulje = match puljer.get(FIL) {
        Some(DbPool::Sqlite(p)) => p.clone(),
        _ => return Err("databasen er ikke åpnet ennå".into()),
    };
    drop(puljer);
    kjor(&pulje, setninger).await
}

/// Kjører setningene i én transaksjon. Feiler én, rulles alle tilbake.
pub async fn kjor(pulje: &Pool<Sqlite>, setninger: Vec<Setning>) -> Result<(), String> {
    let mut tx = pulje.begin().await.map_err(|e| e.to_string())?;
    // Fremmednøkler gjelder per tilkobling (#12). Denne tilkoblingen sjekkes
    // før noe skrives, uansett hva puljen ellers gjør.
    let pa: i64 = sqlx::query_scalar("PRAGMA foreign_keys")
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    if pa != 1 {
        return Err("fremmednøkler er av på denne tilkoblingen; skriver ingenting".into());
    }
    for (i, s) in setninger.iter().enumerate() {
        let mut q = sqlx::query(&s.sql);
        // Samme binding som tauri-plugin-sql bruker for vanlige kall, så en
        // verdi blir lagret likt uansett vei inn.
        for v in &s.verdier {
            q = match v {
                Value::Null => q.bind(None::<Value>),
                Value::String(t) => q.bind(t.clone()),
                Value::Number(n) => q.bind(n.as_f64().unwrap_or_default()),
                annet => q.bind(annet.clone()),
            };
        }
        if let Err(e) = q.execute(&mut *tx).await {
            // tx slippes uten commit: sqlx ruller tilbake.
            return Err(format!("setning {} av {} feilet: {e}", i + 1, setninger.len()));
        }
    }
    tx.commit().await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tester {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    /// Pluginen åpner basen med `Pool::connect("sqlite:…")` og standardvalgene
    /// til sqlx. Holder flere tilkoblinger samtidig, så hver av dem er en egen
    /// tilkobling, og sjekker at fremmednøklene er på i alle (#12).
    #[tokio::test]
    async fn fremmednokler_er_paa_i_hver_tilkobling_i_puljen() {
        let fil = std::env::temp_dir().join(format!("okta-fk-{}.sqlite", std::process::id()));
        let url = format!("sqlite:{}?mode=rwc", fil.display());
        let p = SqlitePoolOptions::new().max_connections(4).connect(&url).await.unwrap();
        let mut holdt = Vec::new();
        for _ in 0..4 {
            let mut t = p.acquire().await.unwrap();
            let pa: i64 = sqlx::query_scalar("PRAGMA foreign_keys")
                .fetch_one(&mut *t)
                .await
                .unwrap();
            assert_eq!(pa, 1);
            holdt.push(t);
        }
        drop(holdt);
        p.close().await;
        let _ = std::fs::remove_file(&fil);
    }

    async fn pulje() -> Pool<Sqlite> {
        // Én tilkobling: en minnebase er privat for tilkoblingen sin.
        let p = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER NOT NULL)")
            .execute(&p)
            .await
            .unwrap();
        p
    }

    fn s(sql: &str, verdier: Vec<Value>) -> Setning {
        Setning { sql: sql.into(), verdier }
    }

    async fn antall(p: &Pool<Sqlite>) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM t").fetch_one(p).await.unwrap()
    }

    #[tokio::test]
    async fn alt_gaar_gjennom() {
        let p = pulje().await;
        kjor(&p, vec![
            s("INSERT INTO t VALUES ($1, $2)", vec!["a".into(), 1.into()]),
            s("INSERT INTO t VALUES ($1, $2)", vec!["b".into(), 2.into()]),
        ])
        .await
        .unwrap();
        assert_eq!(antall(&p).await, 2);
    }

    #[tokio::test]
    async fn ingenting_lagres_naar_en_setning_feiler() {
        let p = pulje().await;
        let feil = kjor(&p, vec![
            s("INSERT INTO t VALUES ($1, $2)", vec!["a".into(), 1.into()]),
            s("INSERT INTO t VALUES ($1, $2)", vec!["b".into(), Value::Null]),
            s("INSERT INTO t VALUES ($1, $2)", vec!["c".into(), 3.into()]),
        ])
        .await
        .unwrap_err();
        assert!(feil.contains("setning 2 av 3"), "{feil}");
        assert_eq!(antall(&p).await, 0);
    }

    #[tokio::test]
    async fn samme_plassholder_kan_brukes_to_ganger() {
        let p = pulje().await;
        kjor(&p, vec![s("INSERT INTO t VALUES ($1, $2)", vec!["a".into(), 5.into()])])
            .await
            .unwrap();
        kjor(&p, vec![s("UPDATE t SET n = $1 + $1 WHERE id = $2", vec![5.into(), "a".into()])])
            .await
            .unwrap();
        let n: i64 = sqlx::query_scalar("SELECT n FROM t").fetch_one(&p).await.unwrap();
        assert_eq!(n, 10);
    }
}
