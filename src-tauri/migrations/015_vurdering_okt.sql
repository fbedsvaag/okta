-- 015_vurdering_okt.sql — vurderinger som var knyttet til en økt bare på dato
--
-- `vurdering.okt_id` har stått i schemaet fra start, men ingenting skrev
-- den. Øktlista gjettet i stedet: en vurdering med frist samme dag som en
-- økt i faget ble vist på den økta. Nå skrives koblingen når fristen settes
-- (og kan velges for hånd), så gjettingen er fjernet fra visningen.
--
-- Denne migrasjonen gjør gjettingen én gang for det som alt ligger i basen,
-- slik at ingenting forsvinner fra lista. Bare der det er nøyaktig én økt i
-- faget på fristdagen — er det to, vet vi ikke hvilken.
UPDATE vurdering
   SET okt_id = (
         SELECT o.id FROM okt o
          WHERE o.skolear_fag_id = vurdering.skolear_fag_id
            AND o.dato = vurdering.frist
            AND o.slettet IS NULL
       ),
       endret = strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')
 WHERE okt_id IS NULL
   AND frist IS NOT NULL
   AND slettet IS NULL
   AND (SELECT COUNT(*) FROM okt o
         WHERE o.skolear_fag_id = vurdering.skolear_fag_id
           AND o.dato = vurdering.frist
           AND o.slettet IS NULL) = 1;
