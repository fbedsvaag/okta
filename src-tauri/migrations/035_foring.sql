-- 035_foring.sql — føring av skriftlig prøve og innlevering (ARBEIDSLISTE 29.5)

-- Faste fraser til kommentarene, per vurdering: JSON-liste med tekster.
ALTER TABLE vurdering ADD COLUMN fraser TEXT;

-- levert | ikke | borte. NULL = ikke satt: da gjelder fraværet i økta, og
-- ellers regnes eleven som levert når det er satt en karakter.
-- `levert` (0/1) holdes i takt, så det som teller levert, ikke endres.
ALTER TABLE vurderingsresultat ADD COLUMN leveranse TEXT;
