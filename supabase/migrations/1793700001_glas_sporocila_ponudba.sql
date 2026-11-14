-- Asistent+ zapolnitev luknje (4a): ponudba prostega termina stranki s privolitvijo
-- (marketing_consent = true, Timova odločitev O9) ni vezana na termin stranke.
-- id_termina je zato lahko prazen; omejitve 3/stranko in 30/podjetje na dan veljajo enako.
-- Funkcija jp_glas_rezerviraj_sporocilo ostane nespremenjena (p_termin = null).

alter table public.glas_sporocila alter column id_termina drop not null;

comment on column public.glas_sporocila.id_termina is
  'ID termina, o katerem je sporočilo; null = ponudba prostega termina (samo stranki s privolitvijo).';
