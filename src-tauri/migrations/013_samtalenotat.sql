-- 013_samtalenotat.sql — notatet fra en samtale hører til møteloggen
--
-- Notatet fra en mentorsamtale er et notat om eleven, ikke en egenskap ved
-- timeplanraden. Det bor derfor i elevnotat (§4.7), og samtale_id sier bare
-- hvor det kom fra.
--
-- Alternativet — en notatkolonne på samtale — ville gitt to steder å skrive
-- et notat om en elev. Det er nøyaktig det migrasjon 011 ryddet bort da
-- elev.notat ble flyttet inn i møteloggen.
--
-- MERK at lenken er svak med vilje: en ny trekning erstatter samtaleradene,
-- og da peker notatet på en slettet rad. Notatet står likevel i møteloggen med
-- sin dato og sitt fag, og visningen bygger på notatets egne felter — ikke på
-- at samtalen fortsatt finnes.

ALTER TABLE elevnotat ADD COLUMN samtale_id TEXT REFERENCES samtale(id);

CREATE INDEX idx_elevnotat_samtale ON elevnotat(samtale_id)
  WHERE samtale_id IS NOT NULL AND slettet IS NULL;
