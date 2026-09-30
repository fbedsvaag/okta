-- 017_periode_malt.sql — perioden står på økta, ikke i datoene
--
-- Periodiseringen gjøres nå ved å fargelegge øktene: velg en periode, dra
-- over radene. Da er det `okt.periode_id` som bestemmer, alltid. Før ble
-- perioden utledet av datoene når feltet var tomt, og da kunne en økt ikke
-- tas ut av en periode uten å flytte periodegrensene.
--
-- Denne migrasjonen skriver ned det datoene sa, én gang, så ingenting skifter
-- periode. Faller en økt i flere perioder, vinner den som begynner først —
-- samme regel som visningen brukte.
UPDATE okt
   SET periode_id = (
         SELECT p.id FROM periode p
          WHERE p.skolear_fag_id = okt.skolear_fag_id
            AND p.slettet IS NULL
            AND p.start IS NOT NULL AND p.slutt IS NOT NULL
            AND okt.dato BETWEEN p.start AND p.slutt
          ORDER BY p.start, p.rekkefolge
          LIMIT 1
       ),
       endret = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
 WHERE periode_id IS NULL
   AND slettet IS NULL
   AND EXISTS (
         SELECT 1 FROM periode p
          WHERE p.skolear_fag_id = okt.skolear_fag_id
            AND p.slettet IS NULL
            AND p.start IS NOT NULL AND p.slutt IS NOT NULL
            AND okt.dato BETWEEN p.start AND p.slutt
       );
