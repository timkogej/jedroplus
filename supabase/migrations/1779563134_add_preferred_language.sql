-- Add preferred_language column to company settings table.
-- Run manually via Supabase SQL editor AFTER deploying the i18n-foundation branch.
-- Do NOT run before the feature branch is deployed.

ALTER TABLE "Podatki podjetij"
ADD COLUMN preferred_language VARCHAR(2) NOT NULL DEFAULT 'sl';

ALTER TABLE "Podatki podjetij"
ADD CONSTRAINT preferred_language_supported
CHECK (preferred_language IN ('sl', 'en', 'hr', 'de', 'it'));
