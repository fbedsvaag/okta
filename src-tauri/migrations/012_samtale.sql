-- 012_samtale.sql — samtaledager og samtaler (SPEC §3.6, §4.10)
--
-- Muntlige samtaler med klokkeslett per elev. Samtaledagen er bevisst ikke en
-- økt: den har klokkeslett per elev, og i mentormodus har den ikke noe fag i
-- det hele tatt. okt.skolear_fag_id er NOT NULL og bærer timeregnskapet,
-- kalenderen og publiseringen, så en nullbar variant der ville berørt hver
-- eneste spørring som antar at et fag finnes.

CREATE TABLE samtaledag (
  id             TEXT PRIMARY KEY,
  skolear_id     TEXT NOT NULL REFERENCES skolear(id),
  skolear_fag_id TEXT REFERENCES skolear_fag(id),  -- NULL = mentorsamtale
  vurdering_id   TEXT REFERENCES vurdering(id),    -- flere dager, samme vurdering
  dato           TEXT NOT NULL,
  fra            TEXT NOT NULL,        -- "08:30"
  til            TEXT NOT NULL,        -- "15:00", overstyrbar
  lunsj_fra      TEXT,                 -- "11:45". NULL = ingen lunsj
  lunsj_min      INTEGER,
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

-- Nøkkelen rommer klokkeslettet, ikke bare dag og elev: en elev som ikke møtte
-- kan settes opp på nytt senere samme dag, og finnes da to ganger (§4.10).
CREATE TABLE samtale (
  id             TEXT PRIMARY KEY,
  samtaledag_id  TEXT NOT NULL REFERENCES samtaledag(id),
  elev_id        TEXT NOT NULL REFERENCES elev(id),
  klokkeslett    TEXT NOT NULL,        -- "09:30"
  varighet_min   INTEGER NOT NULL,
  tema           TEXT,                 -- "Oppgave 4 · Markedsanalyse"
  motte          INTEGER NOT NULL DEFAULT 1,  -- 0 = eleven møtte ikke
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT,
  UNIQUE(samtaledag_id, elev_id, klokkeslett)
);

CREATE INDEX idx_samtaledag_ar ON samtaledag(skolear_id, dato) WHERE slettet IS NULL;
CREATE INDEX idx_samtale_dag   ON samtale(samtaledag_id)       WHERE slettet IS NULL;
CREATE INDEX idx_samtale_elev  ON samtale(elev_id)             WHERE slettet IS NULL;
