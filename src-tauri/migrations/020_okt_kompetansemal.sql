-- 020_okt_kompetansemal.sql — kompetansemål knyttet til en økt
--
-- Samme mønster som periode_kompetansemal (009): mange-til-mange, og bare
-- koden lagres. Teksten ligger i grep-fag.json (§10).
--
-- Målene perioden dekker, gjelder alle øktene i den og står ikke her. Denne
-- tabellen er for målet én bestemt økt tar for seg, utover perioden — eller
-- for en økt som ikke ligger i noen periode.
CREATE TABLE okt_kompetansemal (
  id         TEXT PRIMARY KEY,
  okt_id     TEXT NOT NULL REFERENCES okt(id),
  kode       TEXT NOT NULL,           -- kompetansemålets kode, f.eks. KM11586
  opprettet  TEXT NOT NULL,
  endret     TEXT NOT NULL,
  slettet    TEXT,
  UNIQUE(okt_id, kode)
);

CREATE INDEX idx_okm_okt ON okt_kompetansemal(okt_id) WHERE slettet IS NULL;
