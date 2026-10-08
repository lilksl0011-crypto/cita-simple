-- ════════════════════════════════════════════════════════════════════════════
-- CitaMotor · Fase 4 · Pruebas reproducibles del motor de disponibilidad
--
-- CÓMO EJECUTAR: pega TODO el archivo en el SQL Editor de Supabase y pulsa Run.
--   · Requiere haber aplicado antes drizzle/migrations/0005_phase4_close.sql
--     (si no, la primera prueba falla y el script se detiene).
--   · Crea talleres de prueba (slug p4-test-*, UUID ffffffff-ffff-4fff-8fff-…),
--     ejecuta las pruebas y los BORRA al terminar. No toca los talleres DEMO
--     (solo los lee en la sección final).
--   · Es repetible: las fechas se calculan a partir de hoy (zona Europe/Madrid)
--     y los cambios de hora (DST) se calculan como el próximo último domingo
--     de octubre / marzo.
--   · La última sentencia devuelve una fila por prueba: PASS / FAIL / INFO.
--     fallos_totales debe ser 0.
-- ════════════════════════════════════════════════════════════════════════════

drop table if exists pg_temp._p4;
create temp table _p4 (n serial primary key, test text, expected text, actual text, ok boolean);

-- ── Utilidades (solo viven en esta sesión) ──────────────────────────────────
create or replace function pg_temp.p4_id(_x text) returns uuid language sql immutable as
$$ select ('ffffffff-ffff-4fff-8fff-' || lpad(_x, 12, '0'))::uuid $$;

create or replace function pg_temp.p4_ts(_d date, _t time, _tz text default 'Europe/Madrid')
returns timestamptz language sql stable as $$ select ((_d + _t) at time zone _tz) $$;

create or replace function pg_temp.p4_chk(_test text, _expected text, _actual text)
returns void language plpgsql as $$
begin
  insert into _p4(test, expected, actual, ok)
  values (_test, _expected, _actual, _expected is not distinct from _actual);
end $$;

create or replace function pg_temp.p4_info(_test text, _actual text)
returns void language plpgsql as $$
begin
  insert into _p4(test, expected, actual, ok) values (_test, '(informativo)', _actual, null);
end $$;

-- 'OK' si is_slot_bookable devuelve NULL; si no, el código de rechazo.
create or replace function pg_temp.p4_slot(_sid uuid, _d date, _t time,
  _tz text default 'Europe/Madrid', _excl uuid default null)
returns text language sql stable as
$$ select coalesce(public.is_slot_bookable(_sid, pg_temp.p4_ts(_d, _t, _tz), _excl), 'OK') $$;

create or replace function pg_temp.p4_count(_sid uuid, _from date, _to date)
returns int language sql stable as
$$ select count(*)::int from public.get_availability(_sid, _from, _to) $$;

-- Coherencia: get_availability == barrido de TODA la rejilla de 15 min del día
-- con is_slot_bookable (fuente única de verdad). Devuelve nº de diferencias (0 = coherente).
create or replace function pg_temp.p4_diff(_sid uuid, _d date, _tz text default 'Europe/Madrid')
returns int language sql stable as $$
  with brute as (
    select g as ts from (
      select ((_d::timestamp + k * interval '15 minutes') at time zone _tz) as g
      from generate_series(0, 95) k) x
    where public.is_slot_bookable(_sid, g) is null
  ), api as (select start_at as ts from public.get_availability(_sid, _d, _d))
  select ((select count(*) from (select ts from brute except select ts from api) a)
        + (select count(*) from (select ts from api except select ts from brute) b))::int
$$;

create or replace function pg_temp.p4_booking(_wid uuid, _sid uuid, _status public.booking_status,
  _s timestamptz, _mins int, _buf int)
returns uuid language plpgsql as $$
declare _id uuid;
begin
  insert into public.bookings(workshop_id, service_id, status, start_at, end_at, occupied_until,
    customer_name, customer_phone, customer_email, service_name_snapshot,
    duration_snapshot_minutes, buffer_snapshot_minutes, price_type_snapshot)
  values (_wid, _sid, _status, _s, _s + make_interval(mins => _mins),
    _s + make_interval(mins => _mins + _buf),
    'TEST P4', '600000000', 'p4@example.invalid', 'TEST', _mins, _buf, 'quote')
  returning id into _id;
  return _id;
end $$;

create or replace function pg_temp.p4_clean() returns void language plpgsql as $$
declare _ids uuid[] := array[pg_temp.p4_id('a0'), pg_temp.p4_id('b0'), pg_temp.p4_id('c0'),
  pg_temp.p4_id('d0'), pg_temp.p4_id('e0'), pg_temp.p4_id('f0'), pg_temp.p4_id('g0'), pg_temp.p4_id('ee')];
begin
  delete from public.bookings where workshop_id = any(_ids);
  delete from public.workshops where id = any(_ids);   -- cascada: servicios, horarios, cierres, bloqueos
end $$;

create or replace function pg_temp.p4_last_sunday(_y int, _m int) returns date language sql immutable as $$
  select (d - extract(dow from d)::int)
  from (select ((make_date(_y, _m, 1) + interval '1 month' - interval '1 day')::date) d) x
$$;

-- ── Pruebas ─────────────────────────────────────────────────────────────────
do $test$
declare
  _tz text := 'Europe/Madrid';
  _today date := (now() at time zone 'Europe/Madrid')::date;
  _mon date; _tue date; _wed date; _thu date; _sat date; _sun date;
  _y int; _fall date; _spring date; _eom date; _dec31 date;
  _sun_ok boolean; _bad_ok boolean; _k record; _r record;
  _bk1 uuid; _sum int; _cnt int; _txt text;
begin
  _mon := _today + (8 - extract(isodow from _today)::int) + 7;   -- lunes ≥ 8 días en el futuro
  _tue := _mon + 1; _wed := _mon + 2; _thu := _mon + 3; _sat := _mon - 2; _sun := _mon - 1;

  perform pg_temp.p4_clean();

  -- ░ Talleres de prueba ░
  -- A: cap 1, intervalo 30 · B: cap 2, intervalo 60 · C: cap 1, intervalo 15
  -- D: antelación 2 días, horizonte 30 · E: zona Atlantic/Canary · F: todos los días 08–12
  -- G: franja 01–04 (hueco DST) · ee: taller inactivo
  insert into public.workshops(id, slug, name, capacity_per_slot, slot_interval_minutes,
    min_lead_time_minutes, max_booking_horizon_days, timezone, active, onboarding_step) values
   (pg_temp.p4_id('a0'), 'p4-test-a',  'P4 A', 1, 30, 0,    2000, 'Europe/Madrid',   true,  5),
   (pg_temp.p4_id('b0'), 'p4-test-b',  'P4 B', 2, 60, 0,    2000, 'Europe/Madrid',   true,  5),
   (pg_temp.p4_id('c0'), 'p4-test-c',  'P4 C', 1, 15, 0,    2000, 'Europe/Madrid',   true,  5),
   (pg_temp.p4_id('d0'), 'p4-test-d',  'P4 D', 1, 30, 2880, 30,   'Europe/Madrid',   true,  5),
   (pg_temp.p4_id('e0'), 'p4-test-e',  'P4 E', 1, 60, 0,    2000, 'Atlantic/Canary', true,  5),
   (pg_temp.p4_id('f0'), 'p4-test-f',  'P4 F', 1, 60, 0,    2000, 'Europe/Madrid',   true,  5),
   (pg_temp.p4_id('g0'), 'p4-test-g',  'P4 G', 1, 60, 0,    2000, 'Europe/Madrid',   true,  5),
   (pg_temp.p4_id('ee'), 'p4-test-ee', 'P4 inactivo', 1, 30, 0, 2000, 'Europe/Madrid', false, 5);

  -- ░ 0. Domingo / convención ISO (migración 0005) ░
  _sun_ok := false;
  begin
    insert into public.workshop_hours(workshop_id, weekday, opens, closes)
    values (pg_temp.p4_id('a0'), 7, '10:00', '14:00');
    _sun_ok := true;
  exception when check_violation then _sun_ok := false;
  end;
  perform pg_temp.p4_chk('0.1 guardar domingo (weekday=7) funciona', 'true', _sun_ok::text);
  if not _sun_ok then
    perform pg_temp.p4_info('ABORTADO: aplica primero drizzle/migrations/0005_phase4_close.sql', 'check de weekday sigue rechazando 7');
    perform pg_temp.p4_clean();
    return;
  end if;
  _bad_ok := false;
  begin
    insert into public.workshop_hours(workshop_id, weekday, opens, closes) values (pg_temp.p4_id('a0'), 0, '10:00', '14:00');
  exception when check_violation then _bad_ok := true;
  end;
  perform pg_temp.p4_chk('0.2 weekday=0 rechazado (una única convención ISO)', 'true', _bad_ok::text);
  _bad_ok := false;
  begin
    insert into public.workshop_hours(workshop_id, weekday, opens, closes) values (pg_temp.p4_id('a0'), 8, '10:00', '14:00');
  exception when check_violation then _bad_ok := true;
  end;
  perform pg_temp.p4_chk('0.3 weekday=8 rechazado', 'true', _bad_ok::text);
  delete from public.workshop_hours where workshop_id = pg_temp.p4_id('a0') and weekday in (0, 8);

  -- ░ Horarios ░
  insert into public.workshop_hours(workshop_id, weekday, opens, closes)
  select pg_temp.p4_id('a0'), d, t.o, t.c
  from generate_series(1, 5) d, (values ('08:00'::time, '13:00'::time), ('15:00'::time, '19:00'::time)) t(o, c);
  insert into public.workshop_hours(workshop_id, weekday, opens, closes)
  select pg_temp.p4_id('b0'), d, '09:00'::time, '14:00'::time from generate_series(1, 5) d;
  insert into public.workshop_hours(workshop_id, weekday, opens, closes)
  values (pg_temp.p4_id('c0'), 1, '09:00', '12:00'),
         (pg_temp.p4_id('e0'), 1, '09:00', '11:00'),
         (pg_temp.p4_id('ee'), 1, '09:00', '12:00');
  insert into public.workshop_hours(workshop_id, weekday, opens, closes)
  select pg_temp.p4_id('d0'), d, '08:00'::time, '20:00'::time from generate_series(1, 7) d;
  insert into public.workshop_hours(workshop_id, weekday, opens, closes)
  select pg_temp.p4_id('f0'), d, '08:00'::time, '12:00'::time from generate_series(1, 7) d;
  insert into public.workshop_hours(workshop_id, weekday, opens, closes)
  select pg_temp.p4_id('g0'), d, '01:00'::time, '04:00'::time from generate_series(1, 7) d;

  -- ░ Servicios ░ (duración, buffer, modo, activo)
  insert into public.services(id, workshop_id, category, name, duration_minutes, buffer_minutes, booking_mode, active, deleted_at) values
   (pg_temp.p4_id('a1'), pg_temp.p4_id('a0'), 'other', 'A 60',        60, 0,  'instant', true,  null),
   (pg_temp.p4_id('a2'), pg_temp.p4_id('a0'), 'other', 'A 60+buf15',  60, 15, 'instant', true,  null),
   (pg_temp.p4_id('a3'), pg_temp.p4_id('a0'), 'other', 'A 45+buf15',  45, 15, 'instant', true,  null),
   (pg_temp.p4_id('a4'), pg_temp.p4_id('a0'), 'other', 'A 90',        90, 0,  'instant', true,  null),
   (pg_temp.p4_id('a5'), pg_temp.p4_id('a0'), 'other', 'A 0 (solicitud)', 0, 0, 'request', true, null),
   (pg_temp.p4_id('a6'), pg_temp.p4_id('a0'), 'other', 'A inactivo',  60, 0,  'instant', false, null),
   (pg_temp.p4_id('a7'), pg_temp.p4_id('a0'), 'other', 'A borrado',   60, 0,  'instant', true,  now()),
   (pg_temp.p4_id('b1'), pg_temp.p4_id('b0'), 'other', 'B 60',        60, 0,  'instant', true,  null),
   (pg_temp.p4_id('b2'), pg_temp.p4_id('b0'), 'other', 'B 120',      120, 0,  'instant', true,  null),
   (pg_temp.p4_id('c1'), pg_temp.p4_id('c0'), 'other', 'C 30',        30, 0,  'instant', true,  null),
   (pg_temp.p4_id('d1'), pg_temp.p4_id('d0'), 'other', 'D 60',        60, 0,  'instant', true,  null),
   (pg_temp.p4_id('e1'), pg_temp.p4_id('e0'), 'other', 'E 60',        60, 0,  'instant', true,  null),
   (pg_temp.p4_id('f1'), pg_temp.p4_id('f0'), 'other', 'F 60',        60, 0,  'instant', true,  null),
   (pg_temp.p4_id('g1'), pg_temp.p4_id('g0'), 'other', 'G 60',        60, 0,  'instant', true,  null),
   (pg_temp.p4_id('ee1'), pg_temp.p4_id('ee'), 'other', 'EE 60',      60, 0,  'instant', true,  null);

  -- Cierre completo (miércoles) y bloqueo parcial (martes 10:00–11:00 hora local)
  insert into public.workshop_closures(workshop_id, date, reason) values (pg_temp.p4_id('a0'), _wed, 'P4 cierre');
  insert into public.blocked_times(workshop_id, during, reason)
  values (pg_temp.p4_id('a0'), tstzrange(pg_temp.p4_ts(_tue, '10:00'), pg_temp.p4_ts(_tue, '11:00'), '[)'), 'P4 bloqueo');

  -- ░ 1. Horarios, franjas partidas, duración exacta, buffer, intervalo, servicios inactivos ░
  for _k in
    select * from (values
      ('1.01 jue 08:00 (60 min) dentro de franja', pg_temp.p4_id('a1'), _thu, '08:00'::time, 'OK'),
      ('1.02 jue 12:00 termina EXACTAMENTE al cierre (13:00): válido', pg_temp.p4_id('a1'), _thu, '12:00', 'OK'),
      ('1.03 jue 12:30 supera el cierre (13:30): inválido', pg_temp.p4_id('a1'), _thu, '12:30', 'OUT_OF_HOURS'),
      ('1.04 jue 13:00 fuera de franja', pg_temp.p4_id('a1'), _thu, '13:00', 'OUT_OF_HOURS'),
      ('1.05 jue 14:00 hueco entre franjas partidas', pg_temp.p4_id('a1'), _thu, '14:00', 'OUT_OF_HOURS'),
      ('1.06 jue 15:00 inicio de segunda franja', pg_temp.p4_id('a1'), _thu, '15:00', 'OK'),
      ('1.07 jue 18:00 termina exactamente a las 19:00: válido', pg_temp.p4_id('a1'), _thu, '18:00', 'OK'),
      ('1.08 jue 18:30 supera el cierre de tarde', pg_temp.p4_id('a1'), _thu, '18:30', 'OUT_OF_HOURS'),
      ('1.09 jue 07:30 antes de abrir', pg_temp.p4_id('a1'), _thu, '07:30', 'OUT_OF_HOURS'),
      ('1.10 jue 08:15 no alineada con intervalo de 30 min', pg_temp.p4_id('a1'), _thu, '08:15', 'OUT_OF_HOURS'),
      ('1.11 buffer 15 DESPUÉS del cierre permitido (18:00–19:00 + 15)', pg_temp.p4_id('a2'), _thu, '18:00', 'OK'),
      ('1.12 duración 45 + buffer 15: 12:00 termina 12:45 ≤ 13:00', pg_temp.p4_id('a3'), _thu, '12:00', 'OK'),
      ('1.13 duración 45: 12:30 termina 13:15 > 13:00', pg_temp.p4_id('a3'), _thu, '12:30', 'OUT_OF_HOURS'),
      ('1.14 duración 90: 11:30 termina exactamente 13:00', pg_temp.p4_id('a4'), _thu, '11:30', 'OK'),
      ('1.15 duración 90: 12:00 supera el cierre', pg_temp.p4_id('a4'), _thu, '12:00', 'OUT_OF_HOURS'),
      ('1.16 duración 0 (usa el intervalo 30): 12:30 válido', pg_temp.p4_id('a5'), _thu, '12:30', 'OK'),
      ('1.17 duración 0 (usa el intervalo 30): 13:00 fuera', pg_temp.p4_id('a5'), _thu, '13:00', 'OUT_OF_HOURS'),
      ('1.18 servicio inactivo', pg_temp.p4_id('a6'), _thu, '10:00', 'SERVICE_INACTIVE'),
      ('1.19 servicio borrado (deleted_at)', pg_temp.p4_id('a7'), _thu, '10:00', 'SERVICE_INACTIVE'),
      ('1.20 sábado sin horario', pg_temp.p4_id('a1'), _sat, '10:00', 'OUT_OF_HOURS'),
      ('1.21 taller inactivo', pg_temp.p4_id('ee1'), _mon, '09:00', 'WORKSHOP_CLOSED')
    ) as t(label, sid, d, tm, exp)
  loop
    perform pg_temp.p4_chk(_k.label, _k.exp, pg_temp.p4_slot(_k.sid, _k.d, _k.tm));
  end loop;

  -- ░ 2. Domingo (weekday = 7): leer + el motor lo interpreta ░
  perform pg_temp.p4_chk('2.01 leer domingo: 1 franja guardada con weekday=7', '1',
    (select count(*)::text from public.workshop_hours where workshop_id = pg_temp.p4_id('a0') and weekday = 7));
  for _k in
    select * from (values
      ('2.02 domingo 10:00 válido', pg_temp.p4_id('a1'), _sun, '10:00'::time, 'OK'),
      ('2.03 domingo 13:00 termina exactamente a las 14:00', pg_temp.p4_id('a1'), _sun, '13:00', 'OK'),
      ('2.04 domingo 13:30 supera el cierre', pg_temp.p4_id('a1'), _sun, '13:30', 'OUT_OF_HOURS'),
      ('2.05 domingo 09:30 antes de abrir', pg_temp.p4_id('a1'), _sun, '09:30', 'OUT_OF_HOURS')
    ) as t(label, sid, d, tm, exp)
  loop
    perform pg_temp.p4_chk(_k.label, _k.exp, pg_temp.p4_slot(_k.sid, _k.d, _k.tm));
  end loop;
  perform pg_temp.p4_chk('2.06 get_availability domingo (60 min, 10–14): 7 huecos', '7', pg_temp.p4_count(pg_temp.p4_id('a1'), _sun, _sun)::text);

  -- ░ 3. Cierre completo y bloqueo parcial ░
  perform pg_temp.p4_chk('3.01 cierre completo (mié) 09:00', 'WORKSHOP_CLOSED', pg_temp.p4_slot(pg_temp.p4_id('a1'), _wed, '09:00'));
  perform pg_temp.p4_chk('3.02 cierre completo: get_availability = 0 huecos', '0', pg_temp.p4_count(pg_temp.p4_id('a1'), _wed, _wed)::text);
  for _k in
    select * from (values
      ('3.03 bloqueo 10–11: 09:00 (acaba justo a las 10:00) válido', pg_temp.p4_id('a1'), _tue, '09:00'::time, 'OK'),
      ('3.04 bloqueo 10–11: 09:30 solapa', pg_temp.p4_id('a1'), _tue, '09:30', 'BLOCKED'),
      ('3.05 bloqueo 10–11: 10:00 bloqueado', pg_temp.p4_id('a1'), _tue, '10:00', 'BLOCKED'),
      ('3.06 bloqueo 10–11: 10:30 solapa', pg_temp.p4_id('a1'), _tue, '10:30', 'BLOCKED'),
      ('3.07 bloqueo 10–11: 11:00 (empieza justo al acabar) válido', pg_temp.p4_id('a1'), _tue, '11:00', 'OK'),
      ('3.08 bloqueo: el buffer también cuenta (09:00 + 60 + 15 solapa)', pg_temp.p4_id('a2'), _tue, '09:00', 'BLOCKED')
    ) as t(label, sid, d, tm, exp)
  loop
    perform pg_temp.p4_chk(_k.label, _k.exp, pg_temp.p4_slot(_k.sid, _k.d, _k.tm));
  end loop;
  perform pg_temp.p4_chk('3.09 get_availability con bloqueo (mar): 13 huecos', '13', pg_temp.p4_count(pg_temp.p4_id('a1'), _tue, _tue)::text);

  -- ░ 4. Duraciones distintas: nº de huecos de un día libre (jue) ░
  perform pg_temp.p4_chk('4.01 jue 60 min: 16 huecos', '16', pg_temp.p4_count(pg_temp.p4_id('a1'), _thu, _thu)::text);
  perform pg_temp.p4_chk('4.02 jue 90 min: 14 huecos', '14', pg_temp.p4_count(pg_temp.p4_id('a4'), _thu, _thu)::text);
  perform pg_temp.p4_chk('4.03 jue 45 min + buffer 15: 16 huecos', '16', pg_temp.p4_count(pg_temp.p4_id('a3'), _thu, _thu)::text);
  perform pg_temp.p4_chk('4.04 jue 60 min + buffer 15 (buffer tras cierre): 16 huecos', '16', pg_temp.p4_count(pg_temp.p4_id('a2'), _thu, _thu)::text);

  -- ░ 5. Capacidad 1 (taller A) con reservas reales ░
  _bk1 := pg_temp.p4_booking(pg_temp.p4_id('a0'), pg_temp.p4_id('a1'), 'confirmed', pg_temp.p4_ts(_mon, '09:00'), 60, 0);
  perform pg_temp.p4_booking(pg_temp.p4_id('a0'), pg_temp.p4_id('a1'), 'pending',   pg_temp.p4_ts(_mon, '11:00'), 60, 0);
  perform pg_temp.p4_booking(pg_temp.p4_id('a0'), pg_temp.p4_id('a1'), 'confirmed', pg_temp.p4_ts(_mon, '16:00'), 60, 15);
  for _k in
    select * from (values
      ('5.01 cap 1: 08:00 (acaba justo cuando empieza la reserva de 09:00) válido', pg_temp.p4_id('a1'), _mon, '08:00'::time, 'OK'),
      ('5.02 cap 1: 08:30 solapa con la reserva 09:00', pg_temp.p4_id('a1'), _mon, '08:30', 'SLOT_TAKEN'),
      ('5.03 cap 1: 09:00 ocupado', pg_temp.p4_id('a1'), _mon, '09:00', 'SLOT_TAKEN'),
      ('5.04 cap 1: 09:30 solapa', pg_temp.p4_id('a1'), _mon, '09:30', 'SLOT_TAKEN'),
      ('5.05 cap 1: 10:00 (empieza justo al acabar la reserva) válido', pg_temp.p4_id('a1'), _mon, '10:00', 'OK'),
      ('5.06 PENDING no consume capacidad: 11:00 válido', pg_temp.p4_id('a1'), _mon, '11:00', 'OK'),
      ('5.07 cap 1: 15:00 (acaba justo cuando empieza la de 16:00) válido', pg_temp.p4_id('a1'), _mon, '15:00', 'OK'),
      ('5.08 cap 1: 15:30 solapa con la de 16:00', pg_temp.p4_id('a1'), _mon, '15:30', 'SLOT_TAKEN'),
      ('5.09 buffer de la reserva existente (16:00–17:00 + 15): 17:00 ocupado', pg_temp.p4_id('a1'), _mon, '17:00', 'SLOT_TAKEN'),
      ('5.10 tras el buffer existente: 17:30 válido', pg_temp.p4_id('a1'), _mon, '17:30', 'OK'),
      ('5.11 buffer del NUEVO servicio choca con la reserva de 16:00', pg_temp.p4_id('a2'), _mon, '15:00', 'SLOT_TAKEN')
    ) as t(label, sid, d, tm, exp)
  loop
    perform pg_temp.p4_chk(_k.label, _k.exp, pg_temp.p4_slot(_k.sid, _k.d, _k.tm));
  end loop;
  perform pg_temp.p4_chk('5.12 exclude_booking (reprogramar): 09:00 libre si se excluye su propia reserva', 'OK',
    pg_temp.p4_slot(pg_temp.p4_id('a1'), _mon, '09:00', 'Europe/Madrid', _bk1));
  perform pg_temp.p4_chk('5.13 get_availability lunes con reservas: 9 huecos', '9', pg_temp.p4_count(pg_temp.p4_id('a1'), _mon, _mon)::text);

  -- ░ 6. Capacidad 2 (taller B) ░
  perform pg_temp.p4_chk('6.01 cap 2: 09:30 no alineada (intervalo 60)', 'OUT_OF_HOURS', pg_temp.p4_slot(pg_temp.p4_id('b1'), _mon, '09:30'));
  perform pg_temp.p4_booking(pg_temp.p4_id('b0'), pg_temp.p4_id('b1'), 'confirmed', pg_temp.p4_ts(_mon, '11:00'), 60, 0);
  perform pg_temp.p4_chk('6.02 cap 2 con 1 ocupación: la segunda simultánea es válida', 'OK', pg_temp.p4_slot(pg_temp.p4_id('b1'), _mon, '11:00'));
  perform pg_temp.p4_booking(pg_temp.p4_id('b0'), pg_temp.p4_id('b1'), 'confirmed', pg_temp.p4_ts(_mon, '11:00'), 60, 0);
  perform pg_temp.p4_chk('6.03 cap 2 con 2 ocupaciones: la TERCERA es inválida', 'SLOT_TAKEN', pg_temp.p4_slot(pg_temp.p4_id('b1'), _mon, '11:00'));
  perform pg_temp.p4_chk('6.04 cap 2: la hora anterior sigue libre', 'OK', pg_temp.p4_slot(pg_temp.p4_id('b1'), _mon, '10:00'));
  perform pg_temp.p4_chk('6.05 cap 2: la hora posterior sigue libre', 'OK', pg_temp.p4_slot(pg_temp.p4_id('b1'), _mon, '12:00'));
  perform pg_temp.p4_booking(pg_temp.p4_id('b0'), pg_temp.p4_id('b1'), 'pending', pg_temp.p4_ts(_mon, '12:00'), 60, 0);
  perform pg_temp.p4_booking(pg_temp.p4_id('b0'), pg_temp.p4_id('b1'), 'pending', pg_temp.p4_ts(_mon, '12:00'), 60, 0);
  perform pg_temp.p4_chk('6.06 cap 2: dos PENDING no consumen capacidad', 'OK', pg_temp.p4_slot(pg_temp.p4_id('b1'), _mon, '12:00'));

  -- Pico de ocupación (no suma): reservas 09–10 y 10–11 NO son simultáneas
  perform pg_temp.p4_booking(pg_temp.p4_id('b0'), pg_temp.p4_id('b1'), 'confirmed', pg_temp.p4_ts(_tue, '09:00'), 60, 0);
  perform pg_temp.p4_booking(pg_temp.p4_id('b0'), pg_temp.p4_id('b1'), 'confirmed', pg_temp.p4_ts(_tue, '10:00'), 60, 0);
  perform pg_temp.p4_chk('6.07 cap 2: servicio de 120 min sobre 2 reservas consecutivas (pico 1): válido', 'OK', pg_temp.p4_slot(pg_temp.p4_id('b2'), _tue, '09:00'));
  perform pg_temp.p4_booking(pg_temp.p4_id('b0'), pg_temp.p4_id('b1'), 'confirmed', pg_temp.p4_ts(_tue, '10:00'), 60, 0);
  perform pg_temp.p4_chk('6.08 cap 2: ahora el pico a las 10:00 es 2: servicio de 120 min inválido', 'SLOT_TAKEN', pg_temp.p4_slot(pg_temp.p4_id('b2'), _tue, '09:00'));
  perform pg_temp.p4_chk('6.09 cap 2: 10:00 con 2 ocupaciones simultáneas: inválido', 'SLOT_TAKEN', pg_temp.p4_slot(pg_temp.p4_id('b1'), _tue, '10:00'));
  perform pg_temp.p4_chk('6.10 cap 2: 09:00 con 1 sola ocupación: válido', 'OK', pg_temp.p4_slot(pg_temp.p4_id('b1'), _tue, '09:00'));
  -- Día libre (mié)
  perform pg_temp.p4_chk('6.11 cap 2 mié libre, 60 min (09–14): 5 huecos', '5', pg_temp.p4_count(pg_temp.p4_id('b1'), _wed, _wed)::text);
  perform pg_temp.p4_chk('6.12 cap 2 mié libre, 120 min: 4 huecos', '4', pg_temp.p4_count(pg_temp.p4_id('b2'), _wed, _wed)::text);
  perform pg_temp.p4_chk('6.13 120 min a las 12:00 termina exactamente 14:00', 'OK', pg_temp.p4_slot(pg_temp.p4_id('b2'), _wed, '12:00'));
  perform pg_temp.p4_chk('6.14 120 min a las 13:00 supera el cierre', 'OUT_OF_HOURS', pg_temp.p4_slot(pg_temp.p4_id('b2'), _wed, '13:00'));

  -- ░ 7. Intervalo de 15 min (taller C) ░
  perform pg_temp.p4_chk('7.01 intervalo 15: 09:15 válido', 'OK', pg_temp.p4_slot(pg_temp.p4_id('c1'), _mon, '09:15'));
  perform pg_temp.p4_chk('7.02 intervalo 15: 09:10 no alineada', 'OUT_OF_HOURS', pg_temp.p4_slot(pg_temp.p4_id('c1'), _mon, '09:10'));
  perform pg_temp.p4_chk('7.03 intervalo 15: 11:30 termina exactamente 12:00', 'OK', pg_temp.p4_slot(pg_temp.p4_id('c1'), _mon, '11:30'));
  perform pg_temp.p4_chk('7.04 intervalo 15: 11:45 supera el cierre', 'OUT_OF_HOURS', pg_temp.p4_slot(pg_temp.p4_id('c1'), _mon, '11:45'));
  perform pg_temp.p4_chk('7.05 intervalo 15, 30 min, 09–12: 11 huecos', '11', pg_temp.p4_count(pg_temp.p4_id('c1'), _mon, _mon)::text);

  -- ░ 8. Antelación mínima, horizonte y horas pasadas (taller D: antelación 2 días, horizonte 30) ░
  for _k in
    select * from (values
      ('8.01 hora pasada (ayer 10:00)', pg_temp.p4_id('d1'), _today - 1, '10:00'::time, 'TOO_SOON'),
      ('8.02 demasiado pronto (mañana 19:00 con antelación de 2 días)', pg_temp.p4_id('d1'), _today + 1, '19:00', 'TOO_SOON'),
      ('8.03 pasada la antelación (hoy+3 08:00)', pg_temp.p4_id('d1'), _today + 3, '08:00', 'OK'),
      ('8.04 último día del horizonte (hoy+30 10:00)', pg_temp.p4_id('d1'), _today + 30, '10:00', 'OK'),
      ('8.05 demasiado lejos (hoy+31 10:00)', pg_temp.p4_id('d1'), _today + 31, '10:00', 'TOO_FAR')
    ) as t(label, sid, d, tm, exp)
  loop
    perform pg_temp.p4_chk(_k.label, _k.exp, pg_temp.p4_slot(_k.sid, _k.d, _k.tm));
  end loop;
  perform pg_temp.p4_chk('8.06 get_availability no devuelve nada más allá del horizonte', '0',
    pg_temp.p4_count(pg_temp.p4_id('d1'), _today + 31, _today + 40)::text);
  perform pg_temp.p4_chk('8.07 get_availability no devuelve horas dentro de la antelación', '0',
    (select count(*)::text from public.get_availability(pg_temp.p4_id('d1'), _today, _today + 30) a
      where a.start_at < now() + interval '2 days'));
  perform pg_temp.p4_chk('8.08 get_availability sí devuelve horas dentro de la ventana', 'true',
    (pg_temp.p4_count(pg_temp.p4_id('d1'), _today + 3, _today + 3) > 0)::text);

  -- ░ 9. Zona horaria del taller (E = Atlantic/Canary, 1 h menos que Madrid todo el año) ░
  perform pg_temp.p4_chk('9.01 09:00 hora de Canarias (apertura): válido', 'OK', pg_temp.p4_slot(pg_temp.p4_id('e1'), _mon, '09:00', 'Atlantic/Canary'));
  perform pg_temp.p4_chk('9.02 el MISMO reloj 09:00 en Madrid = 08:00 en Canarias: antes de abrir', 'OUT_OF_HOURS', pg_temp.p4_slot(pg_temp.p4_id('e1'), _mon, '09:00', 'Europe/Madrid'));
  perform pg_temp.p4_chk('9.03 10:00 Canarias termina exactamente 11:00', 'OK', pg_temp.p4_slot(pg_temp.p4_id('e1'), _mon, '10:00', 'Atlantic/Canary'));
  perform pg_temp.p4_chk('9.04 11:00 Canarias supera el cierre', 'OUT_OF_HOURS', pg_temp.p4_slot(pg_temp.p4_id('e1'), _mon, '11:00', 'Atlantic/Canary'));

  -- ░ 10. Cambio de mes y de año (taller F: todos los días 08–12, 60 min) ░
  _eom := ((date_trunc('month', (_today + 45)::timestamp) + interval '1 month' - interval '1 day')::date);
  perform pg_temp.p4_chk('10.01 último día de mes 08:00 (' || _eom || ')', 'OK', pg_temp.p4_slot(pg_temp.p4_id('f1'), _eom, '08:00'));
  perform pg_temp.p4_chk('10.02 primer día del mes siguiente 08:00', 'OK', pg_temp.p4_slot(pg_temp.p4_id('f1'), _eom + 1, '08:00'));
  perform pg_temp.p4_chk('10.03 get_availability a caballo de dos meses: 4 + 4 huecos', '8', pg_temp.p4_count(pg_temp.p4_id('f1'), _eom, _eom + 1)::text);
  _dec31 := make_date(extract(year from _today)::int, 12, 31);
  if _dec31 < _today + 2 then _dec31 := make_date(extract(year from _today)::int + 1, 12, 31); end if;
  perform pg_temp.p4_chk('10.04 31 dic 11:00 (' || _dec31 || ') termina exactamente 12:00', 'OK', pg_temp.p4_slot(pg_temp.p4_id('f1'), _dec31, '11:00'));
  perform pg_temp.p4_chk('10.05 1 ene 08:00', 'OK', pg_temp.p4_slot(pg_temp.p4_id('f1'), _dec31 + 1, '08:00'));
  perform pg_temp.p4_chk('10.06 get_availability a caballo de dos años: 8 huecos', '8', pg_temp.p4_count(pg_temp.p4_id('f1'), _dec31, _dec31 + 1)::text);

  -- ░ 11. Cambios de hora (DST) en Europe/Madrid ░
  _y := extract(year from _today)::int;
  _fall := pg_temp.p4_last_sunday(_y, 10);   if _fall   <= _today + 1 then _fall   := pg_temp.p4_last_sunday(_y + 1, 10); end if;
  _spring := pg_temp.p4_last_sunday(_y, 3);  if _spring <= _today + 1 then _spring := pg_temp.p4_last_sunday(_y + 1, 3);  end if;
  -- primer hueco (en UTC) y lista de horas locales del día
  for _r in
    select * from (values
      ('11.01 sábado antes del cambio de octubre (CEST, +2): 08:00 local = 06:00 UTC', _fall - 1, '06:00'),
      ('11.02 domingo del cambio de octubre (CET, +1): 08:00 local = 07:00 UTC', _fall, '07:00'),
      ('11.03 sábado antes del cambio de marzo (CET, +1): 08:00 local = 07:00 UTC', _spring - 1, '07:00'),
      ('11.04 domingo del cambio de marzo (CEST, +2): 08:00 local = 06:00 UTC', _spring, '06:00')
    ) as t(label, d, utc)
  loop
    perform pg_temp.p4_chk(_r.label || ' [' || _r.d || ']', _r.utc,
      (select to_char(min(a.start_at) at time zone 'UTC', 'HH24:MI') from public.get_availability(pg_temp.p4_id('f1'), _r.d, _r.d) a));
    perform pg_temp.p4_chk('   → horas locales ese día [' || _r.d || ']', '08:00,09:00,10:00,11:00',
      (select string_agg(to_char(a.start_at at time zone 'Europe/Madrid', 'HH24:MI'), ',' order by a.start_at)
         from public.get_availability(pg_temp.p4_id('f1'), _r.d, _r.d) a));
  end loop;
  perform pg_temp.p4_chk('11.05 coherencia get_availability = is_slot_bookable el día del cambio de octubre', '0', pg_temp.p4_diff(pg_temp.p4_id('f1'), _fall)::text);
  perform pg_temp.p4_chk('11.06 coherencia el día del cambio de marzo (franja 08–12, sin hueco)', '0', pg_temp.p4_diff(pg_temp.p4_id('f1'), _spring)::text);
  -- Franja que cruza el hueco de marzo (02:00 local no existe): INFORMATIVO, no es un criterio PASS/FAIL
  select string_agg(to_char(a.start_at at time zone 'Europe/Madrid', 'HH24:MI'), ',' order by a.start_at)
    into _txt from public.get_availability(pg_temp.p4_id('g1'), _spring, _spring) a;
  perform pg_temp.p4_info('11.07 (informativo) franja 01–04 el día del cambio de marzo [' || _spring || ']: horas locales devueltas', coalesce(_txt, '(ninguna)'));

  -- ░ 12. Coherencia general: get_availability == barrido completo con is_slot_bookable ░
  perform pg_temp.p4_chk('12.01 A lunes (reservas, buffer, pending)', '0', pg_temp.p4_diff(pg_temp.p4_id('a1'), _mon)::text);
  perform pg_temp.p4_chk('12.02 A martes (bloqueo parcial)', '0', pg_temp.p4_diff(pg_temp.p4_id('a1'), _tue)::text);
  perform pg_temp.p4_chk('12.03 A miércoles (cierre)', '0', pg_temp.p4_diff(pg_temp.p4_id('a1'), _wed)::text);
  perform pg_temp.p4_chk('12.04 A domingo', '0', pg_temp.p4_diff(pg_temp.p4_id('a1'), _sun)::text);
  perform pg_temp.p4_chk('12.05 A lunes con buffer (60+15)', '0', pg_temp.p4_diff(pg_temp.p4_id('a2'), _mon)::text);
  perform pg_temp.p4_chk('12.06 B lunes (capacidad 2)', '0', pg_temp.p4_diff(pg_temp.p4_id('b1'), _mon)::text);
  perform pg_temp.p4_chk('12.07 B martes (pico, 120 min)', '0', pg_temp.p4_diff(pg_temp.p4_id('b2'), _tue)::text);
  perform pg_temp.p4_chk('12.08 C lunes (intervalo 15)', '0', pg_temp.p4_diff(pg_temp.p4_id('c1'), _mon)::text);
  perform pg_temp.p4_chk('12.09 E lunes (otra zona horaria)', '0', pg_temp.p4_diff(pg_temp.p4_id('e1'), _mon, 'Atlantic/Canary')::text);

  perform pg_temp.p4_clean();   -- los talleres de prueba se borran aquí

  -- ░ 13. Talleres DEMO existentes (solo lectura) ░
  for _k in select id from public.services
            where id in (select ('22222222-2222-4222-8222-00000000000' || i)::uuid from generate_series(1, 8) i)
            order by id
  loop
    select coalesce(sum(pg_temp.p4_diff(_k.id, _today + d)), 0)::int into _sum from generate_series(0, 8) d;
    perform pg_temp.p4_chk('13.01 DEMO servicio ' || right(_k.id::text, 1) || ': get_availability = barrido is_slot_bookable (hoy…hoy+8)', '0', _sum::text);
    perform pg_temp.p4_info('13.02 DEMO servicio ' || right(_k.id::text, 1) || ': huecos en los próximos 9 días', pg_temp.p4_count(_k.id, _today, _today + 8)::text);
  end loop;
  for _r in
    select c.date, s.id as sid, right(s.id::text, 1) as n
    from public.workshop_closures c join public.services s on s.workshop_id = c.workshop_id
    where c.workshop_id in ('11111111-1111-4111-8111-000000000001', '11111111-1111-4111-8111-000000000002', '11111111-1111-4111-8111-000000000003')
      and c.date between _today and _today + 30
  loop
    perform pg_temp.p4_chk('13.03 DEMO cierre ' || _r.date || ' servicio ' || _r.n || ': 0 huecos', '0', pg_temp.p4_count(_r.sid, _r.date, _r.date)::text);
  end loop;
  for _r in
    select b.during, s.id as sid, right(s.id::text, 1) as n, s.duration_minutes as dur, s.buffer_minutes as buf, w.slot_interval_minutes as itv
    from public.blocked_times b
    join public.workshops w on w.id = b.workshop_id and w.id in ('11111111-1111-4111-8111-000000000001', '11111111-1111-4111-8111-000000000002', '11111111-1111-4111-8111-000000000003')
    join public.services s on s.workshop_id = w.id
    where upper(b.during) > now() and lower(b.during) < now() + interval '30 days'
  loop
    select count(*) into _cnt
    from public.get_availability(_r.sid,
           greatest((lower(_r.during) at time zone _tz)::date, _today),
           greatest((upper(_r.during) at time zone _tz)::date, _today)) a
    where tstzrange(a.start_at, a.start_at + make_interval(mins => case when _r.dur > 0 then _r.dur else _r.itv end + _r.buf), '[)') && _r.during;
    perform pg_temp.p4_chk('13.04 DEMO bloqueo ' || lower(_r.during) || ' servicio ' || _r.n || ': ningún hueco lo solapa', '0', _cnt::text);
  end loop;
end
$test$;

-- ── Resultado (última sentencia: es lo que muestra el SQL Editor) ───────────
select n, test, expected, actual,
       case when ok is null then 'INFO' when ok then 'PASS' else 'FAIL' end as resultado,
       count(*) filter (where ok is false) over () as fallos_totales
from _p4
order by n;
