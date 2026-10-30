-- Samodejni zaključek terminov.
--
-- Termin se doslej zaključi samo z ročnim klikom. V produkciji je ostalo 90 %
-- preteklih terminov odprtih, zato stranke niso dobile sporočila po terminu in
-- prihodek ter statistika sta bila nepopolna.
--
-- Nastavitev je po podjetju: koliko ur po koncu termina se ta zaključi sam.
-- 0 pomeni izklopljeno — podjetje, ki tega ne vklopi, ne opazi nobene
-- spremembe. Dovoljene so le vrednosti, ki jih ponuja nastavitev (1, 2, 4).
--
-- Zaključek sproži zaganjalnik (app/api/cron/auto-complete) prek istega
-- dogodka ZAKLJUCITEV_TERMINA kot ročni klik, zato n8n pošlje sporočilo po
-- terminu po istih pravilih (kanal, predloga, po_terminu_max_dni).

alter table public."Podatki podjetij"
  add column if not exists samodejni_zakljucek_ur integer not null default 0;

alter table public."Podatki podjetij"
  drop constraint if exists samodejni_zakljucek_ur_veljavno;
alter table public."Podatki podjetij"
  add constraint samodejni_zakljucek_ur_veljavno
  check (samodejni_zakljucek_ur in (0, 1, 2, 4));

comment on column public."Podatki podjetij".samodejni_zakljucek_ur is
  'Čez koliko ur po koncu termina se ta samodejno zaključi. 0 = izklopljeno.';
