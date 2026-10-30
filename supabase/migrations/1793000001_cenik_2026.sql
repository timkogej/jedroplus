-- Nov cenik (november 2026): Jedro Plus 14,90 €, Jedro Pro 29,90 €.
--
-- Stripe zaračunava po svojih cenah; stolpec `price_monthly_cents` v `plans`
-- samo prikazuje ceno v aplikaciji (Dodatki). Zato ga uskladimo ročno,
-- ob istem času, ko v Stripe zamenjaš cene.
--
-- Člani ekipe so v ceniku vključeni brez doplačila: Plus do 3, Pro do 5.
-- Obstoječe podjetje s `company_user_limits.max_users` si omejitev ohrani, dokler
-- je ne preračuna n8n; tu spremenimo samo privzeto vrednost paketa.

update public.plans set price_monthly_cents = 1490, max_employees = 3 where code = 'JEDRO_PLUS';
update public.plans set price_monthly_cents = 2990, max_employees = 5 where code = 'JEDRO_PRO';
