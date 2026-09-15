-- 011_motelogg.sql — notater og møtelogg per elev (SPEC §4.7)
--
-- Tar over for både `oppfolging` og fritekstfeltet `elev.notat`. Et felt som
-- overskrives har ingen historikk å vise, og det var nettopp historikken som
-- manglet: notater fra flere møter, samlet, i den rekkefølgen de skjedde.
--
-- Notatet henger alltid på en elev og et skoleår. Fag er valgfritt — en
-- mentorsamtale har som regel ikke noe fag, en avtale om ekstra arbeid i MFL1
-- har det.

CREATE TABLE elevnotat (
  id               TEXT PRIMARY KEY,
  elev_id          TEXT NOT NULL REFERENCES elev(id),
  skolear_id       TEXT NOT NULL REFERENCES skolear(id),
  skolear_fag_id   TEXT REFERENCES skolear_fag(id),  -- NULL = ikke knyttet til ett fag
  dato             TEXT NOT NULL,        -- når møtet skjedde, ikke når du skrev
  tekst            TEXT NOT NULL,
  skal_folges_opp  INTEGER NOT NULL DEFAULT 0,
  frist            TEXT,                 -- valgfri, også når skal_folges_opp = 1
  lukket           TEXT,                 -- NULL = åpent
  opprettet TEXT NOT NULL,
  endret    TEXT NOT NULL,
  slettet   TEXT
);

CREATE INDEX idx_elevnotat ON elevnotat(elev_id, dato) WHERE slettet IS NULL;

CREATE INDEX idx_elevnotat_apen ON elevnotat(skolear_id)
  WHERE skal_folges_opp = 1 AND lukket IS NULL AND slettet IS NULL;

-- Flytt innholdet i elev.notat inn som første rad.
--
-- Datoen settes til elev.endret, ikke til i dag: notatet ble skrevet en gang,
-- og den datoen er det nærmeste vi kommer. Skoleåret blir det aktive, siden
-- feltet aldri har vært knyttet til noe år.
--
-- Tomme og blanke felter gir ingen rad — en tom notatboks er ikke et notat.
INSERT INTO elevnotat (
  id, elev_id, skolear_id, skolear_fag_id, dato, tekst,
  skal_folges_opp, frist, lukket, opprettet, endret, slettet
)
SELECT
  lower(
    hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))
  ),
  e.id,
  (SELECT i.verdi FROM innstilling i
     JOIN skolear s ON s.id = i.verdi AND s.slettet IS NULL
    WHERE i.nokkel = 'aktivt_skolear'),
  NULL,
  substr(e.endret, 1, 10),
  e.notat,
  0, NULL, NULL,
  e.endret, e.endret, NULL
FROM elev e
WHERE e.slettet IS NULL
  AND e.notat IS NOT NULL
  AND trim(e.notat) <> ''
  AND EXISTS (
    SELECT 1 FROM innstilling i
      JOIN skolear s ON s.id = i.verdi AND s.slettet IS NULL
     WHERE i.nokkel = 'aktivt_skolear'
  );

-- Tøm bare det som faktisk ble kopiert. Finnes det ikke et aktivt skoleår å
-- henge notatet på, ble ingenting skrevet — og da skal ingenting fjernes.
UPDATE elev
   SET notat = NULL
 WHERE id IN (SELECT elev_id FROM elevnotat);
