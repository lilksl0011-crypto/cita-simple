-- Fase 4 · cierre
-- 1) Una única convención ISO (lunes = 1 … domingo = 7) en workshop_hours.
-- 2) RPC para gestionar bloqueos parciales (blocked_times) desde el panel.
-- NO modifica is_slot_bookable() ni get_availability() (auditadas, sin cambios).

-- ── 1. weekday: quitar TODOS los checks sobre weekday (incluye el inline de 0000,
--      que admitía 1..7, y workshop_hours_weekday_chk de 0001, que admitía 0..6;
--      juntos solo permitían 1..6 y el domingo (7) fallaba).
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.workshop_hours'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%weekday%'
  loop
    execute format('alter table public.workshop_hours drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.workshop_hours drop constraint if exists workshop_hours_weekday_iso_chk;
alter table public.workshop_hours
  add constraint workshop_hours_weekday_iso_chk check (weekday between 1 and 7);

-- ── 2. Bloqueos parciales ───────────────────────────────────────────────────
-- Las horas se reciben y devuelven en HORA LOCAL del taller (timestamp sin zona);
-- la conversión a instante usa workshops.timezone, así el frontend no convierte nada.

create or replace function public.list_my_blocks()
returns table(id uuid, starts_local timestamp, ends_local timestamp, reason text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare _wid uuid; _tz text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'workshop') then
    raise exception 'No autorizado';
  end if;
  select w.id, w.timezone into _wid, _tz from public.workshops w where w.owner_id = auth.uid() limit 1;
  if _wid is null then raise exception 'No tienes taller'; end if;
  return query
    select b.id,
           (lower(b.during) at time zone _tz),
           (upper(b.during) at time zone _tz),
           b.reason
    from public.blocked_times b
    where b.workshop_id = _wid and upper(b.during) > now()
    order by lower(b.during);
end $$;

create or replace function public.save_my_block(
  _id uuid, _starts_local timestamp, _ends_local timestamp, _reason text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare _wid uuid; _tz text; _s timestamptz; _e timestamptz; _out uuid;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'workshop') then
    raise exception 'No autorizado';
  end if;
  select w.id, w.timezone into _wid, _tz from public.workshops w where w.owner_id = auth.uid() limit 1;
  if _wid is null then raise exception 'No tienes taller'; end if;

  if _starts_local is null or _ends_local is null then
    raise exception 'Bloqueo no válido: indica inicio y fin';
  end if;
  if _ends_local <= _starts_local then
    raise exception 'Bloqueo no válido: el fin debe ser posterior al inicio';
  end if;
  _s := _starts_local at time zone _tz;
  _e := _ends_local at time zone _tz;
  if _e <= now() then
    raise exception 'Bloqueo no válido: ese tramo ya ha terminado';
  end if;
  if _e - _s > interval '366 days' then
    raise exception 'Bloqueo no válido: es demasiado largo';
  end if;
  _reason := left(nullif(trim(coalesce(_reason, '')), ''), 200);

  if _id is null then
    insert into public.blocked_times(workshop_id, during, reason)
    values (_wid, tstzrange(_s, _e, '[)'), _reason)
    returning id into _out;
  else
    update public.blocked_times
       set during = tstzrange(_s, _e, '[)'), reason = _reason
     where id = _id and workshop_id = _wid
    returning id into _out;
    if _out is null then raise exception 'Bloqueo no encontrado'; end if;
  end if;
  return _out;
end $$;

create or replace function public.delete_my_block(_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare _wid uuid; _n int;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'workshop') then
    raise exception 'No autorizado';
  end if;
  select w.id into _wid from public.workshops w where w.owner_id = auth.uid() limit 1;
  if _wid is null then raise exception 'No tienes taller'; end if;
  delete from public.blocked_times where id = _id and workshop_id = _wid;
  get diagnostics _n = row_count;
  if _n = 0 then raise exception 'Bloqueo no encontrado'; end if;
end $$;

revoke execute on function public.list_my_blocks() from public, anon;
revoke execute on function public.save_my_block(uuid, timestamp, timestamp, text) from public, anon;
revoke execute on function public.delete_my_block(uuid) from public, anon;
grant execute on function public.list_my_blocks() to authenticated;
grant execute on function public.save_my_block(uuid, timestamp, timestamp, text) to authenticated;
grant execute on function public.delete_my_block(uuid) to authenticated;
