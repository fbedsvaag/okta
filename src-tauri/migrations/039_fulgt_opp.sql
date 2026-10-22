-- 039_fulgt_opp.sql — «Fulgt opp ✓» i Følg opp (ARBEIDSLISTE 29.7)
--
-- En rad per elev og grunn som er fulgt opp. Nøkkelen sier hva som var
-- grunnen («rod:<økt>», «frist:<vurdering>», «avtale:<mål>»). Skjer noe
-- nytt, får grunnen en ny nøkkel, og eleven står i lista igjen.
CREATE TABLE fulgt_opp (
  id        TEXT PRIMARY KEY,
  elev_id   TEXT NOT NULL REFERENCES elev(id),
  nokkel    TEXT NOT NULL,
  dato      TEXT NOT NULL,
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT,
  UNIQUE(elev_id, nokkel)
);
