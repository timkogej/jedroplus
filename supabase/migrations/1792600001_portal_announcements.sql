-- Company announcements shown to customers in the authenticated portal.
create table if not exists public.portal_announcements (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  audience text not null check (audience in ('all', 'customer')),
  recipient_email text,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 5000),
  image_path text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  email_status text not null default 'not_requested'
    check (email_status in ('not_requested', 'sending', 'sent', 'partial', 'failed', 'uncertain')),
  email_attempted_at timestamptz,
  email_result jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_announcements_recipient check (
    (audience = 'all' and recipient_email is null)
    or (audience = 'customer' and recipient_email is not null and recipient_email = lower(recipient_email))
  ),
  constraint portal_announcements_publish_date check (status <> 'published' or published_at is not null)
);
create index if not exists portal_announcements_feed_idx
  on public.portal_announcements (company_id, status, published_at desc);
create index if not exists portal_announcements_recipient_idx
  on public.portal_announcements (company_id, recipient_email, published_at desc)
  where audience = 'customer' and status = 'published';

create table if not exists public.portal_announcement_reads (
  announcement_id uuid not null references public.portal_announcements(id) on delete cascade,
  email text not null,
  read_at timestamptz not null default now(),
  primary key (announcement_id, email)
);

alter table public.portal_announcements enable row level security;
alter table public.portal_announcement_reads enable row level security;
revoke all on public.portal_announcements, public.portal_announcement_reads from anon, authenticated;

-- Images may include offers for one customer, so the bucket stays private.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-announcements', 'portal-announcements', false, 3145728,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
