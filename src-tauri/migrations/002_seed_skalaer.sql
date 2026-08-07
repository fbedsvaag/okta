-- 002_seed_skalaer.sql — innebygde skalaer og globale standardvalg, se SPEC.md §5
--
-- UUID-ene er faste og skrevet for hånd. To installasjoner får da samme id-er
-- for de innebygde skalaene, slik at senere synk og sammenslåing er udramatisk.
-- Mønster: 5ca1a000-...-0000000000NN er skala nr NN,
--          5ca1ade1-00NN-...-0000000000MM er verdi nr MM i skala nr NN.
--
-- Merk: rang 0 betyr "ingenting her" og gir alltid tast 0 (§5).
--       teller_ikke er noe annet — det styrer om verdien inngår i statistikk.

-- ---------------------------------------------------------------- trafikklys

INSERT INTO skala (id, navn, bruksomrade, innebygd, opprettet, endret) VALUES
  ('5ca1a000-0000-4000-8000-000000000001', 'Trafikklys', 'skaring', 1,
   '2026-08-01T00:00:00', '2026-08-01T00:00:00');

INSERT INTO skalaverdi (id, skala_id, kode, etikett, rang, farge, bestatt, teller_ikke) VALUES
  ('5ca1ade1-0001-4000-8000-000000000001', '5ca1a000-0000-4000-8000-000000000001',
   'Ikke i økta', 'Eleven var ikke der å vurdere',            0, NULL,    NULL, 1),
  ('5ca1ade1-0001-4000-8000-000000000002', '5ca1a000-0000-4000-8000-000000000001',
   'Rød',         'Ikke i gang med faget denne økta',        10, 'rod',   NULL, 0),
  ('5ca1ade1-0001-4000-8000-000000000003', '5ca1a000-0000-4000-8000-000000000001',
   'Gul',         'Delvis innsats, eller kom sent i gang',   20, 'gul',   NULL, 0),
  ('5ca1ade1-0001-4000-8000-000000000004', '5ca1a000-0000-4000-8000-000000000001',
   'Grønn',       'Jobbet med det som var planlagt',         30, 'gronn', NULL, 0);

-- ---------------------------------------------------------------- godkjent

INSERT INTO skala (id, navn, bruksomrade, innebygd, opprettet, endret) VALUES
  ('5ca1a000-0000-4000-8000-000000000002', 'Godkjent', 'vurdering', 1,
   '2026-08-01T00:00:00', '2026-08-01T00:00:00');

-- "Ikke levert" har rang 0 og får tast 0, men teller_ikke = 0:
-- det er en opplysning om eleven og skal telle med.
INSERT INTO skalaverdi (id, skala_id, kode, etikett, rang, farge, bestatt, teller_ikke) VALUES
  ('5ca1ade1-0002-4000-8000-000000000001', '5ca1a000-0000-4000-8000-000000000002',
   'Ikke levert',   NULL,  0, 'rod',   0, 0),
  ('5ca1ade1-0002-4000-8000-000000000002', '5ca1a000-0000-4000-8000-000000000002',
   'Ikke godkjent', NULL, 10, 'gul',   0, 0),
  ('5ca1ade1-0002-4000-8000-000000000003', '5ca1a000-0000-4000-8000-000000000002',
   'Godkjent',      NULL, 20, 'gronn', 1, 0);

-- ---------------------------------------------------------------- lav–middels–høy

INSERT INTO skala (id, navn, bruksomrade, innebygd, opprettet, endret) VALUES
  ('5ca1a000-0000-4000-8000-000000000003', 'Lav–middels–høy', 'vurdering', 1,
   '2026-08-01T00:00:00', '2026-08-01T00:00:00');

-- bestatt er NULL for alle tre: skalaen beskriver nivå, ikke bestått.
INSERT INTO skalaverdi (id, skala_id, kode, etikett, rang, farge, bestatt, teller_ikke) VALUES
  ('5ca1ade1-0003-4000-8000-000000000001', '5ca1a000-0000-4000-8000-000000000003',
   'Lav',     NULL, 10, NULL, NULL, 0),
  ('5ca1ade1-0003-4000-8000-000000000002', '5ca1a000-0000-4000-8000-000000000003',
   'Middels', NULL, 20, NULL, NULL, 0),
  ('5ca1ade1-0003-4000-8000-000000000003', '5ca1a000-0000-4000-8000-000000000003',
   'Høy',     NULL, 30, NULL, NULL, 0);

-- ---------------------------------------------------------------- karakter 1–6

INSERT INTO skala (id, navn, bruksomrade, innebygd, opprettet, endret) VALUES
  ('5ca1a000-0000-4000-8000-000000000004', 'Karakter 1–6', 'vurdering', 1,
   '2026-08-01T00:00:00', '2026-08-01T00:00:00');

-- Ingen verdi har rang 0 her, så talltastene 1–6 treffer karakteren direkte.
INSERT INTO skalaverdi (id, skala_id, kode, etikett, rang, farge, bestatt, teller_ikke) VALUES
  ('5ca1ade1-0004-4000-8000-000000000001', '5ca1a000-0000-4000-8000-000000000004',
   '1', NULL, 10, NULL, 0, 0),
  ('5ca1ade1-0004-4000-8000-000000000002', '5ca1a000-0000-4000-8000-000000000004',
   '2', NULL, 20, NULL, 1, 0),
  ('5ca1ade1-0004-4000-8000-000000000003', '5ca1a000-0000-4000-8000-000000000004',
   '3', NULL, 30, NULL, 1, 0),
  ('5ca1ade1-0004-4000-8000-000000000004', '5ca1a000-0000-4000-8000-000000000004',
   '4', NULL, 40, NULL, 1, 0),
  ('5ca1ade1-0004-4000-8000-000000000005', '5ca1a000-0000-4000-8000-000000000004',
   '5', NULL, 50, NULL, 1, 0),
  ('5ca1ade1-0004-4000-8000-000000000006', '5ca1a000-0000-4000-8000-000000000004',
   '6', NULL, 60, NULL, 1, 0);

-- ---------------------------------------------------------------- innstillinger

-- Etikettene på trafikklyset ligger på skalaverdi.etikett og redigeres der.
-- aktivt_skolear og eksportmappe settes av brukeren, ikke her.
INSERT INTO innstilling (nokkel, verdi, endret) VALUES
  ('standard_varighet_min', '180', '2026-08-01T00:00:00');
