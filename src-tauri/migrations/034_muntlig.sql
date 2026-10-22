-- 034_muntlig.sql — muntlig vurdering med tidsplan, oppgavekort og rubrikk
-- (ARBEIDSLISTE 28.1–28.3b).
--
-- Rubrikken ligger som JSON på vurderingen: kriterier (rader) og nivåer
-- (kolonner) med id, så valgene per elev kan peke på dem selv om
-- rekkefølgen endres. Den kopieres hel — fra en mal, fra i fjor, fra en
-- oppsettfil — og redigeres alltid som én enhet.

-- kriterier | rubrikk. NULL = kriterier (avkrysning).
ALTER TABLE vurdering ADD COLUMN vurderingsform TEXT;
-- {"nivaer":[{"id","navn"}],"kriterier":[{"id","tekst","celler":{nivaId:tekst}}]}
ALTER TABLE vurdering ADD COLUMN rubrikk TEXT;
-- Tidsplanen: minutter per elev og pause mellom. NULL = standard.
ALTER TABLE vurdering ADD COLUMN samtale_min INTEGER;
ALTER TABLE vurdering ADD COLUMN pause_min INTEGER;
-- Oppgavene: kan samme oppgave trekkes av flere, og trekkes de med en gang
-- (1) eller under samtalen (0).
ALTER TABLE vurdering ADD COLUMN trekk_flere INTEGER NOT NULL DEFAULT 1;
ALTER TABLE vurdering ADD COLUMN trekk_na INTEGER NOT NULL DEFAULT 1;

-- Hva som er valgt for eleven: {kriteriumId: nivaId} i en rubrikk,
-- {kriteriumId: true} ved avkrysning.
ALTER TABLE vurderingsresultat ADD COLUMN rubrikkvalg TEXT;
-- Spørsmålene som er stilt, som indekser i oppgavekortets liste. Kommer
-- ikke med i karakteren.
ALTER TABLE vurderingsresultat ADD COLUMN stilte TEXT;

-- Oppgavekortene eleven trekker blant. samtale.tema lagrer tittelen på den
-- som ble trukket.
CREATE TABLE oppgavekort (
  id           TEXT PRIMARY KEY,
  vurdering_id TEXT NOT NULL REFERENCES vurdering(id),
  nr           INTEGER NOT NULL,
  tittel       TEXT NOT NULL DEFAULT '',
  beskrivelse  TEXT,
  sporsmal     TEXT,                 -- JSON-liste med tekster
  opprettet    TEXT NOT NULL,
  endret       TEXT NOT NULL,
  slettet      TEXT
);
CREATE INDEX idx_oppgavekort_vurdering ON oppgavekort(vurdering_id)
  WHERE slettet IS NULL;

-- Rubrikker lagret som maler. En vurdering får en kopi; malen endres ikke.
CREATE TABLE rubrikkmal (
  id        TEXT PRIMARY KEY,
  navn      TEXT NOT NULL,
  innhold   TEXT NOT NULL,           -- samme JSON som vurdering.rubrikk
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);
