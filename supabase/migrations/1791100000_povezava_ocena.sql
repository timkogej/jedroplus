-- Povezava za oceno podjetja.
--
-- Sporočila po terminu se zdaj končajo s "če želiš nov termin, pokliči" — tudi
-- tam, kjer bi stranka lahko kaj naredila sama. Povezava za oceno je naravni
-- dodatek ravno v tem sporočilu: stranka je bila pravkar na obisku.
--
-- Prosto besedilo, ker podjetja zbirajo ocene na različnih mestih — Google,
-- Facebook, kaj tretjega. Preverjanja oblike namenoma ni; edina zahteva, ki jo
-- postavimo, je v vmesniku, kjer opozorimo, naj uporabijo kratko obliko.
--
-- Pri SMS je dolžina resnična omejitev: kratka Google povezava
-- (g.page/r/.../review) je 31 znakov, dolga z `placeid` pa 71 — pri daljši
-- predlogi to pomeni dva SMS namesto enega.

alter table public."Podatki podjetij"
  add column if not exists povezava_ocena text;

comment on column public."Podatki podjetij".povezava_ocena is
  'Povezava, kamor stranka odda oceno (Google, Facebook ...). Uporablja jo oznaka {{povezava_ocena}} v sporočilu po terminu.';
