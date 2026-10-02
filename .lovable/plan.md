# CitaMotor — Plan técnico (Fase 0, v2)

Objetivo: MVP pequeño y correcto. Reservas fiables > número de funciones.

## 1. Backend único

Una sola fuente de verdad: **un único proyecto Supabase** (PostgreSQL + Auth + RLS + RPC), aprovisionado y gestionado por Lovable Cloud. Lovable Cloud no es una infraestructura distinta: es el mismo proyecto Supabase. No se conectará ningún otro proyecto Supabase.

- Lógica crítica (reservas, transiciones, tokens, disponibilidad): **funciones SQL/RPC** en PostgreSQL.
- Lógica con secretos (email, IA): **server functions** del framework (TanStack Start) que llaman a esas RPC. No se usan Edge Functions separadas: mismo aislamiento de secretos, un solo despliegue.
- Ningún secreto ni service role key en el navegador.

## 2. Decisiones resueltas

| Tema | Decisión MVP |
|---|---|
| Capacidad > 1 | Exclusion constraint no modela capacidad N. Se usa RPC con **advisory lock transaccional por taller** + recuento de solapes en la misma transacción. |
| Clave del lock | `pg_advisory_xact_lock(bigint)` con clave = primeros 8 bytes del UUID del taller interpretados como bigint (`('x' || substr(replace(id::text,'-',''),1,16))::bit(64)::bigint`). Determinista, 64 bits, sin hash pequeño. Serializa **solo** operaciones concurrentes del mismo taller (crear, reprogramar, confirmar solicitud, aceptar propuesta); talleres distintos no se bloquean. Se libera al terminar la transacción. |
| Buffer | Ocupación = `[start_at, occupied_until)` con `occupied_until = start + duración + buffer`. `end_at` = lo que ve el cliente. **Duración + buffer deben caber completos dentro del intervalo de apertura** (cierre 19:00, 60+15 → última cita 17:45). |
| Generación de slots | Inicios desde el **inicio real de cada intervalo de apertura local** (08:15–13:00, cada 30 → 08:15, 08:45…), no alineados a medianoche. Conversión con la zona del taller → `timestamptz`. |
| Estados | `pending, confirmed, declined, expired, cancelled, completed, no_show`. **Sin `rescheduled` como estado.** |
| Reprogramación | Misma fila, sigue `confirmed`; se actualizan start/end/occupied en una transacción con lock + revalidación excluyendo la propia reserva. Si falla, la cita original queda intacta. Evento `rescheduled` con `previous_start_at, previous_end_at, new_start_at, new_end_at, actor_type, actor_id`. |
| Solicitudes pending | No consumen capacidad. Al confirmar una solicitud (o una reserva instantánea), la RPC detecta otras `pending` del taller que **ya no caben** y las marca `needs_attention = true` + evento `availability_conflict`. El panel las destaca: "Este horario ya no está disponible" con acciones **Proponer otra hora** / **Rechazar**. Nunca quedan silenciosamente pendientes. |
| Propuesta del taller | Reserva sigue `pending` con `proposed_start_at`; el cliente acepta desde su enlace (RPC atómica con lock + revalidación) o rechaza. |
| Expiración | `pg_cron` cada 5 min: `pending → expired` si `response_deadline_at < now()`; las lecturas también lo consideran. |
| Deadline | SLA en minutos laborables (defecto 120) contados solo dentro de intervalos de apertura, en la zona horaria del taller, saltando `workshop_closures` y `blocked_times`. Calculado en SQL. Nunca se promete respuesta en periodo cerrado; UI: "El taller responderá antes del lun 10:00". |
| Email guest | **Email y teléfono obligatorios.** |
| Sin proveedor de email | Nunca decir "Te hemos enviado…". Se muestra confirmación en pantalla, el enlace de gestión **una sola vez** (copiar), y la notificación queda `queued`/`failed` registrada. |
| IA | Lovable AI Gateway, salida con enum cerrado + validación Zod; fallback `other`. Solo sugiere servicio; nunca reserva. |
| Cuenta cliente | MVP: guest con enlace. Rol `customer` existe en el modelo, sin pantallas propias. |
| Zona horaria | `workshops.timezone` (defecto `Europe/Madrid`). Horarios en `time` local; conversión con `AT TIME ZONE` (resuelve DST). Todo lo persistido de reservas es `timestamptz`. |

## 3. Rutas

```text
Público
/                     Home + servicios
/reservar             ?servicio= → talleres
/taller/$slug         Página pública + flujo de reserva
/cita/$token          Gestionar cita
/auth                 Login / registro taller
Taller (protegido, noindex)
/panel  /panel/onboarding  /panel/calendario  /panel/citas
/panel/servicios  /panel/horario  /panel/clientes  /panel/ajustes
Admin (protegido + rol admin, noindex)
/admin
```

## 4. Modelo de datos

- `profiles(id→auth.users, full_name, phone)`
- `user_roles(user_id, role[admin|workshop|customer])` + `has_role()`
- `workshops(id, owner_id→profiles, slug unique, name, description, phone, email, address, city, postal_code, region, country, timezone, capacity_per_slot, slot_interval_minutes∈{15,30,60}, min_lead_time_minutes=60, max_booking_horizon_days=30, cancellation_window_minutes=0, request_sla_minutes=120, active, is_demo)`
- `services(id, workshop_id, category, name, description, price_type, price_from, duration_minutes, buffer_minutes, booking_mode, active, deleted_at)` — check instant ⇒ duración > 0; borrado = soft delete.
- `workshop_hours(workshop_id, weekday 1–7, opens, closes)` varias filas por día.
- `workshop_closures(workshop_id, date, reason)`; `blocked_times(workshop_id, during tstzrange, reason)`.
- `vehicles(id, customer_id null, plate, make, model)`
- `bookings(id, workshop_id, service_id, customer_id null, vehicle_id null, status, start_at, end_at, occupied_until, proposed_start_at, response_deadline_at, needs_attention, customer_name, customer_phone, customer_email, notes, service_name_snapshot, duration_snapshot_minutes, buffer_snapshot_minutes, price_snapshot, price_type_snapshot, idempotency_key unique, manage_token_hash, manage_token_expires_at, created_at)` + índice GiST `(workshop_id, tstzrange(start_at, occupied_until))` para `confirmed`.
- `booking_events(id, booking_id, event_type, actor_type, actor_id, metadata jsonb, created_at)`
- `notifications(id, booking_id, channel, template, recipient, status[queued|sent|failed|cancelled], scheduled_for, provider, provider_message_id, error_message, attempts, sent_at)`
- `system_errors(id, source, code, message, context jsonb, created_at)` sin secretos.

## 5. Máquina de estados

```text
pending   → confirmed | declined | expired | cancelled
confirmed → cancelled | completed | no_show      (reprogramar = sigue confirmed)
terminales: declined, expired, cancelled, completed, no_show
```
Trigger `BEFORE UPDATE` con tabla de transiciones permitidas. Sin UPDATE/INSERT directos por RLS: solo RPC.

Reglas explícitas:
- No se puede cancelar ni reprogramar si `start_at <= now()`.
- Cancelación del cliente solo si `now() < start_at - cancellation_window_minutes` (MVP: 0).
- `cancelled` no se reactiva por ninguna operación normal; `completed, no_show, declined, expired` permanecen terminales.

## 6. Reglas para toda función SECURITY DEFINER

Cada función:
1. `SET search_path = public, pg_temp` y referencias cualificadas.
2. Identifica al llamante con `auth.uid()` (o token guest hasheado); nunca acepta un user_id del cliente.
3. Deriva el taller **desde la fila** (booking → workshop, service → workshop), no del parámetro, y comprueba que el servicio pertenece al taller.
4. Valida ownership (`workshops.owner_id = auth.uid()`) o `has_role(admin)` en acciones de taller; en acciones guest, que el hash del token coincide, no ha caducado y la acción está permitida para el estado.
5. Valida todos los parámetros (rangos, longitudes, formato email/teléfono, estados).
6. Lleva un comentario `COMMENT ON FUNCTION` documentando sus controles de autorización.
7. `REVOKE EXECUTE FROM PUBLIC` y `GRANT` solo a los roles necesarios.
RLS se mantiene como segunda capa, no como única protección.

## 7. Disponibilidad y anti double-booking

`is_slot_bookable(workshop, service, start, exclude_booking)` es la única regla, usada tanto por `get_availability` (UI) como por las RPC de escritura. Descarta: pasado, < lead time, > horizonte, taller/servicio inactivo, día cerrado, `blocked_times`, duración fuera de apertura, y `count(confirmed solapados en [start, occupied_until)) >= capacity`.

`create_booking` (una transacción):
1. Recibe `idempotency_key` (UUID generado por el navegador por intento) y `token_hash` (ver §9).
2. Adquiere el lock del taller.
3. **Comprueba `idempotency_key` después del lock**; si existe → devuelve la reserva existente (nunca un token nuevo).
4. Relee taller/servicio actuales → snapshots.
5. `is_slot_bookable` (capacidad validada dentro de la transacción).
6. Inserta (`confirmed` si instant, `pending` + deadline si request), evento, notificaciones en cola, marca pending incompatibles.
7. Si el `INSERT` choca con el unique de `idempotency_key` (`unique_violation`), se captura y se devuelve la reserva existente.
Errores tipados: `SLOT_TAKEN, SERVICE_INACTIVE, WORKSHOP_CLOSED, OUT_OF_HOURS, TOO_SOON, TOO_FAR, INVALID_INPUT, RATE_LIMITED`.

### Flujo guest

```text
navegador → server function (Zod + rate limiting) → RPC PostgreSQL → resultado
```
La server function **no decide** disponibilidad; la RPC es la autoridad para disponibilidad, capacidad, double-booking, estados e integridad.

Rate limiting básico (pedido explícitamente; no hay primitiva estándar, se implementa a medida): tabla `rate_limit_hits(key_hash, bucket_start, count)` con clave = SHA-256(IP + sal) y, por separado, SHA-256(email). Límites iniciales: 10 creaciones/hora por IP, 5/hora por email, 60 consultas de token/hora por IP. **Nunca se guarda la IP en claro**; las filas se borran a las 24 h (pg_cron).

## 8. Auth y RLS

- Email/contraseña para talleres y admin; roles en `user_roles`.
- Catálogo (talleres activos, servicios activos, horarios, cierres): lectura pública con columnas seguras; escritura solo owner/admin.
- `bookings, booking_events, notifications, vehicles`: SELECT solo owner del taller o admin; escritura solo vía RPC.
- `rate_limit_hits`: sin acceso para anon/authenticated; solo server.
- Guest: sin acceso RLS; solo `get_booking_by_token`.

## 9. Token de gestión

El **navegador genera** el token (32 bytes con `crypto.getRandomValues`, base64url) y la `idempotency_key` antes de enviar, y los conserva en memoria/estado del flujo (y `sessionStorage` durante el intento, para sobrevivir a un refresco). Se envía el token y el servidor guarda solo SHA-256(token). Si la respuesta se pierde, el reintento con la misma `idempotency_key` recupera la misma reserva y el navegador ya tiene el token correcto. El servidor nunca genera ni devuelve tokens en claro; una `idempotency_key` mapea a una sola reserva. Caduca a los **30 días tras `end_at`** (o tras la creación si nunca se confirma).
- Antes de la cita y estado activo: consultar, cancelar, reprogramar, aceptar/rechazar propuesta.
- Estado terminal o cita pasada: **solo lectura** hasta caducar.
- La URL no contiene datos personales; la respuesta solo devuelve esa cita.

## 10. UX crítica

- Instantánea confirmada: **"✓ Cita confirmada"**.
- Solicitud: **"Solicitud enviada"** + "El taller debe confirmar esta cita." + plazo honesto. Nunca "Cita reservada" para pending.
- Slot ocupado al confirmar: "Esa hora acaba de ocuparse." + recarga automática de alternativas + datos del formulario preservados.
- Errores siempre con acción (Siguiente día, Otra fecha, Solicitar cita, Reintentar).

## 11. Casos límite y pruebas

Fechas: hoy, mañana, fin de mes/año, DST marzo/octubre, día cerrado, cierre parcial, fin exacto al cierre (válido), supera cierre (inválido), primera/última hora, pasado.
- SQL: disponibilidad, DST, solapes semiabiertos, transiciones, snapshots, deadline.
- Concurrencia: llamadas paralelas reales (cap 1 → 1 OK; cap 2 → 2 OK, 3ª `SLOT_TAKEN`); misma idempotency key ×5 → 1 fila.
- RLS/multi-tenant: peticiones directas con JWT de Taller A contra B; guest sin token; admin.
- E2E Playwright A–Z en móvil y escritorio.

## 12. Fases

0 Plan · 1 Diseño, home, routing · 2 Backend, auth, esquema, RLS, DEMO · 3 Onboarding, servicios, horario · 4 Disponibilidad · 5 Reserva atómica · 6 Panel y calendario · 7 Estados, cancelar, reprogramar, solicitudes · 8 Notificaciones · 9 Gestión por token · 10 IA · 11 Seguridad · 12 Tests · 13 Móvil/accesibilidad/rendimiento · 14 Admin y producción. Cada fase se prueba antes de seguir.

## 13. Riesgos residuales

1. **Email**: sin dominio de envío verificado no saldrán correos; reservas funcionan y quedan registradas, pero el cliente depende del enlace mostrado en pantalla.
2. **Cron**: expiración y recordatorios dependen de `pg_cron`; si falla, las lecturas tratan pending vencidas como expiradas, pero los recordatorios se retrasan.
3. **Lock por taller**: serializa reservas del mismo taller; aceptable con volumen MVP, a revisar con talleres de alto tráfico.
4. **Pending no bloquea**: dos clientes pueden solicitar la misma hora; se mitiga con `needs_attention`, pero el taller debe actuar.
5. **Token en URL**: quien tenga el enlace gestiona la cita (riesgo de reenvío/historial); mitigado con caducidad y solo lectura en terminales.
6. **Sin verificación de email/teléfono** del guest: posibles reservas falsas; el rate limiting básico (IP hasheada + email) frena abuso simple, no ataques distribuidos.
9. **Token generado en navegador**: depende de `crypto.getRandomValues` (disponible en todos los navegadores soportados); si el usuario cierra la pestaña antes de ver la confirmación y no hay email, pierde el enlace (el taller conserva la cita).
10. **Rate limit a medida**: no es una primitiva estándar de la plataforma; contadores en BD añaden una escritura por petición.
7. **DST**: horas inexistentes/duplicadas (02:00–03:00) se resuelven con `AT TIME ZONE`; probado, pero talleres no abren a esas horas en la práctica.
8. **IA**: clasificación puede fallar; siempre cae a `other` y el usuario elige manualmente.
