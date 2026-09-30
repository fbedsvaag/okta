-- 018_fag_alias.sql — et fag kan ha et kallenavn
--
-- Læreren kaller ofte faget noe annet enn koden det står under: SAM3045 er
-- «MFL1» i egne dokumenter og filnavn. Aliaset gjør at faget kan søkes opp
-- med det navnet (⌘K). Det ligger på fagbanken, som koden: kallenavnet
-- følger faget fra år til år.
ALTER TABLE fag ADD COLUMN alias TEXT;
