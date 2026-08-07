-- 004_elevnotat.sql — fritekstnotat på eleven
--
-- Notatet hører til eleven, ikke til en enkelt økt eller vurdering. Det er
-- lærerens arbeidsmateriale, og §6 gjelder: helse, hjemmeforhold og andre
-- særlige kategorier hører ikke hjemme her. Appen minner om det ved feltet.
--
-- Notatet følger eleven på tvers av skoleår, som resten av elevraden.

ALTER TABLE elev ADD COLUMN notat TEXT;
