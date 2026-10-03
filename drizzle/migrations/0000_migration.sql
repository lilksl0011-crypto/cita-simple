
create extension if not exists btree_gist with schema extensions;

-- ===== Enums =====
create type public.app_role as enum ('admin','workshop','customer');
create type public.price_type as enum ('fixed','from','quote');
create type public.booking_mode as enum ('instant','request');
create type public.booking_status as enum ('pending','confirmed','declined','expired','cancelled','completed','no_show');
create type public.booking_event_type as enum ('created','confirmed','declined','expired','cancelled_by_customer','cancelled_by_workshop','completed','no_show','rescheduled','availability_conflict','proposal_created','proposal_accepted','proposal_rejected');
create type public.actor_type as enum ('customer','workshop','admin','system');
create type public.notification_status as enum ('queued','sent','failed','cancelled');
create type public.notification_channel as enum ('email','whatsapp','sms');

-- ===== Helpers =====
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- ===== profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 30),
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ===== user_roles =====
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "own roles read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- ===== workshops =====
create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 255),
  address text check (char_length(address) <= 200),
  city text check (char_length(city) <= 80),
  postal_code text check (char_length(postal_code) <= 12),
  region text check (char_length(region) <= 80),
  country text not null default 'ES',
  timezone text not null default 'Europe/Madrid',
  capacity_per_slot integer not null default 1 check (capacity_per_slot > 0),
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes in (15,30,60)),
  min_lead_time_minutes integer not null default 60 check (min_lead_time_minutes >= 0),
  max_booking_horizon_days integer not null default 30 check (max_booking_horizon_days > 0),
  cancellation_window_minutes integer not null default 0 check (cancellation_window_minutes >= 0),
  request_sla_minutes integer not null default 120 check (request_sla_minutes >= 0),
  onboarding_step integer not null default 0 check (onboarding_step between 0 and 5),
  onboarding_completed_at timestamptz,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workshops_owner_idx on public.workshops(owner_id);
create trigger workshops_updated before update on public.workshops for each row execute function public.set_updated_at();
grant select on public.workshops to anon;
grant select, update on public.workshops to authenticated;
grant all on public.workshops to service_role;
alter table public.workshops enable row level security;

-- owner check helper (security definer avoids RLS recursion from child tables)
create or replace function public.owns_workshop(_workshop_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workshops w where w.id = _workshop_id and w.owner_id = auth.uid())
    and public.has_role(auth.uid(),'workshop')
$$;
revoke execute on function public.owns_workshop(uuid) from public, anon;
grant execute on function public.owns_workshop(uuid) to authenticated, service_role;

create or replace function public.can_manage_workshop(_workshop_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.owns_workshop(_workshop_id) or public.has_role(auth.uid(),'admin')
$$;
revoke execute on function public.can_manage_workshop(uuid) from public, anon;
grant execute on function public.can_manage_workshop(uuid) to authenticated, service_role;

create policy "public active workshops" on public.workshops for select to anon, authenticated using (active);
create policy "manage own workshop read" on public.workshops for select to authenticated using (public.can_manage_workshop(id));
create policy "manage own workshop update" on public.workshops for update to authenticated
  using (public.can_manage_workshop(id)) with check (public.can_manage_workshop(id));

-- prevent owners from changing protected columns
create or replace function public.guard_workshop_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') and auth.role() <> 'service_role' then
    if new.owner_id is distinct from old.owner_id or new.slug is distinct from old.slug
       or new.is_demo is distinct from old.is_demo then
      raise exception 'No puedes modificar este campo';
    end if;
  end if;
  return new;
end $$;
create trigger workshops_guard before update on public.workshops for each row execute function public.guard_workshop_update();

-- ===== services =====
create table public.services (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  category text not null check (category in ('tyres','oil_change','inspection','battery','brakes','itv','diagnosis','other')),
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 1000),
  price_type public.price_type not null default 'quote',
  price_from numeric(10,2),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  buffer_minutes integer not null default 0 check (buffer_minutes >= 0),
  booking_mode public.booking_mode not null default 'instant',
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (booking_mode <> 'instant' or duration_minutes > 0),
  check (price_type = 'quote' or (price_from is not null and price_from >= 0))
);
create index services_workshop_idx on public.services(workshop_id);
create trigger services_updated before update on public.services for each row execute function public.set_updated_at();
grant select on public.services to anon;
grant select, insert, update on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "public services" on public.services for select to anon, authenticated
  using (active and deleted_at is null and exists (select 1 from public.workshops w where w.id = workshop_id and w.active));
create policy "manage services read" on public.services for select to authenticated using (public.can_manage_workshop(workshop_id));
create policy "manage services insert" on public.services for insert to authenticated with check (public.can_manage_workshop(workshop_id));
create policy "manage services update" on public.services for update to authenticated
  using (public.can_manage_workshop(workshop_id)) with check (public.can_manage_workshop(workshop_id));

-- ===== workshop_hours =====
create table public.workshop_hours (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 7),
  opens time not null,
  closes time not null,
  check (opens < closes)
);
create index workshop_hours_workshop_idx on public.workshop_hours(workshop_id, weekday);
grant select on public.workshop_hours to anon;
grant select, insert, update, delete on public.workshop_hours to authenticated;
grant all on public.workshop_hours to service_role;
alter table public.workshop_hours enable row level security;
create policy "public hours" on public.workshop_hours for select to anon, authenticated
  using (exists (select 1 from public.workshops w where w.id = workshop_id and w.active));
create policy "manage hours" on public.workshop_hours for all to authenticated
  using (public.can_manage_workshop(workshop_id)) with check (public.can_manage_workshop(workshop_id));

-- ===== workshop_closures =====
create table public.workshop_closures (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  date date not null,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (workshop_id, date)
);
grant select, insert, update, delete on public.workshop_closures to authenticated;
grant all on public.workshop_closures to service_role;
alter table public.workshop_closures enable row level security;
create policy "manage closures" on public.workshop_closures for all to authenticated
  using (public.can_manage_workshop(workshop_id)) with check (public.can_manage_workshop(workshop_id));

-- ===== blocked_times =====
create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  during tstzrange not null check (not isempty(during) and lower(during) is not null and upper(during) is not null),
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);
create index blocked_times_during_idx on public.blocked_times using gist (workshop_id, during);
grant select, insert, update, delete on public.blocked_times to authenticated;
grant all on public.blocked_times to service_role;
alter table public.blocked_times enable row level security;
create policy "manage blocks" on public.blocked_times for all to authenticated
  using (public.can_manage_workshop(workshop_id)) with check (public.can_manage_workshop(workshop_id));

-- ===== vehicles =====
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  plate text check (char_length(plate) <= 15),
  make text check (char_length(make) <= 60),
  model text check (char_length(model) <= 60),
  year integer check (year between 1900 and 2100),
  created_at timestamptz not null default now()
);
grant select on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
alter table public.vehicles enable row level security;
create policy "admin vehicles" on public.vehicles for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- ===== bookings =====
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  customer_id uuid references auth.users(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  status public.booking_status not null default 'pending',
  start_at timestamptz not null,
  end_at timestamptz not null,
  occupied_until timestamptz not null,
  proposed_start_at timestamptz,
  response_deadline_at timestamptz,
  needs_attention boolean not null default false,
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text not null check (char_length(customer_phone) between 6 and 30),
  customer_email text not null check (char_length(customer_email) between 3 and 255),
  notes text check (char_length(notes) <= 1000),
  service_name_snapshot text not null,
  duration_snapshot_minutes integer not null check (duration_snapshot_minutes >= 0),
  buffer_snapshot_minutes integer not null default 0 check (buffer_snapshot_minutes >= 0),
  price_snapshot numeric(10,2),
  price_type_snapshot public.price_type not null,
  idempotency_key text unique,
  manage_token_hash text,
  manage_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at >= start_at),
  check (occupied_until >= end_at)
);
create index bookings_workshop_idx on public.bookings(workshop_id);
create index bookings_service_idx on public.bookings(service_id);
create index bookings_customer_idx on public.bookings(customer_id) where customer_id is not null;
create index bookings_status_idx on public.bookings(status);
create index bookings_start_idx on public.bookings(workshop_id, start_at);
create index bookings_deadline_idx on public.bookings(response_deadline_at) where status = 'pending';
create index bookings_occupancy_gist on public.bookings using gist (workshop_id, tstzrange(start_at, occupied_until, '[)'))
  where status in ('pending','confirmed');
create trigger bookings_updated before update on public.bookings for each row execute function public.set_updated_at();
grant select, update on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "manage bookings read" on public.bookings for select to authenticated using (public.can_manage_workshop(workshop_id));
create policy "manage bookings update" on public.bookings for update to authenticated
  using (public.can_manage_workshop(workshop_id)) with check (public.can_manage_workshop(workshop_id));

-- ===== booking_events =====
create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_type public.booking_event_type not null,
  actor_type public.actor_type not null,
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events(booking_id);
grant select on public.booking_events to authenticated;
grant all on public.booking_events to service_role;
alter table public.booking_events enable row level security;
create policy "manage events read" on public.booking_events for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and public.can_manage_workshop(b.workshop_id)));

-- ===== notifications =====
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  channel public.notification_channel not null,
  template text not null,
  recipient text not null,
  status public.notification_status not null default 'queued',
  scheduled_for timestamptz not null default now(),
  provider text,
  provider_message_id text,
  error_message text,
  attempts integer not null default 0 check (attempts >= 0),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_booking_idx on public.notifications(booking_id);
grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "admin notifications" on public.notifications for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- ===== system_errors =====
create table public.system_errors (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  code text,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.system_errors to authenticated;
grant all on public.system_errors to service_role;
alter table public.system_errors enable row level security;
create policy "admin errors" on public.system_errors for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- ===== slug + workshop account bootstrap =====
create or replace function public.slugify(_txt text) returns text
language sql immutable set search_path = public as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(translate(coalesce(_txt,''),
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ','aaaaaeeeeiiiiooooouuuuncaaaaaeeeeiiiiooooouuuunc')),
    '[^a-z0-9]+','-','g')),''),'taller')
$$;

-- Idempotent: creates profile, workshop role and the caller's workshop. Never trusts a role from the client.
create or replace function public.bootstrap_workshop_account()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _meta jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
  _name text := left(coalesce(nullif(trim(_meta->>'workshop_name'),''),'Mi taller'),120);
  _base text; _slug text; _n int := 0; _wid uuid;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  insert into public.profiles(id, full_name) values (_uid, left(nullif(trim(_meta->>'full_name'),''),120))
    on conflict (id) do nothing;
  if public.has_role(_uid,'admin') then return null; end if;
  insert into public.user_roles(user_id, role) values (_uid,'workshop') on conflict do nothing;
  select id into _wid from public.workshops where owner_id = _uid limit 1;
  if _wid is not null then return _wid; end if;
  _base := left(public.slugify(_name),70); _slug := _base;
  while exists (select 1 from public.workshops where slug = _slug) loop
    _n := _n + 1; _slug := _base || '-' || _n;
  end loop;
  insert into public.workshops(owner_id, slug, name, active) values (_uid, _slug, _name, false) returning id into _wid;
  return _wid;
end $$;
revoke execute on function public.bootstrap_workshop_account() from public, anon;
grant execute on function public.bootstrap_workshop_account() to authenticated;

-- ===== DEMO DATA (Ibiza, fictitious) =====
insert into public.workshops (id, slug, name, description, phone, email, address, city, postal_code, region, capacity_per_slot, slot_interval_minutes, is_demo, onboarding_step, onboarding_completed_at) values
 ('11111111-1111-4111-8111-000000000001','demo-taller-es-pou','DEMO Taller Es Pou','Taller de prueba. Datos ficticios.','+34 600 000 001','demo1@example.invalid','Carrer de Prova 12','Eivissa','07800','Illes Balears',2,30,true,5,now()),
 ('11111111-1111-4111-8111-000000000002','demo-garaje-sa-tanca','DEMO Garaje Sa Tanca','Taller de prueba. Datos ficticios.','+34 600 000 002','demo2@example.invalid','Avinguda Ficticia 5','Sant Antoni de Portmany','07820','Illes Balears',1,30,true,5,now()),
 ('11111111-1111-4111-8111-000000000003','demo-motor-cala-blava','DEMO Motor Cala Blava','Taller de prueba. Datos ficticios.','+34 600 000 003','demo3@example.invalid','Camí de Mostra 3','Santa Eulària des Riu','07840','Illes Balears',3,60,true,5,now());

insert into public.services (id, workshop_id, category, name, price_type, price_from, duration_minutes, buffer_minutes, booking_mode) values
 ('22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000001','oil_change','Cambio de aceite y filtro','fixed',79,45,15,'instant'),
 ('22222222-2222-4222-8222-000000000002','11111111-1111-4111-8111-000000000001','tyres','Cambio de 2 neumáticos','from',40,30,0,'instant'),
 ('22222222-2222-4222-8222-000000000003','11111111-1111-4111-8111-000000000001','diagnosis','Diagnóstico de avería','quote',null,60,0,'request'),
 ('22222222-2222-4222-8222-000000000004','11111111-1111-4111-8111-000000000002','brakes','Pastillas de freno','from',90,60,0,'instant'),
 ('22222222-2222-4222-8222-000000000005','11111111-1111-4111-8111-000000000002','itv','Pre-ITV','fixed',35,30,0,'instant'),
 ('22222222-2222-4222-8222-000000000006','11111111-1111-4111-8111-000000000002','other','Otro problema','quote',null,0,0,'request'),
 ('22222222-2222-4222-8222-000000000007','11111111-1111-4111-8111-000000000003','inspection','Revisión general','from',120,120,0,'instant'),
 ('22222222-2222-4222-8222-000000000008','11111111-1111-4111-8111-000000000003','battery','Cambio de batería','from',95,30,0,'instant');

insert into public.workshop_hours (workshop_id, weekday, opens, closes)
select '11111111-1111-4111-8111-000000000001'::uuid, d, t.o, t.c from generate_series(1,5) d,
  (values ('08:00'::time,'13:00'::time),('15:00'::time,'19:00'::time)) t(o,c)
union all select '11111111-1111-4111-8111-000000000001', 6, '09:00','13:00'
union all select '11111111-1111-4111-8111-000000000002'::uuid, d, '09:00'::time, '18:00'::time from generate_series(1,5) d
union all select '11111111-1111-4111-8111-000000000003'::uuid, d, '08:00'::time, '14:00'::time from generate_series(1,6) d;

insert into public.workshop_closures (workshop_id, date, reason) values
 ('11111111-1111-4111-8111-000000000002', (current_date + 7), 'DEMO: cierre por inventario');

insert into public.blocked_times (workshop_id, during, reason) values
 ('11111111-1111-4111-8111-000000000001',
  tstzrange(((current_date + 2) + time '10:00') at time zone 'Europe/Madrid', ((current_date + 2) + time '12:00') at time zone 'Europe/Madrid','[)'),
  'DEMO: formación del equipo');

insert into public.bookings (workshop_id, service_id, status, start_at, end_at, occupied_until, customer_name, customer_phone, customer_email, service_name_snapshot, duration_snapshot_minutes, buffer_snapshot_minutes, price_snapshot, price_type_snapshot, response_deadline_at) values
 ('11111111-1111-4111-8111-000000000001','22222222-2222-4222-8222-000000000001','confirmed',
  ((current_date + 1) + time '09:00') at time zone 'Europe/Madrid', ((current_date + 1) + time '09:45') at time zone 'Europe/Madrid', ((current_date + 1) + time '10:00') at time zone 'Europe/Madrid',
  'Cliente Demo Uno','+34 600 000 101','cliente1@example.invalid','Cambio de aceite y filtro',45,15,79,'fixed',null),
 ('11111111-1111-4111-8111-000000000001','22222222-2222-4222-8222-000000000003','pending',
  ((current_date + 3) + time '16:00') at time zone 'Europe/Madrid', ((current_date + 3) + time '17:00') at time zone 'Europe/Madrid', ((current_date + 3) + time '17:00') at time zone 'Europe/Madrid',
  'Cliente Demo Dos','+34 600 000 102','cliente2@example.invalid','Diagnóstico de avería',60,0,null,'quote', now() + interval '2 hours'),
 ('11111111-1111-4111-8111-000000000002','22222222-2222-4222-8222-000000000004','confirmed',
  ((current_date + 2) + time '11:00') at time zone 'Europe/Madrid', ((current_date + 2) + time '12:00') at time zone 'Europe/Madrid', ((current_date + 2) + time '12:00') at time zone 'Europe/Madrid',
  'Cliente Demo Tres','+34 600 000 103','cliente3@example.invalid','Pastillas de freno',60,0,90,'from',null);

insert into public.booking_events (booking_id, event_type, actor_type)
select id, 'created', 'customer' from public.bookings;
