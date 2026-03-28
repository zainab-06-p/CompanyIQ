-- CompanyIQ Supabase setup
-- Run in Supabase SQL Editor

create table if not exists public.user_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  company_name text not null,
  sector text,
  company_iq integer,
  rating text,
  tier text not null default 'free_score',
  source text not null default 'report',
  report_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_history_user_created
  on public.user_history(user_id, created_at desc);

alter table public.user_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_history'
      and policyname = 'history_select_own'
  ) then
    create policy "history_select_own"
      on public.user_history
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_history'
      and policyname = 'history_insert_own'
  ) then
    create policy "history_insert_own"
      on public.user_history
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;
