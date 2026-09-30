-- 014_arsplanark.sql — det årsplanarket trenger, og lekse på økta
--
-- Arket (§4.9) er ett fag for ett år: kompetansemål og timeregnskap øverst,
-- så øktene med dato, tema, lekse og vurdering. Det som står i hodet på arket
-- hører til faget slik det er dette året, ikke til fagbanken — rommet og
-- teksten kan være andre neste år.
--
-- Lekse er skilt fra `agenda`. Agenda går ut i kalenderen (§8.1), og den
-- feltlista er låst. Lekse står på arket og går ikke ut noe annet sted.
ALTER TABLE okt ADD COLUMN lekse TEXT;

-- Standard rom. Forhåndsutfyller `okt.sted` på nye økter i faget.
ALTER TABLE skolear_fag ADD COLUMN rom TEXT;

-- Faglærer. NULL = lærernavnet fra innstillingene, som er det vanlige —
-- appen har én bruker. Feltet finnes for fag som deles med en kollega.
ALTER TABLE skolear_fag ADD COLUMN laerer TEXT;

-- Kompetansemål som fritekst, for fag uten Udir-kode. Har faget en kode,
-- hentes målene fra grep-fag.json og dette feltet brukes ikke.
ALTER TABLE skolear_fag ADD COLUMN kompetansemal TEXT;

-- Fritekst øverst på arket: vurderingsordning, bøker, hva som helst.
ALTER TABLE skolear_fag ADD COLUMN arknotat TEXT;
