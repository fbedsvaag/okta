-- 010_mentor.sql — mentorgruppa som delmengde av klassen
--
-- Læreren er kontaktlærer for kanskje seksten av trettito i 1STC. Flagget
-- ligger på elev_klasse og ikke i en egen tabell, fordi «undergruppe av
-- klassen» er bokstavelig talt det det er — og fordi koblingen allerede er
-- per skoleår. Gruppa følger dermed året uten at noe mer trengs: neste år er
-- det en annen gruppe, og fjorårets står urørt.
--
-- En mentorelev trenger ikke være i noe fag. Det er det vanlige tilfellet —
-- du er kontaktlærer for elever du ikke underviser.

ALTER TABLE elev_klasse ADD COLUMN mentor INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_mentor ON elev_klasse(skolear_id)
  WHERE mentor = 1 AND slettet IS NULL;
