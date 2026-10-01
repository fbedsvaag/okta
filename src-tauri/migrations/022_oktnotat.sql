-- 022_oktnotat.sql — notatet på en elev i en økt, uavhengig av skåringen
--
-- Notatet bodde på skåringsraden (skaring.notat). Var eleven ikke skåret,
-- fantes ingen rad å skrive i, og notatet ble stille borte — skjermen viste
-- det til økta ble lukket. skalaverdi_id er NOT NULL, så en skåringsrad
-- uten verdi går ikke an, og den skulle heller ikke telle med i noe.
--
-- Derfor en egen tabell, én rad per elev per økt. skaring.notat blir
-- stående, men leses og skrives ikke lenger (samme grep som 016):
-- SQLite kan ikke droppe kolonnen uten å bygge tabellen på nytt.
CREATE TABLE oktnotat (
  id         TEXT PRIMARY KEY,
  elev_id    TEXT NOT NULL REFERENCES elev(id),
  okt_id     TEXT NOT NULL REFERENCES okt(id),
  tekst      TEXT NOT NULL,
  opprettet  TEXT NOT NULL,
  endret     TEXT NOT NULL,
  slettet    TEXT,
  UNIQUE(elev_id, okt_id)
);

CREATE INDEX idx_oktnotat_elev ON oktnotat(elev_id) WHERE slettet IS NULL;
CREATE INDEX idx_oktnotat_okt  ON oktnotat(okt_id)  WHERE slettet IS NULL;

-- Notatene som finnes, flyttes over. UUID v4-form, laget i SQL fordi dette
-- er en datamigrering (samme mønster som i 011 og 016).
INSERT INTO oktnotat (id, elev_id, okt_id, tekst, opprettet, endret)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
       substr(lower(hex(randomblob(2))), 2) || '-' ||
       substr('89ab', 1 + (abs(random()) % 4), 1) ||
       substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       elev_id, okt_id, notat, opprettet, endret
  FROM skaring
 WHERE slettet IS NULL AND TRIM(COALESCE(notat, '')) <> '';
