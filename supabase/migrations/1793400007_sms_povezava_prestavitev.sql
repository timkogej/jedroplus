-- Stikalo "Povezava za prestavitev v SMS" (Opomniki > Splošno).
-- Dodajanje stolpca; obstoječe vrstice ostanejo na true, torej se obnašanje ne spremeni.
-- Zaženi ročno v Supabase SQL editorju.
ALTER TABLE "Podatki podjetij"
ADD COLUMN IF NOT EXISTS "sms_povezava_prestavitev" boolean NOT NULL DEFAULT true;
