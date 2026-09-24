-- VAT number verification (VIES) on "Podatki podjetij".
--
-- Additive only. Run manually via the Supabase SQL editor.
-- Written by /api/company/vat-check. Billing (n8n → Stripe) reads it:
--   vat_verified = true and the company is in another EU country than
--   Jedro+ → reverse charge (no VAT on the invoice); otherwise VAT of the
--   company's country (Stripe Tax).

ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS vat_verified boolean;
ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS vat_verified_at timestamptz;
ALTER TABLE "Podatki podjetij" ADD COLUMN IF NOT EXISTS vat_verified_name text;

-- Rollback:
--   ALTER TABLE "Podatki podjetij" DROP COLUMN IF EXISTS vat_verified_name;
--   ALTER TABLE "Podatki podjetij" DROP COLUMN IF EXISTS vat_verified_at;
--   ALTER TABLE "Podatki podjetij" DROP COLUMN IF EXISTS vat_verified;
