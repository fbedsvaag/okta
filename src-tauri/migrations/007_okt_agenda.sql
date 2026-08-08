-- Agenda: kort beskrivelse av økta, skrevet for eleven.
--
-- Skilt fra `plan`, som er lærerens egne notater om hva som skal skje.
-- Agenda går ut i kalenderen som kommentar (§8.1) og leses av alle som
-- abonnerer. `plan` og `logg` gjør det aldri.
ALTER TABLE okt ADD COLUMN agenda TEXT;
