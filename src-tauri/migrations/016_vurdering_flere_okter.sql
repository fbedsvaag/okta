-- 016_vurdering_flere_okter.sql — én vurdering over flere økter
--
-- En muntlig vurdering får ikke alltid plass i én økt. Da strekkes den over
-- to eller flere, og da må koblingen mellom vurdering og økt være
-- mange-til-mange. `vurdering.okt_id` rommer bare én.
--
-- Kolonnen blir stående, men leses og skrives ikke lenger: den er med i en
-- fremmednøkkel, og SQLite kan ikke droppe den uten å bygge tabellen på nytt.
-- Det som sto i den, flyttes hit.
CREATE TABLE vurdering_okt (
  id           TEXT PRIMARY KEY,
  vurdering_id TEXT NOT NULL REFERENCES vurdering(id),
  okt_id       TEXT NOT NULL REFERENCES okt(id),
  opprettet    TEXT NOT NULL,
  endret       TEXT NOT NULL,
  slettet      TEXT,
  UNIQUE(vurdering_id, okt_id)
);

CREATE INDEX idx_vurdokt_vurdering ON vurdering_okt(vurdering_id) WHERE slettet IS NULL;
CREATE INDEX idx_vurdokt_okt       ON vurdering_okt(okt_id)       WHERE slettet IS NULL;

-- UUID v4-form, laget i SQL fordi dette er en datamigrering (samme mønster
-- som i 011).
INSERT INTO vurdering_okt (id, vurdering_id, okt_id, opprettet, endret)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
       substr(lower(hex(randomblob(2))), 2) || '-' ||
       substr('89ab', 1 + (abs(random()) % 4), 1) ||
       substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       id, okt_id,
       strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'),
       strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
  FROM vurdering
 WHERE okt_id IS NOT NULL AND slettet IS NULL;

-- Samtaledagen kan ligge i en økt. Da er øktas start og slutt rammen, og
-- timene er allerede talt som økt — dagen skal ikke telle en gang til.
ALTER TABLE samtaledag ADD COLUMN okt_id TEXT REFERENCES okt(id);
CREATE INDEX idx_samtaledag_okt ON samtaledag(okt_id)
  WHERE okt_id IS NOT NULL AND slettet IS NULL;
