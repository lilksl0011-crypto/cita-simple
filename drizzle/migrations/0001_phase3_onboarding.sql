alter table public.workshop_hours add constraint workshop_hours_weekday_chk check (weekday between 0 and 6) not valid;
alter table public.workshop_hours add constraint workshop_hours_order_chk check (opens < closes) not valid;
alter table public.workshops add constraint workshops_capacity_mvp_chk check (capacity_per_slot between 1 and 10) not valid;

create or replace function public.workshop_ready(_wid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from workshops w where w.id = _wid
      and length(trim(coalesce(w.name,''))) > 0
      and length(trim(coalesce(w.address,''))) > 0
      and length(trim(coalesce(w.city,''))) > 0)
    and exists (select 1 from workshop_hours h where h.workshop_id = _wid)
    and exists (select 1 from services s where s.workshop_id = _wid and s.active and s.deleted_at is null)
$$;
revoke execute on function public.workshop_ready(uuid) from public, anon;
grant execute on function public.workshop_ready(uuid) to authenticated;

create or replace function public.guard_workshop_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') and coalesce(auth.role(),'') <> 'service_role' then
    if new.owner_id is distinct from old.owner_id or new.slug is distinct from old.slug
       or new.is_demo is distinct from old.is_demo then
      raise exception 'No puedes modificar este campo';
    end if;
    if new.active and not old.active and not public.workshop_ready(new.id) then
      raise exception 'Faltan datos para publicar: nombre, dirección, horario y al menos un servicio activo';
    end if;
  end if;
  return new;
end $$;

-- Atomic replace of the caller's own weekly hours. Workshop derived from auth.uid(), never from the client.
create or replace function public.save_my_hours(_intervals jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare _wid uuid; _i jsonb; _d int; _o time; _c time;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'workshop') then raise exception 'No autorizado'; end if;
  select id into _wid from workshops where owner_id = auth.uid() limit 1;
  if _wid is null then raise exception 'No tienes taller'; end if;
  if jsonb_typeof(_intervals) <> 'array' or jsonb_array_length(_intervals) > 70 then raise exception 'Horario no válido'; end if;
  for _i in select * from jsonb_array_elements(_intervals) loop
    _d := (_i->>'weekday')::int; _o := (_i->>'opens')::time; _c := (_i->>'closes')::time;
    if _d not between 0 and 6 or _o >= _c then raise exception 'Horario no válido: la apertura debe ser anterior al cierre'; end if;
  end loop;
  -- overlapping intervals on same day are rejected
  if exists (select 1 from jsonb_array_elements(_intervals) a, jsonb_array_elements(_intervals) b
     where a <> b and (a->>'weekday') = (b->>'weekday')
       and (a->>'opens')::time < (b->>'closes')::time and (b->>'opens')::time < (a->>'closes')::time) then
    raise exception 'Hay tramos que se solapan en el mismo día';
  end if;
  delete from workshop_hours where workshop_id = _wid;
  insert into workshop_hours(workshop_id, weekday, opens, closes)
    select _wid, (x->>'weekday')::int, (x->>'opens')::time, (x->>'closes')::time from jsonb_array_elements(_intervals) x;
  if not exists (select 1 from workshop_hours where workshop_id = _wid) then
    update workshops set active = false where id = _wid;
  end if;
end $$;
revoke execute on function public.save_my_hours(jsonb) from public, anon;
grant execute on function public.save_my_hours(jsonb) to authenticated;