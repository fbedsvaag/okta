-- 005_fridag.sql — dager uten undervisning
--
-- Ferier, planleggingsdager og andre blokkerte dager hører til skoleåret:
-- 2027/28 har andre ferieuker enn 2026/27, og de følger fylket.
--
-- Røde dager ligger IKKE her. De regnes ut fra påsken i kalender.ts og
-- trenger ingen liste noen må vedlikeholde.

CREATE TABLE fridag (
  id         TEXT PRIMARY KEY,
  skolear_id TEXT NOT NULL REFERENCES skolear(id),
  navn       TEXT NOT NULL,            -- "Høstferie", "Planleggingsdag"
  type       TEXT NOT NULL,            -- ferie | planlegging | annet
  fra        TEXT NOT NULL,            -- ISO-dato, til og med
  til        TEXT NOT NULL,
  opprettet  TEXT NOT NULL,
  endret     TEXT NOT NULL,
  slettet    TEXT
);

CREATE INDEX idx_fridag_skolear ON fridag(skolear_id, fra) WHERE slettet IS NULL;
