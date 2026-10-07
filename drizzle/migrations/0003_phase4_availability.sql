CREATE OR REPLACE FUNCTION public.is_slot_bookable(_service_id uuid, _start timestamptz, _exclude_booking uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
declare s public.services%rowtype; w public.workshops%rowtype; _dur int; _occ_end timestamptz;
  _lt timestamp; _ld date; _ok boolean; _max int;
begin
  if _service_id is null or _start is null then return 'INVALID_INPUT'; end if;
  select * into s from public.services where id = _service_id;
  if not found or not s.active or s.deleted_at is not null then return 'SERVICE_INACTIVE'; end if;
  select * into w from public.workshops where id = s.workshop_id;
  if not found or not w.active then return 'WORKSHOP_CLOSED'; end if;
  _dur := case when s.duration_minutes > 0 then s.duration_minutes else w.slot_interval_minutes end;
  _occ_end := _start + make_interval(mins => _dur + s.buffer_minutes);
  if _start < now() + make_interval(mins => w.min_lead_time_minutes) then return 'TOO_SOON'; end if;
  _lt := _start at time zone w.timezone; _ld := _lt::date;
  if _ld > (now() at time zone w.timezone)::date + w.max_booking_horizon_days then return 'TOO_FAR'; end if;
  if exists (select 1 from public.workshop_closures c where c.workshop_id = w.id and c.date = _ld) then return 'WORKSHOP_CLOSED'; end if;
  -- service duration must end at or before the closing time of its opening interval; buffer may extend past close
  select exists (select 1 from public.workshop_hours h
    where h.workshop_id = w.id and h.weekday = extract(dow from _ld)::int
      and _lt >= _ld + h.opens
      and _lt + make_interval(mins => _dur) <= _ld + h.closes
      and (extract(epoch from (_lt - (_ld + h.opens)))::bigint % (w.slot_interval_minutes * 60)) = 0) into _ok;
  if not _ok then return 'OUT_OF_HOURS'; end if;
  if exists (select 1 from public.blocked_times b where b.workshop_id = w.id
      and b.during && tstzrange(_start, _occ_end, '[)')) then return 'BLOCKED'; end if;
  -- peak simultaneous confirmed occupancy inside [start, occ_end)
  with o as (
    select bk.start_at, bk.occupied_until from public.bookings bk
    where bk.workshop_id = w.id and bk.status = 'confirmed'
      and (_exclude_booking is null or bk.id <> _exclude_booking)
      and bk.start_at < _occ_end and bk.occupied_until > _start
  ), pts as (select _start as p union select o.start_at from o where o.start_at > _start)
  select coalesce(max((select count(*) from o where o.start_at <= pts.p and o.occupied_until > pts.p)), 0)::int
    into _max from pts;
  if _max >= w.capacity_per_slot then return 'SLOT_TAKEN'; end if;
  return null;
end $$;
COMMENT ON FUNCTION public.is_slot_bookable(uuid, timestamptz, uuid) IS
  'Single availability rule (read + future writes). Workshop derived from the service row, never from the caller. Returns NULL if bookable, else a code. Exposes no personal data. Read-only.';
REVOKE EXECUTE ON FUNCTION public.is_slot_bookable(uuid, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_slot_bookable(uuid, timestamptz, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_availability(_service_id uuid, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS TABLE(start_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
declare s public.services%rowtype; w public.workshops%rowtype; _today date; _f date; _t date; _dur int;
begin
  select * into s from public.services where id = _service_id;
  if not found then return; end if;
  select * into w from public.workshops where id = s.workshop_id;
  if not found or not w.active then return; end if;
  _dur := case when s.duration_minutes > 0 then s.duration_minutes else w.slot_interval_minutes end;
  _today := (now() at time zone w.timezone)::date;
  _f := greatest(coalesce(_from, _today), _today);
  _t := least(coalesce(_to, _today + w.max_booking_horizon_days), _today + w.max_booking_horizon_days, _f + 40);
  if _f > _t then return; end if;
  return query
    select distinct c.ts from (
      select ((d.d::date + h.opens) + make_interval(mins => k * w.slot_interval_minutes)) at time zone w.timezone as ts
      from generate_series(_f::timestamp, _t::timestamp, interval '1 day') d(d)
      join public.workshop_hours h on h.workshop_id = w.id and h.weekday = extract(dow from d.d)::int
      cross join lateral generate_series(0, floor(extract(epoch from (h.closes - h.opens)) / 60 / w.slot_interval_minutes)::int) k
    ) c
    where public.is_slot_bookable(_service_id, c.ts) is null
    order by 1;
end $$;
COMMENT ON FUNCTION public.get_availability(uuid, date, date) IS
  'Public slot list. Candidates from each local opening interval start, filtered only by is_slot_bookable. Returns timestamps only, no personal data.';
REVOKE EXECUTE ON FUNCTION public.get_availability(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_availability(uuid, date, date) TO anon, authenticated, service_role;