-- 029_skalaverdi_stempler.sql — stempler og myk sletting på skalaverdi
--
-- Egne skalaer (ARBEIDSLISTE §22) kan få verdier lagt til og fjernet.
-- `skalaverdi` hadde verken stempler eller `slettet` (001), i strid med regel 2
-- i CLAUDE.md. Kolonnene legges til her; de innebygde verdiene får skalaens
-- opprettet-tidspunkt. En brukt verdi kan aldri slettes (§5.3), så en slettet
-- verdi er aldri en som skåringer eller resultater peker på.
ALTER TABLE skalaverdi ADD COLUMN opprettet TEXT;
ALTER TABLE skalaverdi ADD COLUMN endret TEXT;
ALTER TABLE skalaverdi ADD COLUMN slettet TEXT;

UPDATE skalaverdi
   SET opprettet = (SELECT s.opprettet FROM skala s WHERE s.id = skalaverdi.skala_id),
       endret    = (SELECT s.opprettet FROM skala s WHERE s.id = skalaverdi.skala_id);
