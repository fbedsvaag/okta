-- 019_rydd_slettede_elever.sql — ingenting skal henge igjen etter en slettet elev
--
-- Sletter man en elev, skal alt som hører til eleven bort: skåringer,
-- vurderingsresultater, notater, samtaler og koblingene til fag og klasse.
-- Slettingen har gjort det (bortsett fra samtalene), men data kunne likevel
-- bli liggende — og da telte skåringene fra slettede elever med i øktlista og
-- i «Innsats over tid».
--
-- Dette rydder én gang. Soft delete, som alt annet (§9).
UPDATE skaring SET slettet = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'),
                   endret  = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
 WHERE slettet IS NULL
   AND elev_id IN (SELECT id FROM elev WHERE slettet IS NOT NULL);

UPDATE vurderingsresultat SET slettet = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'),
                              endret  = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
 WHERE slettet IS NULL
   AND elev_id IN (SELECT id FROM elev WHERE slettet IS NOT NULL);

UPDATE elevnotat SET slettet = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'),
                     endret  = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
 WHERE slettet IS NULL
   AND elev_id IN (SELECT id FROM elev WHERE slettet IS NOT NULL);

UPDATE samtale SET slettet = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'),
                   endret  = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
 WHERE slettet IS NULL
   AND elev_id IN (SELECT id FROM elev WHERE slettet IS NOT NULL);

UPDATE elev_fag SET slettet = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'),
                    endret  = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
 WHERE slettet IS NULL
   AND elev_id IN (SELECT id FROM elev WHERE slettet IS NOT NULL);

UPDATE elev_klasse SET slettet = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'),
                       endret  = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
 WHERE slettet IS NULL
   AND elev_id IN (SELECT id FROM elev WHERE slettet IS NOT NULL);
