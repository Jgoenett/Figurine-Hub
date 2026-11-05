-- Run ONCE in Supabase > SQL Editor if you already ran the earlier schema.sql.
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists cover_url text,
  add column if not exists bio text;

-- let users edit only these columns (role / approved / banned stay admin-only)
grant update (name, avatar_url, cover_url, bio) on public.profiles to authenticated;

create table if not exists public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone text, street text, city text, postal text
);
alter table public.profile_private enable row level security;
drop policy if exists "own private info" on public.profile_private;
create policy "own private info" on public.profile_private for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
