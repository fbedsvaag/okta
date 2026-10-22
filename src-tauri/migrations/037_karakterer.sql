-- 037_karakterer.sql — Karakterer i faget (ARBEIDSLISTE 29.4)

-- Hvor mye vurderingen teller i det vektede snittet. NULL = standard: 1 for
-- skalaer med tallkarakterer, 0 («teller ikke») for godkjent/ikke godkjent.
ALTER TABLE vurdering ADD COLUMN vekt REAL;

-- Halvårskarakteren og kommentaren per elev, fag og termin.
-- termin: host | var | aar
CREATE TABLE halvarskarakter (
  id             TEXT PRIMARY KEY,
  elev_id        TEXT NOT NULL REFERENCES elev(id),
  skolear_fag_id TEXT NOT NULL REFERENCES skolear_fag(id),
  termin         TEXT NOT NULL,
  karakter       TEXT,
  kommentar      TEXT,
  opprettet      TEXT NOT NULL,
  endret         TEXT NOT NULL,
  slettet        TEXT,
  UNIQUE(elev_id, skolear_fag_id, termin)
);
CREATE INDEX idx_halvar_fag ON halvarskarakter(skolear_fag_id)
  WHERE slettet IS NULL;
