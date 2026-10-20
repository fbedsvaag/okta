-- 026_pause_per_fag.sql — standard pausetider per fag (ARBEIDSLISTE 17.5)
--
-- «10 min pause etter 45 min». Legges inn i planen når en ny økt lages, og
-- kan endres per økt. Hører til faget i ett skoleår, som standard varighet
-- og rom. Tomt betyr ingen pause.
ALTER TABLE skolear_fag ADD COLUMN pause_etter_min INTEGER;
ALTER TABLE skolear_fag ADD COLUMN pause_min INTEGER;
