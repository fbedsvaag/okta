-- 023_gjoremal.sql — gjøremål som ikke hører til noen elev
--
-- Gjøremålene på forsiden bor der de ble skrevet: oppfølgingsnotater og
-- avkrysningsbokser i elevnotater og øktlogger. Et gjøremål uten elev —
-- «kopier prøvene til fredag» — har ikke noe slikt sted, og får dette.
-- Med elev lagres gjøremålet som et oppfølgingsnotat på eleven (§4.7).
CREATE TABLE gjoremal (
  id         TEXT PRIMARY KEY,
  skolear_id TEXT NOT NULL REFERENCES skolear(id),
  tekst      TEXT NOT NULL,
  frist      TEXT,                    -- ISO-dato, valgfri
  ferdig     TEXT,                    -- ISO-dato når det ble krysset av
  opprettet  TEXT NOT NULL,
  endret     TEXT NOT NULL,
  slettet    TEXT
);

CREATE INDEX idx_gjoremal_apne ON gjoremal(skolear_id)
  WHERE slettet IS NULL AND ferdig IS NULL;
