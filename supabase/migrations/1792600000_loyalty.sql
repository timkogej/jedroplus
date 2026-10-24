-- One point per completed visit day. A visit is computed from Termini so
-- corrections to an appointment are reflected without stale counters.
create table if not exists public.loyalty_settings (
  company_id text primary key,
  enabled boolean not null default true,
  reward_threshold integer not null default 10 check (reward_threshold between 2 and 100),
  reward_name text not null default 'Nagrada zvestobe' check (char_length(reward_name) between 1 and 120),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_redemptions (
  id bigint generated always as identity primary key,
  company_id text not null,
  customer_id text not null,
  points integer not null check (points > 0),
  reward_name text not null,
  redeemed_by uuid,
  redeemed_at timestamptz not null default now()
);
create index if not exists loyalty_redemptions_customer_idx
  on public.loyalty_redemptions (company_id, customer_id);

alter table public.loyalty_settings enable row level security;
alter table public.loyalty_redemptions enable row level security;
revoke all on public.loyalty_settings, public.loyalty_redemptions from anon, authenticated;

create or replace function public.loyalty_visit_count(p_company_id text, p_customer_id text)
returns integer language sql stable security definer set search_path = public as $$
  select count(distinct visit_date)::integer
  from (
    select case
      when t."Datum"::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then left(t."Datum"::text, 10)::date
      when t."Datum"::text ~ '^[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4}$' then to_date(t."Datum"::text, 'DD.MM.YYYY')
      else null
    end as visit_date
    from public."Termini" t
    where t."ID podjetja" = p_company_id
      and t."ID stranke" = p_customer_id
      and t.deleted_at is null
      and t.belezi_termin is distinct from false
      and (
        lower(coalesce(t."Status"::text, '')) ~ 'complet|zakljuc|zaključ|done|končan|koncan'
      )
  ) visits
  where visit_date <= (now() at time zone 'Europe/Ljubljana')::date;
$$;

create or replace function public.loyalty_summary(p_company_id text, p_customer_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_visits integer;
  v_redeemed integer;
  v_threshold integer;
  v_reward text;
  v_enabled boolean;
begin
  select coalesce(s.enabled, true), coalesce(s.reward_threshold, 10),
         coalesce(s.reward_name, 'Nagrada zvestobe')
    into v_enabled, v_threshold, v_reward
  from (select 1) base left join public.loyalty_settings s on s.company_id = p_company_id;
  v_visits := public.loyalty_visit_count(p_company_id, p_customer_id);
  select coalesce(sum(points), 0)::integer into v_redeemed
  from public.loyalty_redemptions
  where company_id = p_company_id and customer_id = p_customer_id;
  return jsonb_build_object(
    'enabled', v_enabled, 'visits', v_visits,
    'points', greatest(0, v_visits - v_redeemed),
    'reward_threshold', v_threshold, 'reward_name', v_reward,
    'redeemed_points', v_redeemed
  );
end;
$$;

create or replace function public.loyalty_redeem(
  p_company_id text, p_customer_id text, p_redeemed_by uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_summary jsonb;
  v_threshold integer;
begin
  -- Serialize concurrent redemptions for the same customer.
  perform pg_advisory_xact_lock(hashtextextended(p_company_id || ':' || p_customer_id, 0));
  if not exists (
    select 1 from public."Stranke" s
    where s."ID Podjetja" = p_company_id and s."ID stranke" = p_customer_id
  ) then
    raise exception 'customer_not_found';
  end if;
  v_summary := public.loyalty_summary(p_company_id, p_customer_id);
  v_threshold := (v_summary->>'reward_threshold')::integer;
  if not (v_summary->>'enabled')::boolean then
    raise exception 'loyalty_disabled';
  end if;
  if (v_summary->>'points')::integer < v_threshold then
    raise exception 'insufficient_points';
  end if;
  insert into public.loyalty_redemptions
    (company_id, customer_id, points, reward_name, redeemed_by)
  values (p_company_id, p_customer_id, v_threshold, v_summary->>'reward_name', p_redeemed_by);
  return public.loyalty_summary(p_company_id, p_customer_id);
end;
$$;

revoke all on function public.loyalty_visit_count(text, text) from public, anon, authenticated;
revoke all on function public.loyalty_summary(text, text) from public, anon, authenticated;
revoke all on function public.loyalty_redeem(text, text, uuid) from public, anon, authenticated;
grant execute on function public.loyalty_visit_count(text, text) to service_role;
grant execute on function public.loyalty_summary(text, text) to service_role;
grant execute on function public.loyalty_redeem(text, text, uuid) to service_role;
