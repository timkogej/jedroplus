-- Zgornja meja za sporočilo po terminu.
--
-- Sporočilo po terminu se pošlje, ko salon termin označi za zaključenega, ne na
-- dan obiska. V produkciji je bila zato skoraj polovica sporočil poslana po
-- dnevu termina — 21 od 43, najhujše 15 dni kasneje. Zahvala za obisk, ki se je
-- zgodil pred dvema tednoma, je za stranko bolj čudna kot nobena.
--
-- Prag je po podjetju, ker se navade razlikujejo: kdo zaključuje sproti, kdo
-- enkrat tedensko. Privzeti trije dnevi so dovolj ohlapni za vikend.
--
-- Vrednost 0 (ali NULL) pomeni brez omejitve — torej obnašanje, kakršno je bilo
-- doslej. Tako podjetje, ki tega noče, ni prisiljeno vanj.

alter table public."Podatki podjetij"
  add column if not exists po_terminu_max_dni integer not null default 3;

comment on column public."Podatki podjetij".po_terminu_max_dni is
  'Največ toliko dni po terminu se še pošlje sporočilo po terminu. 0 = brez omejitve.';
