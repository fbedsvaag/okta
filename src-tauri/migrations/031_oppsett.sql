-- 031_oppsett.sql — lagrede klassekart og grupper med navn (ønske 21.10)
--
-- Et oppsett var til nå bare en felles oppsett_id på radene i plassering.
-- Nå får det en egen rad, så det kan ha et navn, finnes igjen og slettes.
-- Oppsettene som finnes, flyttes over uten navn, med tiden de ble brukt.
CREATE TABLE oppsett (
  id            TEXT PRIMARY KEY,
  klassekart_id TEXT NOT NULL REFERENCES klassekart(id),
  type          TEXT NOT NULL,                 -- plass | gruppe
  navn          TEXT,                          -- NULL = uten navn, vises med dato
  opprettet     TEXT NOT NULL,
  endret        TEXT NOT NULL,
  slettet       TEXT
);

INSERT INTO oppsett (id, klassekart_id, type, navn, opprettet, endret, slettet)
SELECT oppsett_id, MIN(klassekart_id), MIN(type), NULL,
       MIN(opprettet), MAX(endret),
       CASE WHEN COUNT(slettet) = COUNT(*) THEN MAX(slettet) END
  FROM plassering
 GROUP BY oppsett_id;

CREATE INDEX idx_oppsett_kart ON oppsett(klassekart_id, type) WHERE slettet IS NULL;
