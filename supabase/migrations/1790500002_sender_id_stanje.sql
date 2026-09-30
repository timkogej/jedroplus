-- Stanje sender ID-ja za prikaz v aplikaciji.
--
-- Vmesnik mora vedeti štiri stvari hkrati: ali paket to sploh dovoli, kaj je
-- vpisano, kje je odobritev in kaj se dejansko uporablja pri pošiljanju.
-- En klic namesto štirih poizvedb, pravilo pa ostane na enem mestu.
--
-- security definer: `plans` in `company_subscriptions` sta pod RLS in ju
-- prijavljen uporabnik ne more nujno brati. Funkcija vrne samo podatke o
-- podjetju, ki ga klicatelj že navede, in nobenega tujega.

create or replace function public.jp_sender_id_stanje(company_code text)
returns table (
  dovoljen  boolean,   -- ali paket dopušča lastno ime
  ime       text,      -- kar je vpisano
  status    text,      -- ni_zaproseno | v_obdelavi | odobreno | zavrnjeno
  drzava    text,      -- za katero državo je bila odobritev dana
  opomba    text,      -- razlog zavrnitve
  v_uporabi text       -- kar se dejansko pošlje; NULL = privzeto Jedroplus
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  c record;
begin
  select co.id, co.sms_sender_id, co.sms_sender_id_status,
         co.sms_sender_id_country, co.sms_sender_id_note
    into c
  from public.companies co
  where co."company_id" = company_code
  limit 1;

  if not found then
    return;
  end if;

  return query
  select
    coalesce((
      select bool_or(p.sender_id_enabled)
      from public.company_subscriptions cs
      join public.plans p on p.id = cs.plan_id
      where cs.company_id = c.id
        and cs.status in ('active', 'trialing')
    ), false),
    c.sms_sender_id,
    c.sms_sender_id_status,
    c.sms_sender_id_country,
    c.sms_sender_id_note,
    public.jp_sender_id(company_code);
end;
$$;

grant execute on function public.jp_sender_id_stanje(text)
  to authenticated, service_role;
