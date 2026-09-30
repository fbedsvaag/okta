-- 021_elevbilde.sql — bilde av eleven, klippet fra InSchool-utskriften
--
-- Ett bilde per elev. Lagres som gråtoner (JPEG som data-URL, noen få kB),
-- og looken — posterisering og lilla tone — legges på i visningen, så den
-- kan endres uten ny import.
--
-- Bildet er personopplysning og går aldri ut av appen: ikke i CalDAV (§8.1),
-- ikke i arkivet eller eksportene. Det følger sikkerhetskopien, som er en
-- kopi av hele basen på samme maskin.
--
-- Soft delete som alt annet (§9), men bildet selv tømmes når raden slettes:
-- en slettet elev skal ikke ha ansiktet sitt liggende igjen i basen.
CREATE TABLE elevbilde (
  id         TEXT PRIMARY KEY,
  elev_id    TEXT NOT NULL REFERENCES elev(id),
  bilde      TEXT,                    -- data:image/jpeg;base64,… ; NULL når slettet
  kilde      TEXT,                    -- «InSchool», til visning
  opprettet  TEXT NOT NULL,
  endret     TEXT NOT NULL,
  slettet    TEXT,
  UNIQUE(elev_id)
);
