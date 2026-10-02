# CitaMotor — Plan técnico (Fase 0)

Objetivo: MVP pequeño y correcto. Reservas fiables > número de funciones.

## 1. Decisiones y contradicciones resueltas

| Tema | Decisión MVP |
|---|---|
| "Edge Functions" | El proyecto usa TanStack Start: la lógica sensible va en **server functions** + **funciones SQL (RPC) SECURITY DEFINER**. Mismo aislamiento de secretos. |
| Capacidad > 1 | No sirve un exclusion constraint simple (solo modela capacidad 1). Se usa **RPC con bloqueo por taller** (`pg_advisory_xact_lock(workshop)` + `SELECT ... FOR UPDATE` del taller) y recuento de solapes dentro de la transacción. |
| Buffer | Ocupación = `[start_at, start_at + duración + buffer)`. Se guarda `occupied_until` aparte de `end_at` (lo que ve el cliente). El buffer debe caber antes del cierre: **no** (solo la duración debe caber; el buffer puede salir del horario). |
| Estado `rescheduled` | La reprogramación **mueve la misma reserva** (actualiza start/end en una transacción) y registra evento `rescheduled` con hora anterior. El estado `rescheduled` se reserva para propuestas del taller sobre solicitudes; la cita sigue `confirmed`. Evita duplicar filas y huecos. |
| Solicitudes (`request`) | Una solicitud `pending` **no ocupa capacidad** (no bloquea a otros). Al confirmarla, la RPC revalida capacidad; si ya no cabe, el taller debe proponer otra hora. |
| Proponer otra hora | Taller propone → reserva queda `pending` con `proposed_start_at`; el cliente acepta desde su enlace (RPC atómica) o rechaza. |
| Expiración | Sin cron externo obligatorio: `pg_cron` cada 5 min marca `pending → expired` si `response_deadline_at < now()`. Las lecturas también lo tratan como expirado. |
| Deadline inteligente | SLA en **minutos laborables** (por defecto 120) contados solo dentro de los intervalos de apertura, saltando cierres. Calculado en SQL. Se muestra "Respuesta antes de: lun 08:00–10:00". |
| Recordatorios 48h/24h | Se crean como filas `notifications` con `scheduled_for`; un job las envía. Si no hay dominio de email configurado, quedan `queued` / `failed` registradas (cumple "registrados"). |
| Email | Lovable Emails (requiere dominio). Si no está listo, la reserva funciona igual. |
| IA | Lovable AI Gateway, salida por tool-calling con enum cerrado + validación Zod; fallback `other`. Solo sugiere servicio; nunca reserva. |
| Cuenta de cliente | MVP: solo guest con enlace mágico. Rol `customer` existe en el modelo, sin pantallas propias (fuera de "mínimo"). |
| Zona horaria | Cada taller tiene `timezone` (default `Europe/Madrid`). Horarios semanales en `time` local; conversión a `timestamptz` en SQL con `AT TIME ZONE`, lo que resuelve DST. |

## 2. Rutas

```text
Público
/                         Home + servicios
/reservar                 ?servicio= → lista talleres
/taller/$slug             Página pública + flujo de reserva
/cita/$token              Gestionar cita (ver/cancelar/reprogramar/aceptar propuesta)
/auth                     Login / registro taller
Taller (_authenticated, noindex)
/panel                    Inicio (hoy, pendientes, próximas, cancelaciones)
/panel/onboarding         5 pasos con guardado
/panel/calendario         Día / semana
/panel/citas              Lista + acciones
/panel/servicios  /panel/horario  /panel/clientes  /panel/ajustes
Admin (_authenticated + rol admin, noindex)
/admin                    Talleres, reservas, notificaciones, incidencias, stats
```

## 3. Modelo de datos (resumen)

- `profiles(id→auth.users, full_name, phone)`
- `user_roles(user_id, role app_role[admin|workshop|customer])` + `has_role()`
- `workshops(id, owner_id→profiles, slug unique, name, description, phone, email, address, city, postal_code, region, country, timezone, capacity_per_slot, slot_interval_minutes[15|30|60], min_lead_time_minutes=60, max_booking_horizon_days=30, cancellation_window_minutes=0, request_sla_minutes=120, active, is_demo)`
- `services(id, workshop_id, category enum, name, description, price_type, price_from, duration_minutes, buffer_minutes, booking_mode, active, deleted_at)` — check: instant ⇒ duración > 0. Borrado = soft delete.
- `workshop_hours(workshop_id, weekday 1-7, opens time, closes time)` — check opens<closes, varias filas por día.
- `workshop_closures(workshop_id, date, reason)` día completo.
- `blocked_times(workshop_id, during tstzrange, reason)` cierres parciales.
- `vehicles(id, customer_id null, plate, make, model)`
- `bookings(id, workshop_id, service_id, customer_id null, vehicle_id null, status, start_at, end_at, occupied_until, proposed_start_at, response_deadline_at, customer_name, customer_phone, customer_email, notes, snapshots: service_name/duration/buffer/price/price_type, idempotency_key unique, manage_token_hash, manage_token_expires_at, created_at)`
  - Índice GiST en `(workshop_id, tstzrange(start_at, occupied_until))` filtrado por estados que ocupan.
- `booking_events(id, booking_id, event_type, actor_type, actor_id, metadata jsonb, created_at)`
- `notifications(id, booking_id, channel, template, recipient, status[queued|sent|failed|cancelled], scheduled_for, provider, provider_message_id, error_message, attempts, sent_at)`
- `system_errors(id, source, code, message, context jsonb, created_at)` — observabilidad (sin secretos).

Estados que ocupan capacidad: `confirmed`.

## 4. Máquina de estados

```text
pending   → confirmed | declined | expired | cancelled(cliente)
confirmed → cancelled | completed | no_show   (+ reprogramación = sigue confirmed)
terminales: cancelled, declined, expired, completed, no_show
```
Impuesta por trigger `BEFORE UPDATE` (tabla de transiciones permitidas) + evento automático. Las RPC son la única vía de escritura (sin UPDATE directo vía RLS).

## 5. Disponibilidad

`get_availability(workshop, service, date)` en SQL: genera inicios cada `slot_interval` dentro de cada intervalo de apertura (en tz del taller), descarta: pasado, < lead time, > horizonte, día cerrado, solape con `blocked_times`, duración que no cabe antes del cierre, y slots donde `count(confirmed solapados) >= capacity`. Devuelve `timestamptz`. Misma función de validación `is_slot_bookable()` reutilizada por la RPC de reserva → UI y backend nunca divergen.

## 6. Anti double-booking

`create_booking(...)` (SECURITY DEFINER, una transacción):
1. Si existe `idempotency_key` → devuelve la reserva existente.
2. `pg_advisory_xact_lock(hash(workshop_id))` serializa reservas del mismo taller.
3. Relee taller/servicio (activo, duración actual → snapshot).
4. `is_slot_bookable()` con recuento de solapes `[start, occupied_until)`.
5. Inserta, evento `created`, notificaciones en cola, genera token (devuelve token en claro una sola vez; guarda SHA-256).
Errores tipados: `SLOT_TAKEN`, `SERVICE_INACTIVE`, `WORKSHOP_CLOSED`, `OUT_OF_HOURS`, `TOO_SOON`, `TOO_FAR` → UI muestra "Esa hora acaba de ocuparse." y recarga alternativas. Reprogramar y confirmar solicitud usan el mismo lock y validación excluyendo la propia reserva.

## 7. Auth y RLS

- Email/contraseña para talleres y admin. Rol en `user_roles`, nunca en cliente.
- `workshops/services/hours/closures/blocked`: lectura pública solo si taller activo (vista pública sin email/teléfono privados si procede); escritura solo owner o admin.
- `bookings/events/notifications/vehicles`: SELECT solo owner del taller o admin; sin INSERT/UPDATE directos (solo RPC).
- Guest: ningún acceso por RLS; `get_booking_by_token(token)` compara hash y devuelve solo su cita.

## 8. Guest booking

Token 32 bytes aleatorios (base64url), hash SHA-256 en BD, caduca 7 días tras la cita, se invalida en estados terminales (solo lectura). URL `/cita/$token` no lleva datos personales.

## 9. Casos límite cubiertos por tests

hoy/mañana, fin de mes/año, DST (marzo/octubre en Madrid), día cerrado, cierre parcial, cita que acaba justo al cierre (válida), que lo supera (inválida), primera/última hora, fecha pasada, cambio de duración entre ver y confirmar, servicio desactivado, taller desactivado.

## 10. Plan de pruebas

- **SQL (vía psql)**: disponibilidad, DST, solapes semiabiertos, transiciones, snapshots.
- **Concurrencia**: N llamadas paralelas a `create_booking` (cap 1 → 1 OK; cap 2 → 2 OK, 3ª `SLOT_TAKEN`); misma idempotency key ×5 → 1 fila.
- **RLS**: peticiones directas con JWT de Taller A contra datos de B; guest sin token; admin.
- **E2E Playwright**: flujos A–Z del documento, en viewport móvil y escritorio.

## 11. Fases

0. Plan (este documento).
1. Sistema visual, home, routing, páginas públicas con datos estáticos.
2. Lovable Cloud, auth, esquema completo, RLS, roles, datos DEMO (3 talleres).
3. Onboarding taller, servicios, horario, cierres, ajustes.
4. Motor de disponibilidad (SQL) + tests de fechas/DST.
5. `create_booking` atómica + flujo de reserva + slot obsoleto + idempotencia + test de concurrencia.
6. Panel: inicio, calendario día/semana, citas, clientes.
7. Máquina de estados, cancelación, reprogramación, solicitudes, deadline, expiración.
8. Notificaciones (cola, email si hay dominio, recordatorios, reintentos).
9. Gestión guest por token.
10. Clasificación IA con esquema cerrado.
11. Auditoría seguridad/RLS + escaneo.
12. Tests exhaustivos (A–Z, concurrencia, stale, multi-tenant).
13. Móvil, accesibilidad, rendimiento, SEO.
14. Admin, observabilidad, preparación producción.

Cada fase se prueba antes de pasar a la siguiente.

## Detalles visuales (Fase 1)

Mobile-first, aspecto de producto tecnológico: fondo claro cálido, tinta casi negra, acento naranja señal (no morado), tipografía Space Grotesk + DM Sans, CTA sticky en móvil, sin animaciones decorativas.
