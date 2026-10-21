-- 030_vurdering_utkast.sql — utkast for vurderinger (ARBEIDSLISTE §24)
--
-- Vurderinger hentet fra i fjor er forslag til de er bekreftet: de vises
-- dempet med «Utkast» og står ikke blant fristene i I dag. 0 = bekreftet,
-- som alt som finnes fra før.
ALTER TABLE vurdering ADD COLUMN utkast INTEGER NOT NULL DEFAULT 0;
