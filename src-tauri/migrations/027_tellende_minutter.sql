-- 027_tellende_minutter.sql — tellende minutter per økt (ARBEIDSLISTE 17.6)
--
-- En økt 08:30–11:45 er 195 min, men skal kunne telle som 180 i
-- timeregnskapet. Et tak per fag i året: en økt teller høyst så mange
-- minutter. Tomt betyr faktisk lengde. Selve økta beholder sin lengde.
ALTER TABLE skolear_fag ADD COLUMN tellende_min INTEGER;
