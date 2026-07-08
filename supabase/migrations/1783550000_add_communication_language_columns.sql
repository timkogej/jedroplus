-- Communication language used for client and appointment messaging.

ALTER TABLE "Podatki podjetij"
ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'slo';

ALTER TABLE "Stranke"
ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'slo';

ALTER TABLE "Termini"
ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'slo';
