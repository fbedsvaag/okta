-- 024_klassekart.sql — klassekart og gruppegenerator (SPEC §4.11)
--
-- Bare tillegg: to nye kolonner på elev og fire nye tabeller. Ingenting
-- gammelt endres eller fjernes, så migrasjonen tåler en base i bruk —
-- eksisterende elever får kjønn NULL («ikke satt»).
--
-- Kjønn er valgfritt og brukes bare til å blande ved pultene og i
-- gruppene. Det vises bare i elevkortet og går aldri ut av appen: ikke i
-- eksport, utskrift, Teams, CalDAV, arkiv eller oppsettfil.
ALTER TABLE elev ADD COLUMN kjonn TEXT;          -- 'j' | 'g' | NULL
ALTER TABLE elev ADD COLUMN kjonn_kilde TEXT;    -- 'gjettet' | 'satt' | NULL

-- Et klasserom, tegnet én gang og brukt av mange kart. Felles for alle fag
-- og skoleår. Oppsettet er JSON: deler med type, x, y og rotasjon.
CREATE TABLE rom (
  id         TEXT PRIMARY KEY,
  navn       TEXT NOT NULL,
  oppsett    TEXT NOT NULL,
  opprettet  TEXT NOT NULL,
  endret     TEXT NOT NULL,
  slettet    TEXT
);

-- Én elevgruppe i ett rom. Kilden er et fag (skolear_fag), en klasse eller
-- mentorgruppa (da er kilde_id skoleåret).
CREATE TABLE klassekart (
  id            TEXT PRIMARY KEY,
  skolear_id    TEXT NOT NULL REFERENCES skolear(id),
  kilde_type    TEXT NOT NULL,                 -- fag | klasse | mentorgruppe
  kilde_id      TEXT NOT NULL,
  rom_id        TEXT REFERENCES rom(id),
  innstillinger TEXT,                          -- JSON: fordeling, bland, unngå, antall grupper
  opprettet     TEXT NOT NULL,
  endret        TEXT NOT NULL,
  slettet       TEXT
);

CREATE INDEX idx_klassekart_ar ON klassekart(skolear_id) WHERE slettet IS NULL;

-- Hvem som satt hvor, eller var i hvilken gruppe, da kartet ble brukt.
-- Én rad per elev per lagret oppsett; oppsett_id er lik for hele oppsettet.
-- De lagrede oppsettene er historikken «unngå dem som har sittet sammen»
-- regner på.
CREATE TABLE plassering (
  id             TEXT PRIMARY KEY,
  klassekart_id  TEXT NOT NULL REFERENCES klassekart(id),
  oppsett_id     TEXT NOT NULL,
  type           TEXT NOT NULL,                -- plass | gruppe
  elev_id        TEXT NOT NULL REFERENCES elev(id),
  plass          INTEGER,
  gruppe         INTEGER,
  gruppenavn     TEXT,
  last           INTEGER NOT NULL DEFAULT 0,
  opprettet      TEXT NOT NULL,
  endret         TEXT NOT NULL,
  slettet        TEXT
);

CREATE INDEX idx_plassering_kart ON plassering(klassekart_id, type)
  WHERE slettet IS NULL;

-- «Hold fra hverandre»: to elever som aldri skal dele pult eller gruppe.
-- Hører til kilden, og gjelder i alle kart for den.
CREATE TABLE elevregel (
  id          TEXT PRIMARY KEY,
  kilde_type  TEXT NOT NULL,
  kilde_id    TEXT NOT NULL,
  elev_a      TEXT NOT NULL REFERENCES elev(id),
  elev_b      TEXT NOT NULL REFERENCES elev(id),
  opprettet   TEXT NOT NULL,
  endret      TEXT NOT NULL,
  slettet     TEXT
);
