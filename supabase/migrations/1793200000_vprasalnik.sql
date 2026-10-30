-- Questionnaire before the appointment ("Vprašalnik pred terminom").
--
-- "Podatki podjetij".vprasalnik: the salon's questions, a JSON list edited in
-- Nastavitve rezervacij (PATCH /api/company/questionnaire). Each question:
--   { id, vprasanje, vprasanje_en?, tip: 'besedilo'|'da_ne'|'izbira',
--     moznosti?: [..], moznosti_en?: [..], obvezno: bool, storitve: [service ids] }
-- An empty `storitve` list means the question is asked for every service.
-- n8n booking-v2 init passes the list to the booking page.
--
-- Termini.vprasalnik_odgovori / zahteve_termini.vprasalnik_odgovori: what the
-- client answered, as a snapshot [{ id, vprasanje, odgovor }], so later
-- changes to the questions never change old answers. Written by n8n
-- booking-v2 (create, request-create; confirm copies them from the request).
--
-- Run manually via the Supabase SQL editor. Safe to run twice.

ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS vprasalnik jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "Termini" ADD COLUMN IF NOT EXISTS vprasalnik_odgovori jsonb;
ALTER TABLE zahteve_termini ADD COLUMN IF NOT EXISTS vprasalnik_odgovori jsonb;
