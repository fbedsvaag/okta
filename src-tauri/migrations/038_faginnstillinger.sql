-- 038_faginnstillinger.sql — faginnstillinger på stedet (ARBEIDSLISTE 29.2)

-- Ukedagene faget har økter, som «1,4» (mandag = 1). NULL = regnet ut fra
-- øktene, som før.
ALTER TABLE skolear_fag ADD COLUMN ukedager TEXT;
-- Skalaen nye vurderinger i faget får. NULL = den første vurderingsskalaen.
ALTER TABLE skolear_fag ADD COLUMN vurderingsskala_id TEXT REFERENCES skala(id);
-- Arkivert: faget vises ikke lenger blant årets fag, men elever, økter og
-- vurderinger blir liggende. Datoen det ble arkivert; NULL = i bruk.
ALTER TABLE skolear_fag ADD COLUMN arkivert TEXT;
