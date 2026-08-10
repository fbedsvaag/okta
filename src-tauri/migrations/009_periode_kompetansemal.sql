-- Kompetansemål knyttet til en periode.
--
-- Mange-til-mange med vilje: en periode dekker flere mål, og samme mål kan
-- dekkes i flere perioder. Et mål man kommer tilbake til i mars er ikke en
-- feil — det er sånn undervisning faktisk foregår.
--
-- Bare koden lagres. Teksten ligger i grep-fag.json som følger appen (§10),
-- og skal ikke kopieres inn i basen: da ville to kilder kunne si forskjellig
-- ting om samme mål etter neste læreplanrevisjon.
CREATE TABLE periode_kompetansemal (
  id         TEXT PRIMARY KEY,
  periode_id TEXT NOT NULL REFERENCES periode(id),
  kode       TEXT NOT NULL,           -- kompetansemålets kode, f.eks. KM11586
  opprettet  TEXT NOT NULL,
  endret     TEXT NOT NULL,
  slettet    TEXT,
  UNIQUE(periode_id, kode)
);

CREATE INDEX idx_pkm_periode ON periode_kompetansemal(periode_id)
  WHERE slettet IS NULL;
