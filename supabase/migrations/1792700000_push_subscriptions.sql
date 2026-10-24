-- Push obvestila (PWA).
--
-- 1) push_subscriptions: ena vrstica na napravo (brskalnik/telefon), ki je
--    vklopila obvestila. Piše jo samo strežnik (/api/push/subscribe) s
--    service role ključem; uporabnik lahko svoje naprave le bere in briše.
-- 2) Trigger na notifications: ob VSAKEM novem zapisu (n8n Booking, trigerji
--    Receptionist+, API …) pg_net asinhrono pokliče /api/push/notify, ki
--    pošlje push napravam prejemnika. Vstavljanja ne upočasni in ga nikoli
--    ne prekine — tudi če aplikacija ni dosegljiva.
--
-- Pred zagonom (enkrat) v SQL editorju shrani naslov in skrivnost v Vault.
-- Skrivnost mora biti enaka PUSH_WEBHOOK_SECRET v Vercelu:
--
--   select vault.create_secret('https://app.jedroplus.com/api/push/notify', 'jp_push_notify_url');
--   select vault.create_secret('<PUSH_WEBHOOK_SECRET>', 'jp_push_notify_secret');
--
-- Brez teh dveh skrivnosti trigger ne naredi ničesar (vstavljanje dela kot prej).

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 2048),
  p256dh text not null check (char_length(p256dh) <= 256),
  auth text not null check (char_length(auth) <= 64),
  platform text check (platform in ('ios', 'android', 'desktop', 'other')),
  browser text check (char_length(browser) <= 40),
  device_label text check (char_length(device_label) <= 120),
  user_agent text check (char_length(user_agent) <= 512),
  locale text check (locale in ('sl', 'en', 'de', 'hr', 'it')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0
);

create index if not exists push_subscriptions_company_idx
  on public.push_subscriptions (company_id);
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id, company_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon;
revoke insert, update on public.push_subscriptions from authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: nov zapis v notifications → /api/push/notify
-- ---------------------------------------------------------------------------

create or replace function public.jp_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
    v_url text;
    v_secret text;
begin
    if coalesce(NEW.is_archived, false) then
        return NEW;
    end if;

    select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'jp_push_notify_url' limit 1;
    select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'jp_push_notify_secret' limit 1;

    if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
        return NEW;
    end if;

    -- pg_net pošlje zahtevo po koncu transakcije; če se vstavljanje
    -- razveljavi, se tudi push ne pošlje.
    perform net.http_post(
        url := v_url,
        body := jsonb_build_object('notification_id', NEW.id),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-jedro-push-secret', v_secret
        ),
        timeout_milliseconds := 10000
    );

    return NEW;
exception when others then
    raise warning 'jp_push_on_notification: %', sqlerrm;
    return NEW;
end;
$fn$;

revoke all on function public.jp_push_on_notification() from public, anon, authenticated;

drop trigger if exists jp_push_on_notification on public.notifications;
create trigger jp_push_on_notification
    after insert on public.notifications
    for each row execute function public.jp_push_on_notification();
