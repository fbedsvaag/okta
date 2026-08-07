-- 001_schema.sql — grunnschema, se SPEC.md §3
--
-- Alle tabeller: TEXT-UUID som primærnøkkel, opprettet/endret/slettet.
-- Alle spørringer må filtrere på slettet IS NULL.

-- ---------------------------------------------------------------- konfigurasjon

CREATE TABLE skolear (
  id        TEXT PRIMARY KEY,
  navn      TEXT NOT NULL,                -- "2026/27"
  start     TEXT NOT NULL,                -- ISO-dato
  slutt     TEXT NOT NULL,
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

CREATE TABLE innstilling (
  nokkel TEXT PRIMARY KEY,
  verdi  TEXT NOT NULL,
  endret TEXT NOT NULL
);

-- Skalaer må ligge før skolear_fag, som peker på dem.

CREATE TABLE skala (
  id          TEXT PRIMARY KEY,
  navn        TEXT NOT NULL,
  bruksomrade TEXT NOT NULL,              -- skaring | vurdering | begge
  innebygd    INTEGER NOT NULL DEFAULT 0,
  opprettet   TEXT NOT NULL,
  endret      TEXT NOT NULL,
  slettet     TEXT
);

CREATE TABLE skalaverdi (
  id          TEXT PRIMARY KEY,
  skala_id    TEXT NOT NULL REFERENCES skala(id),
  kode        TEXT NOT NULL,              -- "Grønn", "Godkjent", "4"
  etikett     TEXT,                       -- lengre forklaring, vises som hjelpetekst
  rang        INTEGER NOT NULL,           -- høyere = bedre. rang 0 gir tast 0, se §5
  farge       TEXT,                       -- gronn | gul | rod | NULL
  bestatt     INTEGER,                    -- 1 / 0 / NULL
  teller_ikke INTEGER NOT NULL DEFAULT 0  -- 1 = utelates fra all sammenstilling
);

-- Fagbanken er uavhengig av skoleår. Hvert år plukker fag fra den.

CREATE TABLE fag (
  id          TEXT PRIMARY KEY,
  kode        TEXT NOT NULL,              -- "MFL1"
  navn        TEXT NOT NULL,              -- "Markedsføring og ledelse 1"
  farge       TEXT,
  beskrivelse TEXT,
  opprettet   TEXT NOT NULL,
  endret      TEXT NOT NULL,
  slettet     TEXT
);

-- Faget slik det ser ut i ett bestemt skoleår. Alt undervisningsnært
-- (perioder, økter, vurderinger, elevkoblinger) henger her, ikke på fag.

CREATE TABLE skolear_fag (
  id                    TEXT PRIMARY KEY,
  skolear_id            TEXT NOT NULL REFERENCES skolear(id),
  fag_id                TEXT NOT NULL REFERENCES fag(id),
  skaringsskala_id      TEXT REFERENCES skala(id),
  standard_varighet_min INTEGER,          -- NULL = arv fra global standard
  arstimetall           INTEGER,
  opprettet             TEXT NOT NULL,
  endret                TEXT NOT NULL,
  slettet               TEXT,
  UNIQUE(skolear_id, fag_id)
);

-- ---------------------------------------------------------------- elever

CREATE TABLE klasse (
  id         TEXT PRIMARY KEY,
  navn       TEXT NOT NULL,               -- "1STC"
  skolear_id TEXT NOT NULL REFERENCES skolear(id),
  opprettet  TEXT NOT NULL,
  endret     TEXT NOT NULL,
  slettet    TEXT
);

-- Eleven lever på tvers av skoleår og eier ingen klasse selv.

CREATE TABLE elev (
  id        TEXT PRIMARY KEY,
  fornavn   TEXT NOT NULL,
  etternavn TEXT NOT NULL,
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

-- skolear_id gjentar klasse.skolear_id med vilje: det er den som gjør
-- "én klasse per elev per skoleår" til en regel basen selv håndhever.

CREATE TABLE elev_klasse (
  id         TEXT PRIMARY KEY,
  elev_id    TEXT NOT NULL REFERENCES elev(id),
  klasse_id  TEXT NOT NULL REFERENCES klasse(id),
  skolear_id TEXT NOT NULL REFERENCES skolear(id),
  opprettet  TEXT NOT NULL,
  endret     TEXT NOT NULL,
  slettet    TEXT,
  UNIQUE(elev_id, skolear_id)
);

CREATE TABLE elev_fag (
  id             TEXT PRIMARY KEY,
  elev_id        TEXT NOT NULL REFERENCES elev(id),
  skolear_fag_id TEXT NOT NULL REFERENCES skolear_fag(id),
  opprettet      TEXT NOT NULL,
  endret         TEXT NOT NULL,
  slettet        TEXT,
  UNIQUE(elev_id, skolear_fag_id)
);

-- ---------------------------------------------------------------- perioder og økter

CREATE TABLE periode (
  id             TEXT PRIMARY KEY,
  skolear_fag_id TEXT NOT NULL REFERENCES skolear_fag(id),
  navn           TEXT NOT NULL,
  rekkefolge     INTEGER NOT NULL,
  start          TEXT,                    -- planlagt, ikke faktisk
  slutt          TEXT,
  kompetansemal  TEXT,
  notat          TEXT,                    -- markdown
  farge          TEXT,
  opprettet      TEXT NOT NULL,
  endret         TEXT NOT NULL,
  slettet        TEXT
);

CREATE TABLE okt (
  id             TEXT PRIMARY KEY,
  skolear_fag_id TEXT NOT NULL REFERENCES skolear_fag(id),
  periode_id     TEXT REFERENCES periode(id),  -- NULL = uplassert, lovlig
  dato           TEXT NOT NULL,           -- YYYY-MM-DD
  klokkeslett    TEXT,                    -- "09:15"
  varighet_min   INTEGER NOT NULL,
  kode           TEXT,                    -- "2608-ENG1-3", lesbar id
  tema           TEXT,
  kompetansemal  TEXT,
  plan           TEXT,                    -- markdown, hva som skal skje
  logg           TEXT,                    -- markdown, hvordan det gikk
  opprettet      TEXT NOT NULL,
  endret         TEXT NOT NULL,
  slettet        TEXT
);

-- Én rad per elev per økt. Bare det læreren faktisk trykker lagres;
-- resten fylles med rang 0 ved visning, se §3.3.

CREATE TABLE skaring (
  id            TEXT PRIMARY KEY,
  elev_id       TEXT NOT NULL REFERENCES elev(id),
  okt_id        TEXT NOT NULL REFERENCES okt(id),
  skalaverdi_id TEXT NOT NULL REFERENCES skalaverdi(id),
  notat         TEXT,
  opprettet     TEXT NOT NULL,
  endret        TEXT NOT NULL,
  slettet       TEXT,
  UNIQUE(elev_id, okt_id)
);

-- ---------------------------------------------------------------- vurdering

CREATE TABLE vurdering (
  id             TEXT PRIMARY KEY,
  skolear_fag_id TEXT NOT NULL REFERENCES skolear_fag(id),
  okt_id         TEXT REFERENCES okt(id),
  skala_id       TEXT NOT NULL REFERENCES skala(id),
  tittel         TEXT NOT NULL,
  type           TEXT,                    -- muntlig | skriftlig | praktisk
  frist          TEXT,
  beskrivelse    TEXT,
  opprettet      TEXT NOT NULL,
  endret         TEXT NOT NULL,
  slettet        TEXT
);

CREATE TABLE vurderingsresultat (
  id            TEXT PRIMARY KEY,
  vurdering_id  TEXT NOT NULL REFERENCES vurdering(id),
  elev_id       TEXT NOT NULL REFERENCES elev(id),
  skalaverdi_id TEXT REFERENCES skalaverdi(id),
  levert        INTEGER NOT NULL DEFAULT 0,
  kommentar     TEXT,                     -- markdown
  opprettet     TEXT NOT NULL,
  endret        TEXT NOT NULL,
  slettet       TEXT,
  UNIQUE(vurdering_id, elev_id)
);

CREATE TABLE oppfolging (
  id             TEXT PRIMARY KEY,
  elev_id        TEXT NOT NULL REFERENCES elev(id),
  skolear_fag_id TEXT REFERENCES skolear_fag(id),
  status         TEXT NOT NULL,           -- folg_med | tiltak | varsel
  tekst          TEXT,
  frist          TEXT,
  lukket         TEXT,                    -- NULL = åpen
  opprettet      TEXT NOT NULL,
  endret         TEXT NOT NULL,
  slettet        TEXT
);

-- ---------------------------------------------------------------- indekser

CREATE INDEX idx_skaring_okt    ON skaring(okt_id)   WHERE slettet IS NULL;
CREATE INDEX idx_skaring_elev   ON skaring(elev_id)  WHERE slettet IS NULL;
CREATE INDEX idx_okt_fag_dato   ON okt(skolear_fag_id, dato) WHERE slettet IS NULL;
CREATE INDEX idx_okt_periode    ON okt(periode_id)   WHERE slettet IS NULL;
CREATE INDEX idx_sfag_skolear   ON skolear_fag(skolear_id) WHERE slettet IS NULL;
CREATE INDEX idx_klasse_skolear ON klasse(skolear_id) WHERE slettet IS NULL;
CREATE INDEX idx_elev_klasse    ON elev_klasse(klasse_id) WHERE slettet IS NULL;
CREATE INDEX idx_klasse_elev    ON elev_klasse(elev_id, skolear_id) WHERE slettet IS NULL;
CREATE INDEX idx_elev_fag       ON elev_fag(skolear_fag_id) WHERE slettet IS NULL;
CREATE INDEX idx_fag_elev       ON elev_fag(elev_id) WHERE slettet IS NULL;
CREATE INDEX idx_periode_fag    ON periode(skolear_fag_id, rekkefolge) WHERE slettet IS NULL;
CREATE INDEX idx_vurd_fag       ON vurdering(skolear_fag_id) WHERE slettet IS NULL;
CREATE INDEX idx_res_elev       ON vurderingsresultat(elev_id) WHERE slettet IS NULL;
CREATE INDEX idx_oppf_apen      ON oppfolging(lukket) WHERE lukket IS NULL AND slettet IS NULL;
CREATE INDEX idx_skalaverdi     ON skalaverdi(skala_id, rang);
