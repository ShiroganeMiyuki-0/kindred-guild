-- Kindred Guild Supabase setup for a working demo deployment.
-- Run this in Supabase SQL editor, then create a public Storage bucket named: quest-images.

create extension if not exists pgcrypto;

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  reward numeric not null default 0 check (reward >= 0),
  fairy_coin_reward integer not null default 0 check (fairy_coin_reward >= 0),
  fee_percent integer not null default 10 check (fee_percent >= 0 and fee_percent <= 100),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'completed')),
  category text not null default 'Misc',
  posted_by uuid not null references auth.users(id) on delete cascade,
  poster_email text not null,
  poster_upi text,
  accepted_by uuid references auth.users(id) on delete set null,
  acceptor_email text,
  poster_paid boolean not null default false,
  acceptor_received boolean not null default false,
  deadline timestamptz,
  image_url text,
  created_at timestamptz not null default now()
);

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

alter table public.quests enable row level security;
alter table public.ratings enable row level security;
alter table public.strikes enable row level security;
alter table public.comments enable row level security;
alter table public.fairy_ledger enable row level security;

create policy "Authenticated users can read quests" on public.quests for select to authenticated using (true);
create policy "Users can post quests" on public.quests for insert to authenticated with check (auth.uid() = posted_by);
create policy "Quest parties can update quests" on public.quests for update to authenticated using (auth.uid() = posted_by or auth.uid() = accepted_by or accepted_by is null) with check (auth.uid() = posted_by or auth.uid() = accepted_by or accepted_by is null);
create policy "Posters can delete pending quests" on public.quests for delete to authenticated using (auth.uid() = posted_by and status = 'pending');

create policy "Authenticated users can read ratings" on public.ratings for select to authenticated using (true);
create policy "Quest parties can rate" on public.ratings for insert to authenticated with check (auth.uid() = from_user);

create policy "Authenticated users can read strikes" on public.strikes for select to authenticated using (true);
create policy "Authenticated users can report strikes" on public.strikes for insert to authenticated with check (true);

create policy "Authenticated users can read comments" on public.comments for select to authenticated using (true);
create policy "Authenticated users can add own comments" on public.comments for insert to authenticated with check (auth.uid() = user_id);

create policy "Authenticated users can read fairy ledger" on public.fairy_ledger for select to authenticated using (true);
create policy "Authenticated users can add fairy ledger rows" on public.fairy_ledger for insert to authenticated with check (auth.uid() = from_user or auth.uid() = to_user);
