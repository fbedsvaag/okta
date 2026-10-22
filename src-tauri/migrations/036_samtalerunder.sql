-- 036_samtalerunder.sql — mentorsamtalene i ny stil (ARBEIDSLISTE 29.6)
--
-- Bare for læreren. Ingenting her kommer med i fag, eksport, utskrift,
-- Teams, kalender eller oppsettfil (CLAUDE.md, briefen for §29).

-- En runde mentorsamtaler («Oppstartssamtaler», «Mentorsamtaler høst»):
-- dagene i den, samtaleguiden og tidene.
CREATE TABLE samtalerunde (
  id          TEXT PRIMARY KEY,
  skolear_id  TEXT NOT NULL REFERENCES skolear(id),
  navn        TEXT NOT NULL,
  guide       TEXT,                    -- JSON-liste med spørsmål
  samtale_min INTEGER,
  pause_min   INTEGER,
  opprettet   TEXT NOT NULL,
  endret      TEXT NOT NULL,
  slettet     TEXT
);
ALTER TABLE samtaledag ADD COLUMN samtalerunde_id TEXT REFERENCES samtalerunde(id);

-- Per samtale: om en foresatt var med, og hvilke spørsmål i guiden som er
-- tatt (indekser).
ALTER TABLE samtale ADD COLUMN med_foresatt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE samtale ADD COLUMN guide_stilt TEXT;

-- Mål og avtaler fra en samtale til den neste. nadd = datoen målet ble
-- krysset av; NULL = ikke nådd ennå.
CREATE TABLE samtalemal (
  id         TEXT PRIMARY KEY,
  elev_id    TEXT NOT NULL REFERENCES elev(id),
  samtale_id TEXT REFERENCES samtale(id),
  tekst      TEXT NOT NULL,
  nadd       TEXT,
  opprettet  TEXT NOT NULL,
  endret     TEXT NOT NULL,
  slettet    TEXT
);
CREATE INDEX idx_samtalemal_elev ON samtalemal(elev_id) WHERE slettet IS NULL;

-- Mentordagene som finnes, samles i én runde per skoleår.
INSERT INTO samtalerunde (id, skolear_id, navn, opprettet, endret)
SELECT lower(
         hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
         substr(hex(randomblob(2)), 2) || '-' ||
         substr('89ab', 1 + abs(random()) % 4, 1) ||
         substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))
       ),
       skolear_id, 'Mentorsamtaler',
       strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'),
       strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
  FROM (SELECT DISTINCT skolear_id FROM samtaledag
         WHERE skolear_fag_id IS NULL AND slettet IS NULL);

UPDATE samtaledag
   SET samtalerunde_id = (SELECT r.id FROM samtalerunde r
                           WHERE r.skolear_id = samtaledag.skolear_id)
 WHERE skolear_fag_id IS NULL AND samtalerunde_id IS NULL;
