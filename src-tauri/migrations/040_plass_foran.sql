-- 040_plass_foran.sql — elever som skal sitte foran i klassekartet
-- (ARBEIDSLISTE 31.1).
--
-- Hører til eleven og gjelder i alle kart. Bare at eleven skal sitte foran,
-- aldri hvorfor: grunnen kan være helse, og den hører ikke hjemme i appen
-- (SPEC §6). Fordelingen behandler det som et krav, som en lås.
ALTER TABLE elev ADD COLUMN plass_foran INTEGER NOT NULL DEFAULT 0;
