-- 033_onsker_avtaler.sql — ønsker og avtaler om hvem som sitter sammen
-- (ARBEIDSLISTE 26.8 og 26.13). Bare for læreren: aldri i eksport,
-- utskrift, Teams, bilde, kalender eller oppsettfil.

-- «Trives med · vil gjerne sitte med». Ikke knyttet til fag: gjelder i
-- alle fag der begge er. kilde: samtale | eleven | selv.
CREATE TABLE elevonske (
  id             TEXT PRIMARY KEY,
  elev_id        TEXT NOT NULL REFERENCES elev(id),
  onsker_elev_id TEXT NOT NULL REFERENCES elev(id),
  kilde          TEXT NOT NULL,
  dato           TEXT NOT NULL,
  samtale_id     TEXT REFERENCES samtale(id),
  opprettet      TEXT NOT NULL,
  endret         TEXT NOT NULL,
  slettet        TEXT
);
CREATE INDEX idx_elevonske_elev ON elevonske(elev_id) WHERE slettet IS NULL;
CREATE INDEX idx_elevonske_onsket ON elevonske(onsker_elev_id) WHERE slettet IS NULL;

-- «Neste gang skal … sitte med»: en avtale i ett fag. Hard regel ved neste
-- Stokk; brukt settes når kartet eller settet lagres.
-- gjelder: klassekart | grupper | begge. kilde: eleven | samtale | jeg.
CREATE TABLE neste_sammen (
  id             TEXT PRIMARY KEY,
  elev_id        TEXT NOT NULL REFERENCES elev(id),
  med_elev_id    TEXT NOT NULL REFERENCES elev(id),
  skolear_fag_id TEXT NOT NULL REFERENCES skolear_fag(id),
  gjelder        TEXT NOT NULL,
  kilde          TEXT NOT NULL,
  dato           TEXT NOT NULL,
  brukt          TEXT,
  opprettet      TEXT NOT NULL,
  endret         TEXT NOT NULL,
  slettet        TEXT
);
CREATE INDEX idx_neste_sammen_fag ON neste_sammen(skolear_fag_id)
  WHERE slettet IS NULL AND brukt IS NULL;
