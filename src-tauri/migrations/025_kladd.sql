-- 025_kladd.sql — kladd på økta (ARBEIDSLISTE 16.7)
--
-- Lærerens egne notater til økta: hva som må huskes, idéer, ting å sjekke.
-- Går aldri ut av appen: ikke i kalenderen (CalDAV, §8.1), ikke på
-- årsplanen og ikke i eksport eller arkiv. Byttes med når to økter bytter
-- innhold (16.4).
ALTER TABLE okt ADD COLUMN kladd TEXT;
