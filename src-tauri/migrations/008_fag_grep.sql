-- Offisiell fagkode fra Udirs Grep-database, f.eks. «MFL1001».
--
-- Fritekst i v1. §10 beskriver oppslag mot Grep på byggetidspunktet, med
-- kompetansemålene i en egen tabell — men koden må ligge på faget uansett,
-- og den kan skrives inn for hånd i mellomtiden. Fag uten treff i Grep
-- (lokale valgfag) skal fortsatt kunne opprettes uten den.
ALTER TABLE fag ADD COLUMN grep_kode TEXT;
