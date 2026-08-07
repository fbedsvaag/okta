-- 003_elevkode.sql — lesbar id på eleven
--
-- elev.id er en UUID og må bli stående: den er grunnlaget for synk (§9).
-- Men en UUID kan ikke stå i en filtittel eller en lenke. elev.kode er den
-- korte, lesbare varianten: forbokstav i fornavn + forbokstav i etternavn +
-- fem sifre. "TS48213".
--
-- Koden følger eleven gjennom hele videregående, på tvers av skoleår.
-- Den genereres i frontend, som alt annet id-arbeid.

ALTER TABLE elev ADD COLUMN kode TEXT;

CREATE UNIQUE INDEX idx_elev_kode ON elev(kode) WHERE kode IS NOT NULL;
