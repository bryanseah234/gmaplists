create or replace function public.sync_gmaplist(
  p_list_id text,
  p_list_name text,
  p_places jsonb
)
returns table (
  place_count integer,
  unique_count integer,
  removed_count integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_place_count integer := 0;
  v_unique_count integer := 0;
  v_removed_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before syncing.';
  end if;

  if p_list_id is null or length(trim(p_list_id)) = 0 then
    raise exception 'Sync payload is missing list_id.';
  end if;

  if p_places is null or jsonb_typeof(p_places) <> 'array' then
    raise exception 'Sync payload places must be a JSON array.';
  end if;

  select jsonb_array_length(p_places) into v_place_count;

  if exists (
    select 1
    from jsonb_array_elements(p_places) as raw(place)
    where nullif(raw.place->>'feature_id', '') is null
  ) then
    raise exception 'Sync payload contains places missing feature_id.';
  end if;

  insert into public.lists (list_id, name, last_synced)
  values (p_list_id, coalesce(nullif(p_list_name, ''), 'Google Maps list'), v_now)
  on conflict (list_id) do update
    set name = excluded.name,
        last_synced = excluded.last_synced;

  create temporary table temp_sync_places (
    feature_id text primary key,
    name text not null,
    place_label text,
    address text,
    lat double precision,
    lng double precision,
    note text,
    added_at bigint
  ) on commit drop;

  insert into temp_sync_places (feature_id, name, place_label, address, lat, lng, note, added_at)
  select distinct on (feature_id)
    feature_id,
    coalesce(nullif(name, ''), 'Unnamed place') as name,
    nullif(place_label, '') as place_label,
    nullif(address, '') as address,
    lat,
    lng,
    nullif(note, '') as note,
    added_at
  from (
    select
      raw.ordinality,
      raw.place->>'feature_id' as feature_id,
      raw.place->>'name' as name,
      raw.place->>'place_label' as place_label,
      raw.place->>'address' as address,
      case when jsonb_typeof(raw.place->'lat') = 'number' then (raw.place->>'lat')::double precision else null end as lat,
      case when jsonb_typeof(raw.place->'lng') = 'number' then (raw.place->>'lng')::double precision else null end as lng,
      raw.place->>'note' as note,
      case when jsonb_typeof(raw.place->'added_at') = 'number' then (raw.place->>'added_at')::bigint else null end as added_at
    from jsonb_array_elements(p_places) with ordinality as raw(place, ordinality)
  ) parsed
  where feature_id is not null and feature_id <> ''
  order by feature_id, ordinality desc;

  select count(*) into v_unique_count from temp_sync_places;

  insert into public.places (feature_id, name, place_label, address, lat, lng, note, last_synced)
  select feature_id, name, place_label, address, lat, lng, note, v_now
  from temp_sync_places
  on conflict (feature_id) do update
    set name = excluded.name,
        place_label = excluded.place_label,
        address = excluded.address,
        lat = excluded.lat,
        lng = excluded.lng,
        note = excluded.note,
        last_synced = excluded.last_synced;

  insert into public.list_items (list_id, feature_id, added_at, deleted_at)
  select p_list_id, feature_id, added_at, null
  from temp_sync_places
  on conflict (list_id, feature_id) do update
    set added_at = excluded.added_at,
        deleted_at = null;

  update public.list_items existing
  set deleted_at = v_now
  where existing.list_id = p_list_id
    and existing.deleted_at is null
    and not exists (
      select 1
      from temp_sync_places incoming
      where incoming.feature_id = existing.feature_id
    );

  get diagnostics v_removed_count = row_count;

  return query select v_place_count, v_unique_count, v_removed_count;
end;
$$;

revoke all on function public.sync_gmaplist(text, text, jsonb) from public;
grant execute on function public.sync_gmaplist(text, text, jsonb) to authenticated;
