-- Obvestilo o novem povpraševanju (n8n Booking v2, "Request: Insert Notification")
-- je padalo z napako 22P02: enum notification_type ni poznal 'booking_request'.
-- Zato salon ni dobil ne obvestila v aplikaciji ne pusha.
--
-- Dodajanje vrednosti enumu je varno in ga ni mogoče uporabiti v isti transakciji,
-- zato ga poženi samostojno (Supabase SQL editor).

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'booking_request';
