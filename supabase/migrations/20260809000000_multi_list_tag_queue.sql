create table if not exists public.lists (
  list_id text primary key,
  name text not null,
  last_synced timestamptz not null default now()
);

create table if not exists public.places (
  feature_id text primary key,
  name text not null,
  place_label text,
  address text,
  lat double precision,
  lng double precision,
  note text,
  first_seen timestamptz not null default now(),
  last_synced timestamptz not null default now()
);

create table if not exists public.list_items (
  list_id text not null references public.lists(list_id),
  feature_id text not null references public.places(feature_id),
  added_at bigint,
  deleted_at timestamptz,
  primary key (list_id, feature_id)
);

create table if not exists public.classifications (
  feature_id text primary key references public.places(feature_id),
  category text not null check (category in ('Food', 'Snack', 'Drink', 'See', 'Shop', 'Unsorted')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  reason text not null,
  classified_at timestamptz not null default now()
);

create table if not exists public.overrides (
  feature_id text primary key references public.places(feature_id),
  category text not null check (category in ('Food', 'Snack', 'Drink', 'See', 'Shop', 'Unsorted')),
  updated_at timestamptz not null default now(),
  user_id uuid not null default (select auth.uid())
);

create table if not exists public.progress (
  list_id text not null references public.lists(list_id),
  feature_id text not null references public.places(feature_id),
  user_id uuid not null default (select auth.uid()),
  done boolean not null default false,
  done_at timestamptz,
  primary key (list_id, feature_id, user_id)
);

create index if not exists list_items_feature_id_idx on public.list_items(feature_id);
create index if not exists list_items_active_idx on public.list_items(list_id, deleted_at);
create index if not exists progress_user_list_done_idx on public.progress(user_id, list_id, done);

alter table public.lists enable row level security;
alter table public.places enable row level security;
alter table public.list_items enable row level security;
alter table public.classifications enable row level security;
alter table public.overrides enable row level security;
alter table public.progress enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.lists to authenticated;
grant select, insert, update on public.places to authenticated;
grant select, insert, update on public.list_items to authenticated;
grant select, insert, update on public.classifications to authenticated;
grant select, insert, update, delete on public.overrides to authenticated;
grant select, insert, update, delete on public.progress to authenticated;

create policy "authenticated can read lists"
  on public.lists for select
  to authenticated
  using (true);

create policy "authenticated can upsert lists"
  on public.lists for insert
  to authenticated
  with check (true);

create policy "authenticated can update lists"
  on public.lists for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated can read places"
  on public.places for select
  to authenticated
  using (true);

create policy "authenticated can upsert places"
  on public.places for insert
  to authenticated
  with check (true);

create policy "authenticated can update places"
  on public.places for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated can read list items"
  on public.list_items for select
  to authenticated
  using (true);

create policy "authenticated can upsert list items"
  on public.list_items for insert
  to authenticated
  with check (true);

create policy "authenticated can update list items"
  on public.list_items for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated can read classifications"
  on public.classifications for select
  to authenticated
  using (true);

create policy "authenticated can upsert classifications"
  on public.classifications for insert
  to authenticated
  with check (true);

create policy "authenticated can update classifications"
  on public.classifications for update
  to authenticated
  using (true)
  with check (true);

create policy "users can read their own overrides"
  on public.overrides for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert their own overrides"
  on public.overrides for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can update their own overrides"
  on public.overrides for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users can delete their own overrides"
  on public.overrides for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can read their own progress"
  on public.progress for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert their own progress"
  on public.progress for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can update their own progress"
  on public.progress for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users can delete their own progress"
  on public.progress for delete
  to authenticated
  using ((select auth.uid()) = user_id);
