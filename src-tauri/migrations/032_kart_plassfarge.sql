-- 032_kart_plassfarge.sql — gruppefarger på pultene i et klassekart (25.11)
--
-- Fargen hører til plassen i rommet, ikke eleven: stokkes plassene, blir
-- fargene stående. `plass` er plassnummeret i rommet (som i plassering).
-- Gruppenavnet står på hver rad med samme farge.
CREATE TABLE kart_plassfarge (
  id            TEXT PRIMARY KEY,
  klassekart_id TEXT NOT NULL REFERENCES klassekart(id),
  plass         INTEGER NOT NULL,
  farge         TEXT NOT NULL,
  gruppenavn    TEXT,
  opprettet     TEXT NOT NULL,
  endret        TEXT NOT NULL,
  slettet       TEXT
);

CREATE INDEX idx_kart_plassfarge ON kart_plassfarge(klassekart_id) WHERE slettet IS NULL;
