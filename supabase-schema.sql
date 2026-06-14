-- Kindred Guild Supabase setup for a working demo deployment.
-- Run this entire file in Supabase SQL editor, then create a public Storage bucket named: quest-images.
-- It is safe to re-run: tables/columns/policies are created only when missing.

create extension if not exists pgcrypto;

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  reward numeric not null default 0 check (reward >= 0),
  fairy_coin_reward integer not null default 0 check (fairy_coin_reward >= 0),
  fee_percent integer not null default 10 check (fee_percent >= 0 and fee_percent <= 100),
  status text not null default 'pending',
  category text not null default 'Misc',
  posted_by uuid not null references auth.users(id) on delete cascade,
  poster_email text not null,
  poster_upi text,
  accepted_by uuid references auth.users(id) on delete set null,
  acceptor_email text,
  poster_paid boolean not null default false,
  acceptor_received boolean not null default false,
  poster_confirmed_complete boolean not null default false,
  acceptor_confirmed_complete boolean not null default false,
  dispute_raised boolean not null default false,
  completion_reported_at timestamptz,
  deadline timestamptz,
  image_url text,
  created_at timestamptz not null default now(),
  constraint quests_status_check check (status in ('pending', 'accepted', 'pending_confirmation', 'completed', 'disputed', 'cancelled'))
);

alter table public.quests add column if not exists poster_confirmed_complete boolean not null default false;
alter table public.quests add column if not exists acceptor_confirmed_complete boolean not null default false;
alter table public.quests add column if not exists dispute_raised boolean not null default false;
alter table public.quests add column if not exists completion_reported_at timestamptz;
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'quests_status_check') then
    alter table public.quests drop constraint quests_status_check;
  end if;
  alter table public.quests add constraint quests_status_check check (status in ('pending', 'accepted', 'pending_confirmation', 'completed', 'disputed', 'cancelled'));
end $$;

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  from_email text not null,
  to_email text not null,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (quest_id, from_user, to_user)
);

create table if not exists public.strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  quest_id uuid references public.quests(id) on delete set null,
  reason text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fairy_ledger (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references auth.users(id) on delete set null,
  to_user uuid references auth.users(id) on delete set null,
  quest_id uuid references public.quests(id) on delete set null,
  amount integer not null check (amount >= 0),
  type text not null,
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists one_signup_bonus_per_user
  on public.fairy_ledger (to_user)
  where type = 'signup_bonus';

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid references public.quests(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid references auth.users(id) on delete set null,
  report_type text not null default 'other',
  description text not null,
  evidence_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'resolved_poster', 'resolved_acceptor', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.fairy_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  amount integer not null check (amount > 0),
  upi_transaction_id text not null,
  evidence_url text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.quests enable row level security;
alter table public.ratings enable row level security;
alter table public.strikes enable row level security;
alter table public.comments enable row level security;
alter table public.fairy_ledger enable row level security;
alter table public.reports enable row level security;
alter table public.fairy_purchases enable row level security;
alter table public.user_profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quests' and policyname='Authenticated users can read quests') then create policy "Authenticated users can read quests" on public.quests for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quests' and policyname='Users can post quests') then create policy "Users can post quests" on public.quests for insert to authenticated with check (auth.uid() = posted_by); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quests' and policyname='Quest parties can update quests') then create policy "Quest parties can update quests" on public.quests for update to authenticated using (auth.uid() = posted_by or auth.uid() = accepted_by or accepted_by is null) with check (auth.uid() = posted_by or auth.uid() = accepted_by or accepted_by is null); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quests' and policyname='Posters can delete pending quests') then create policy "Posters can delete pending quests" on public.quests for delete to authenticated using (auth.uid() = posted_by and status = 'pending'); end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ratings' and policyname='Authenticated users can read ratings') then create policy "Authenticated users can read ratings" on public.ratings for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ratings' and policyname='Quest parties can rate') then create policy "Quest parties can rate" on public.ratings for insert to authenticated with check (auth.uid() = from_user); end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='strikes' and policyname='Authenticated users can read strikes') then create policy "Authenticated users can read strikes" on public.strikes for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='strikes' and policyname='Authenticated users can report strikes') then create policy "Authenticated users can report strikes" on public.strikes for insert to authenticated with check (true); end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='comments' and policyname='Authenticated users can read comments') then create policy "Authenticated users can read comments" on public.comments for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='comments' and policyname='Authenticated users can add own comments') then create policy "Authenticated users can add own comments" on public.comments for insert to authenticated with check (auth.uid() = user_id); end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fairy_ledger' and policyname='Authenticated users can read fairy ledger') then create policy "Authenticated users can read fairy ledger" on public.fairy_ledger for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fairy_ledger' and policyname='Authenticated users can add fairy ledger rows') then create policy "Authenticated users can add fairy ledger rows" on public.fairy_ledger for insert to authenticated with check (auth.uid() = from_user or auth.uid() = to_user); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fairy_ledger' and policyname='Authenticated users can add system ledger rows') then create policy "Authenticated users can add system ledger rows" on public.fairy_ledger for insert to authenticated with check (from_user is null); end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='Authenticated users can read reports') then create policy "Authenticated users can read reports" on public.reports for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='Authenticated users can submit reports') then create policy "Authenticated users can submit reports" on public.reports for insert to authenticated with check (auth.uid() = reporter_id); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='Authenticated users can update reports') then create policy "Authenticated users can update reports" on public.reports for update to authenticated using (true) with check (true); end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fairy_purchases' and policyname='Authenticated users can read fairy purchases') then create policy "Authenticated users can read fairy purchases" on public.fairy_purchases for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fairy_purchases' and policyname='Users can submit own fairy purchases') then create policy "Users can submit own fairy purchases" on public.fairy_purchases for insert to authenticated with check (auth.uid() = user_id); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fairy_purchases' and policyname='Authenticated users can update fairy purchases') then create policy "Authenticated users can update fairy purchases" on public.fairy_purchases for update to authenticated using (true) with check (true); end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='Authenticated users can read profiles') then create policy "Authenticated users can read profiles" on public.user_profiles for select to authenticated using (true); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='Users can upsert own profile') then create policy "Users can upsert own profile" on public.user_profiles for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id); end if;
end $$;
