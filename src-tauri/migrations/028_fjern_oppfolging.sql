-- 028_fjern_oppfolging.sql — den gamle tabellen `oppfolging` fjernes
--
-- Erstattet av `elevnotat` i 011 (notater med «skal følges opp», SPEC §4.7).
-- Appen har aldri skrevet til `oppfolging`, så den er tom overalt; ingen
-- rader å flytte. Indeksen går med tabellen.
DROP INDEX IF EXISTS idx_oppf_apen;
DROP TABLE IF EXISTS oppfolging;
