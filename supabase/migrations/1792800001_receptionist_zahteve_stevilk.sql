-- Receptionist+: zahteve salonov za telefonsko številko asistentke.
--
-- Številke pri Telnyxu niso takoj na voljo (advanced order, regulatorni
-- podatki), zato salon v Jedro+ odda zahtevo (država, območje, način:
-- preusmeritev obstoječe številke ali nova številka, podatki podjetja), ekipa
-- Jedro+ dobi obvestilo, številko naroči in stanje posodablja. Salon vidi
-- stanje v nastavitvah Receptionist+.
--
-- status: submitted (oddana) → ordered (naročena pri ponudniku) → active
-- (številka dodeljena; vpiše se tudi v receptionist_phone_numbers) ali
-- rejected (s pojasnilom v status_note).
--
-- Piše samo API (service role); člani podjetja svoje zahteve berejo.
--
-- Run manually via the Supabase SQL editor.

create table if not exists public.receptionist_number_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_slug text not null,
  country text not null check (country in ('SI', 'HR', 'AT', 'DE', 'IT')),
  area text,
  mode text not null check (mode in ('forward', 'new')),
  current_phone text,
  private_phone boolean not null default false,
  company_name text not null,
  company_address text not null,
  vat_number text,
  note text,
  status text not null default 'submitted'
    check (status in ('submitted', 'ordered', 'active', 'rejected')),
  status_note text,
  phone_number text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receptionist_number_requests_company_idx
  on public.receptionist_number_requests (company_id, created_at desc);

alter table public.receptionist_number_requests enable row level security;

drop policy if exists receptionist_number_requests_member_read on public.receptionist_number_requests;
create policy receptionist_number_requests_member_read
  on public.receptionist_number_requests for select
  using (exists (
    select 1 from public.company_members cm
    where cm.company_id = receptionist_number_requests.company_id
      and cm.user_id = auth.uid()
  ));

-- Rollback:
--   drop table if exists public.receptionist_number_requests;
