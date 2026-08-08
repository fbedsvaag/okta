-- Sted for økta: rom, sal, verksted, «ute».
--
-- Kom til fordi timeplanen skal kunne publiseres som kalender (§8.1), og et
-- kalenderoppslag uten rom er halvveis nyttig. Fritekst med vilje — romnavn
-- varierer for mye mellom skoler til å struktureres, og §1 sier at ingenting
-- skal hardkodes.
ALTER TABLE okt ADD COLUMN sted TEXT;
