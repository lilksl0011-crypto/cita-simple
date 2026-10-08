# Cita Simple

CITAMOTOR — MASTER PRODUCT & ENGINEERING SPECIFICATION

0. INSTRUCCIÓN PRINCIPAL

Quiero construir una aplicación web SaaS llamada provisionalmente "CitaMotor".

No trates este proyecto como una landing page ni como un simple prototipo visual.

Debe construirse como un MVP funcional y preparado para producción temprana, con frontend, backend, base de datos, autenticación, autorización, motor de disponibilidad y reservas.

IMPORTANTE:

Antes de implementar código:

Analiza toda esta especificación.

Crea un plan técnico detallado.

Identifica contradicciones, riesgos, casos límite y decisiones técnicas necesarias.

Comprueba específicamente el flujo de reservas, disponibilidad, concurrencia, permisos y fechas/horas.

Presenta el plan de implementación por fases.

No simplifiques silenciosamente requisitos críticos.

Si existe una decisión ambigua pero no bloqueante, elige la opción más segura y sencilla para el MVP y documenta la decisión.

No introduzcas funcionalidades fuera del alcance.

Una vez aprobado el plan, implementa por fases y prueba cada fase antes de continuar.

No optimices para cantidad de funcionalidades.

Optimiza para:

fiabilidad

simplicidad

velocidad

facilidad de uso

seguridad

ausencia de double-booking

experiencia móvil

facilidad de mantenimiento

El objetivo principal del producto es que un cliente pueda reservar una cita rápidamente y que un taller pueda gestionarla sin esfuerzo.

1. PRODUCTO

CitaMotor es un SaaS para talleres de automoción.

El producto permite a un taller:

crear su perfil;

configurar servicios;

configurar horarios;

definir disponibilidad/capacidad;

recibir reservas;

recibir solicitudes de cita;

confirmar;

modificar;

cancelar;

reprogramar;

marcar citas como completadas;

registrar no-show;

enviar recordatorios;

mantener una página pública de reservas.

El producto también permite a un conductor:

seleccionar un servicio;

seleccionar un taller;

consultar horarios;

reservar;

solicitar una cita;

cancelar;

reprogramar;

recibir confirmaciones y recordatorios;

sin necesidad de crear una cuenta previamente.

El marketplace completo NO es el objetivo del MVP.

El taller es el cliente principal del SaaS.

2. PROPUESTA DE VALOR

Para el taller:

"Menos llamadas. Menos citas perdidas. Más control."

Para el cliente:

"Tu cita. Sin llamadas."

La aplicación debe transmitir rapidez y sencillez.

No utilizar lenguaje corporativo innecesario.

No utilizar textos largos.

No convertir el producto en un chatbot.

3. MERCADO INICIAL

La aplicación comienza en Ibiza, España.

No codificar Ibiza como una excepción técnica.

La arquitectura debe permitir posteriormente:

Mallorca

Menorca

Formentera

resto de España

otros países

Zona horaria inicial:

Europe/Madrid

Todas las fechas y horas deben manejarse correctamente con zonas horarias.

La base de datos debe utilizar timestamps con zona horaria cuando corresponda.

No utilizar fechas/horas locales sin contexto de zona horaria para reservas.

4. STACK

Utilizar:

Frontend:
React / TypeScript según la configuración estándar de Lovable.

Backend:
Supabase.

Base de datos:
PostgreSQL mediante Supabase.

Autenticación:
Supabase Auth.

Backend sensible:
Supabase Edge Functions o funciones SQL/RPC cuando sea apropiado.

No colocar secretos ni claves privadas en el frontend.

La arquitectura debe separar claramente:

frontend

lógica de negocio

base de datos

autenticación

integraciones externas

5. PRINCIPIO "DATABASE IS THE SOURCE OF TRUTH"

Este es un requisito crítico.

La interfaz puede mostrar disponibilidad, pero la interfaz NUNCA decide por sí sola si una reserva es válida.

La disponibilidad definitiva debe comprobarse en backend/base de datos justo antes de crear o modificar una reserva.

No confiar en:

estado local de React

caches del navegador

una comprobación previa sin transacción

botones deshabilitados

lógica únicamente frontend

Todos ellos son ayudas UX, no mecanismos de integridad.

6. OBJETIVO UX

El usuario debe poder pasar de:

"Necesito una cita"

a:

"Cita confirmada"

con el mínimo número de pasos.

Flujo ideal:

Inicio
→ Servicio
→ Taller/ubicación
→ Día
→ Hora
→ Datos mínimos
→ Confirmar
→ Éxito

No obligar a crear una cuenta antes de reservar.

No pedir datos innecesarios.

No mostrar onboarding al cliente.

No mostrar tutoriales.

No introducir un chatbot obligatorio.

7. HOME

Título principal:

"Tu cita. Sin llamadas."

Subtítulo:

"Reserva en un taller de forma rápida y sencilla."

CTA principal:

"Reservar cita"

Servicios principales:

Neumáticos

Cambio de aceite

Revisión

Batería

Frenos

ITV

Diagnóstico

Otro

La página debe estar diseñada mobile-first.

El usuario debe comprender en pocos segundos qué puede hacer.

8. PÁGINA PÚBLICA DEL TALLER

Cada taller tendrá una URL pública:

/taller/{slug}

Mostrar:

nombre

ubicación

información básica

horario

servicios

precio orientativo

disponibilidad

CTA "Reservar cita"

El enlace debe funcionar independientemente del marketplace.

La futura estrategia del producto permitirá que el taller utilice esta URL desde sus propios canales, incluyendo Google Business Profile.

9. MODELOS DE SERVICIO

Cada servicio debe tener:

id

workshop_id

name

description

price_type

price_from

duration_minutes

buffer_minutes

booking_mode

active

price_type:

fixed

from

quote

booking_mode:

instant

request

Reglas:

Un servicio "instant" debe tener una duración definida.

Un servicio "request" puede utilizarse cuando la duración o resultado no sean suficientemente predecibles.

No permitir que la IA decida arbitrariamente el precio.

No presentar un precio "desde" como precio final garantizado.

En el momento de reservar, mostrar claramente si el precio es:

fijo

orientativo

sujeto a valoración

10. HORARIOS DEL TALLER

Crear configuración de horario semanal:

lunes

martes

miércoles

jueves

viernes

sábado

domingo

Cada día puede tener uno o varios intervalos.

Ejemplo:

08:00–13:00
15:00–19:00

No obligar al taller a introducir cada slot manualmente.

El motor debe calcular los horarios disponibles.

Crear además:

workshop_closures

Para:

vacaciones

festivos

cierres excepcionales

días especiales

Una fecha cerrada tiene prioridad sobre el horario semanal.

11. CAPACIDAD

Un taller puede procesar más de un vehículo simultáneamente.

Cada taller tendrá:

capacity_per_slot

como capacidad lógica inicial.

Ejemplo:

capacity = 2

Dos reservas compatibles pueden existir simultáneamente.

La lógica de capacidad debe ejecutarse en backend.

No asumir que un taller solo puede tener una cita a la vez.

No asumir todavía un sistema complejo de mecánicos individuales.

La arquitectura debe poder ampliarse posteriormente a:

mecánicos

boxes

elevadores

recursos

especialidades

12. INTERVALO DE GENERACIÓN DE HORARIOS

No obligar al taller a configurar cientos de horas.

Cada taller podrá tener un intervalo de inicio de citas:

15
30
60 minutos

Por defecto:

30 minutos.

El frontend mostrará únicamente horarios realmente válidos.

El intervalo de inicio NO significa que las citas duren necesariamente ese intervalo.

La duración pertenece al servicio.

Ejemplo:

slot interval:
30 min

service duration:
45 min

Es válido crear:

16:00–16:45

si las reglas de disponibilidad lo permiten.

13. REGLAS DE DISPONIBILIDAD

Un horario solo puede aparecer disponible si:

El taller está activo.

El servicio está activo.

El día está dentro del horizonte permitido.

El día no está cerrado.

La hora está dentro del horario de apertura.

La hora no cae dentro de un descanso/cierre.

La duración completa del servicio cabe antes del cierre.

Se cumple el tiempo mínimo de antelación.

No supera el horizonte máximo de reserva.

La capacidad disponible es suficiente.

No existe una reserva incompatible.

El servicio puede realizarse online.

La fecha/hora no está en el pasado.

Añadir configuración de:

min_lead_time_minutes

max_booking_horizon_days

Ejemplo inicial:

min_lead_time_minutes = 60

max_booking_horizon_days = 30

Estos valores deben ser configurables por taller posteriormente.

14. PROBLEMA CRÍTICO: CONCURRENCIA

Debemos asumir este caso:

Cliente A ve:
16:00 disponible.

Cliente B ve:
16:00 disponible.

Ambos pulsan "Confirmar" prácticamente al mismo tiempo.

La aplicación debe permitir únicamente las reservas válidas según la capacidad.

NO basta con comprobar disponibilidad antes de insertar.

Implementar una operación de backend atómica para crear la reserva.

La comprobación y creación deben ejecutarse de forma segura frente a concurrencia.

Utilizar PostgreSQL de forma que la integridad no dependa del frontend.

Evaluar y utilizar, cuando sea apropiado:

timestamptz

tstzrange

índices adecuados

exclusion constraints

transacciones

row locking

función RPC específica para booking

La implementación debe soportar correctamente la capacidad > 1.

Documentar cómo se evita el double-booking.

15. MODELO TEMPORAL DE RESERVAS

Las reservas deben guardar:

start_at

end_at

como timestamps con zona horaria.

Utilizar intervalo semiabierto:

[start_at, end_at)

Dos citas:

16:00–17:00
17:00–18:00

no deben considerarse solapadas.

Dos citas:

16:00–17:00
16:30–17:30

sí deben considerarse solapadas.

La lógica debe seguir este modelo.

16. SNAPSHOT DE LA RESERVA

Una reserva debe guardar una copia histórica de los datos relevantes en el momento de reservar.

Por ejemplo:

service_name_snapshot

duration_snapshot_minutes

price_snapshot

price_type_snapshot

Si el taller cambia posteriormente:

nombre del servicio

duración

precio

eso NO debe modificar retrospectivamente una reserva ya creada.

17. ESTADOS DE RESERVA

Estados permitidos:

pending
confirmed
cancelled
rescheduled
completed
no_show
expired
declined

Implementar una máquina de estados.

No permitir transiciones arbitrarias.

Ejemplo:

pending
→ confirmed
→ completed

pending
→ declined

pending
→ expired

confirmed
→ cancelled

confirmed
→ rescheduled

confirmed
→ completed

confirmed
→ no_show

Una reserva completada no debe poder volver accidentalmente a pending.

Registrar cambios de estado.

18. IDEMPOTENCIA

Evitar reservas duplicadas causadas por:

doble clic

pulsaciones repetidas

refresco

reenvío de formularios

reintento de red

El botón de confirmación debe bloquearse durante el envío.

Pero además:

La operación backend debe ser idempotente.

Crear un idempotency_key por intento de reserva y garantizar que el mismo intento no genere dos reservas.

19. SLOT OBSOLETO

Caso obligatorio:

El cliente está viendo:

16:00
17:00
18:00

Otra persona ocupa 16:00.

El primer cliente pulsa:

16:00.

La aplicación NO debe mostrar:

"Error inesperado."

Debe mostrar:

"Esa hora acaba de ocuparse."

Y automáticamente cargar alternativas actualizadas:

17:00
18:00

Este flujo debe estar diseñado explícitamente.

20. CAMBIOS DURANTE LA RESERVA

Si entre la selección y la confirmación:

el taller cierra;

el servicio se desactiva;

cambia la duración;

cambia la disponibilidad;

el horario se bloquea;

el backend debe volver a validar.

Si la reserva ya no es válida:

No crearla.

Mostrar un mensaje útil.

Nunca confirmar una cita inválida.

21. RESERVA INSTANTÁNEA

Para booking_mode="instant":

El cliente selecciona servicio.

El cliente selecciona fecha.

El sistema obtiene disponibilidad.

El cliente selecciona hora.

Introduce datos mínimos.

Backend revalida.

Backend crea la reserva de forma atómica.

Se confirma.

Se registra evento.

Se programa notificación.

22. SOLICITUD DE CITA

Para booking_mode="request":

Cliente elige una preferencia.

Se crea pending.

Se crea response_deadline_at.

El taller recibe la solicitud.

El taller puede:

confirmar

proponer otra hora

rechazar

Si no responde dentro del plazo:

pending
→ expired

El cliente recibe alternativa o puede buscar otro taller.

Si la solicitud se realiza fuera del horario de apertura:

La interfaz debe indicar claramente cuándo comenzará a contar el tiempo de respuesta.

Nunca prometer una respuesta inmediata si el taller está cerrado.

23. DEADLINE INTELIGENTE

No asumir simplemente "2 horas" en todos los casos.

Implementar conceptualmente:

request SLA

workshop opening hours

response_deadline_at

Si el taller está cerrado cuando llega una solicitud:

El deadline debe calcularse respetando la próxima ventana operativa del taller.

Mostrar al cliente una expectativa honesta.

Nunca mostrar:

"Respuesta en 2 horas"

si el taller está cerrado durante esas dos horas.

24. CANCELACIÓN

Implementar:

cancellation_window_minutes

El taller podrá configurar la ventana de cancelación posteriormente.

El MVP puede permitir cancelaciones sin penalización.

Si el cliente cancela:

actualizar estado

registrar evento

liberar capacidad

notificar al taller

mostrar confirmación al cliente

25. REPROGRAMACIÓN

La reprogramación debe ser segura.

No crear primero la nueva cita y dejar la antigua abierta.

No liberar primero la antigua si la nueva puede fallar.

Realizar la operación de forma transaccional cuando sea posible.

Debe garantizarse que:

la cita original no desaparezca accidentalmente

el nuevo horario esté disponible

no se produzca double booking

exista histórico del cambio

Registrar booking_event.

26. CLIENTE SIN CUENTA

Permitir reservar como guest.

No obligar a crear cuenta.

Para gestionar una reserva sin cuenta:

Crear un mecanismo seguro mediante token aleatorio de alta entropía.

Guardar solo el hash del token cuando sea apropiado.

El enlace permitirá:

consultar cita

cancelar

reprogramar

El token debe:

ser impredecible

tener caducidad razonable

no exponer datos sensibles en la URL

invalidarse cuando corresponda

No mostrar información privada de otros clientes.

27. AUTENTICACIÓN

Utilizar Supabase Auth para:

talleres

administradores

clientes que quieran cuenta

Los guests no necesitan autenticación completa para reservar.

Separar claramente:

customer
workshop
admin

No utilizar role únicamente en frontend.

La autorización debe estar reforzada en backend/RLS.

28. RLS / MULTI-TENANCY

La aplicación es multi-tenant por taller.

Un taller A no puede:

leer reservas del taller B

editar servicios del taller B

modificar horarios del taller B

leer información privada del taller B

Un cliente no puede leer:

clientes de otros usuarios

reservas de otros usuarios

datos privados de otros talleres

Admin sí puede gestionar el sistema.

Las políticas de RLS deben estar diseñadas explícitamente.

No confiar solo en filtros frontend.

29. TABLAS

Crear como mínimo:

profiles
workshops
services
workshop_hours
workshop_closures
blocked_times
bookings
vehicles
notifications
booking_events

Evaluar tablas adicionales solo si son necesarias para resolver correctamente la lógica.

30. PROPIEDAD DE DATOS

workshops.owner_id → profiles.id

services.workshop_id → workshops.id

bookings.workshop_id → workshops.id

bookings.service_id → services.id

bookings.customer_id puede ser nullable para guest

vehicles.customer_id puede ser nullable según diseño de guest

No crear relaciones circulares innecesarias.

31. BOOKING EVENTS

Crear historial de eventos:

booking_events

Campos conceptuales:

id

booking_id

event_type

actor_type

actor_id nullable

metadata

created_at

Ejemplos:

created
confirmed
declined
expired
cancelled_by_customer
cancelled_by_workshop
rescheduled
completed
no_show
reminder_sent

Esto servirá para debugging, auditoría y soporte.

32. NOTIFICACIONES

Crear arquitectura de notificaciones:

email
whatsapp
sms

Pero en el MVP implementar únicamente email si la integración está disponible.

No bloquear la arquitectura futura.

Crear estados:

queued
sent
failed
cancelled

Registrar:

provider

provider_message_id si existe

error_message

sent_at

No hacer que un fallo de email invalide una reserva ya confirmada.

La reserva y la notificación son procesos separados.

33. RECORDATORIOS

Preparar:

confirmación inmediata

recordatorio 48 horas antes

recordatorio 24 horas antes

aviso de cancelación

aviso de reprogramación

La reserva debe existir aunque un proveedor de email esté temporalmente caído.

La notificación puede reintentarse.

34. NO-SHOW

El taller puede marcar:

no_show

No asignar automáticamente no-show únicamente porque haya pasado la hora.

Solo el taller o una regla explícita posteriormente podrá marcarlo.

Registrar quién lo marcó.

35. REBOOKING

Después de completed:

Preparar arquitectura para recordatorios posteriores.

No implementar recomendaciones mecánicas inventadas por IA.

El recordatorio debe basarse en datos configurados por el taller o reglas de servicio.

36. IA

La IA tiene una responsabilidad limitada.

Su función inicial es clasificar texto libre del usuario.

Ejemplo:

"Necesito cambiar las ruedas delanteras."

Resultado estructurado:

{
service_category: "tyres",
quantity: 2
}

Ejemplo:

"El coche hace un ruido cuando freno."

Resultado:

{
service_category: "brake_diagnosis",
booking_mode: "request"
}

La IA NO puede inventar:

disponibilidad

precios

horarios

nombres de talleres

confirmaciones

diagnósticos definitivos

La disponibilidad siempre procede de la base de datos.

La IA debe responder utilizando categorías controladas.

Si no puede clasificar con confianza:

service_category = "other"

No ejecutar llamadas peligrosas ni acciones de reserva basándose únicamente en texto generado por la IA.

Las claves de la API de IA deben permanecer en backend/Edge Function.

No enviar secretos al navegador.

37. PROMPT INJECTION / IA

El texto escrito por el usuario debe considerarse contenido no confiable.

No permitir que instrucciones incluidas dentro de ese texto modifiquen reglas del sistema.

La IA debe producir exclusivamente el esquema estructurado definido.

Validar el resultado contra una lista permitida.

Si el JSON generado no cumple el esquema:

descartar resultado
→ fallback seguro

38. EXPERIENCIA DE ERROR

Nunca dejar al usuario en una pantalla muerta.

Cada error debe tener una acción útil.

Ejemplos:

Sin talleres:

"No encontramos talleres disponibles para esa búsqueda."

Acciones:

Cambiar fecha

Cambiar servicio

Ver otros talleres

Sin horarios:

"No hay horas disponibles ese día."

Acciones:

Siguiente día

Otra fecha

Solicitar cita

Horario ocupado durante confirmación:

"Esa hora acaba de ocuparse."

Acciones:

Ver siguientes horas

Error de red:

"No hemos podido completar la reserva."

Acción:
"Reintentar"

Nunca perder silenciosamente los datos ya introducidos.

39. ESTADOS DE CARGA

Implementar:

skeletons

loading buttons

disabled states

empty states

error states

success states

No mostrar una pantalla vacía mientras una consulta tarda.

El usuario debe saber si el sistema está trabajando.

40. FECHAS Y HORAS: CASOS LÍMITE

Probar explícitamente:

hoy

mañana

fin de mes

cambio de mes

cambio de año

horario de verano/invierno

día cerrado

cierre parcial

cita que termina exactamente al cerrar

cita que supera el cierre

reserva en la primera hora del día

reserva en la última hora posible

fecha pasada

No permitir seleccionar fechas pasadas.

41. DURACIONES Y BUFFER

Un servicio puede tener:

duration_minutes

y opcionalmente:

buffer_minutes

Ejemplo:

Cambio de neumáticos:
duration = 60
buffer = 15

El sistema debe considerar ambos para la ocupación del recurso/capacidad.

42. PRECIO

No mostrar precios inventados.

price_type:

fixed
from
quote

Si fixed:

mostrar precio.

Si from:

"Desde X €"

Si quote:

"Precio a confirmar por el taller."

No asumir que una reparación compleja puede contratarse con precio definitivo.

43. DATOS DEMO

Crear datos de prueba claramente marcados como DEMO.

No inventar negocios reales y mostrarlos como clientes reales.

No utilizar datos reales personales.

Crear:

3 talleres demo

varios servicios

diferentes horarios

diferentes capacidades

cierres

reservas

solicitudes

cancelaciones

para poder probar los flujos.

44. PANEL DEL TALLER

Navegación:

Inicio
Calendario
Citas
Servicios
Horario
Clientes
Configuración

INICIO:

citas de hoy

solicitudes pendientes

próximas citas

cancelaciones recientes

No hacer un dashboard saturado de estadísticas.

45. CALENDARIO

Mostrar:

día

semana

Las citas deben mostrar:

hora

cliente

servicio

estado

El calendario debe respetar Europe/Madrid para talleres de Ibiza.

46. CONFIGURACIÓN DE TALLER

Permitir:

nombre

descripción

teléfono

email

dirección

localidad

código postal

horarios

capacidad

servicios

política de cancelación futura

Mantener configuración sencilla.

47. ONBOARDING DE TALLER

Objetivo:

configurar un taller en aproximadamente 2 minutos.

Pasos:

Nombre

Ubicación

Horario

Capacidad

Servicios

No mostrar formularios interminables.

Permitir guardar y continuar.

48. MOBILE FIRST

La mayoría de clientes utilizarán probablemente móvil.

Optimizar específicamente:

botones táctiles

formularios

calendario

selección de hora

mensajes de error

sticky CTA cuando proceda

Comprobar tamaños de pantalla pequeños.

No limitarse a escalar el diseño desktop.

49. ACCESIBILIDAD

Implementar como mínimo:

labels correctos

contraste adecuado

foco de teclado

botones semánticos

navegación comprensible

mensajes de error asociados a campos

soporte de lectores de pantalla razonable

50. RENDIMIENTO

Priorizar:

carga rápida

consultas eficientes

índices apropiados

evitar consultas repetidas

evitar cargar todos los talleres innecesariamente

imágenes optimizadas

componentes ligeros

No añadir librerías innecesarias.

51. SEO BÁSICO

Crear metadata básica para:

home

páginas públicas de talleres

Las URLs deben ser limpias.

El nombre del taller debe poder aparecer en metadata.

No bloquear indexación accidentalmente en producción.

Las páginas privadas sí deben estar protegidas y fuera de indexación.

52. ADMIN

Crear un panel admin separado.

Funciones:

talleres

usuarios

reservas

servicios

notificaciones

incidencias

estadísticas básicas

Admin puede:

activar/desactivar talleres

revisar reservas

revisar incidencias

consultar actividad

No crear herramientas de administración innecesarias.

53. OBSERVABILIDAD

Crear mecanismos para poder detectar:

errores de reservas

fallos de notificaciones

fallos de autenticación

operaciones RPC fallidas

reservas rechazadas por conflicto

Los errores técnicos deben quedar registrados sin almacenar secretos.

Crear mensajes útiles para el administrador.

54. PRUEBAS AUTOMÁTICAS / E2E

Antes de declarar el MVP terminado, probar como mínimo:

A. Registro de taller
B. Login de taller
C. Configuración de servicio
D. Configuración de horario
E. Creación de reserva instantánea
F. Solicitud de cita
G. Confirmación
H. Rechazo
I. Cancelación cliente
J. Cancelación taller
K. Reprogramación
L. Completar cita
M. No-show
N. Slot ocupado
O. Double click
P. Dos usuarios reservando simultáneamente
Q. Servicio desactivado durante reserva
R. Taller cerrado durante reserva
S. Cierre especial
T. Horario que cruza cambio de día
U. Cambio de horario de verano/invierno
V. Permisos RLS
W. Cliente no accede a otros clientes
X. Taller no accede a otro taller
Y. Admin puede administrar
Z. Experiencia móvil

55. TEST ESPECIAL DE CONCURRENCIA

Este test es obligatorio.

Preparar dos solicitudes simultáneas para el mismo taller, servicio, fecha y hora.

Verificar:

Si capacidad = 1:

exactamente una debe confirmarse.

Si capacidad = 2:

hasta dos pueden confirmarse.

Una tercera debe rechazarse.

No debe existir un estado donde la interfaz diga que dos reservas están confirmadas cuando la capacidad real solo permite una.

56. TEST DE ACTUALIZACIÓN STALE

Caso:

Cliente A abre disponibilidad.

Cliente B reserva una hora.

Cliente A intenta reservar la misma hora.

Resultado:

Cliente A recibe un mensaje claro y nuevas alternativas.

No error genérico.

57. TEST DE SEGURIDAD MULTI-TENANT

Crear:

Taller A
Taller B

Comprobar que:

Taller A no puede leer ni modificar datos de Taller B.

Repetir usando solicitudes directas contra backend, no solo navegación normal.

No confiar en la UI.

58. TEST DE DATOS

Comprobar:

eliminar servicio

desactivar servicio

cambiar precio

cambiar duración

cerrar día

bloquear hora

Las reservas históricas deben conservar sus snapshots.

No permitir que cambios futuros destruyan datos históricos.

59. TEST DE NOTIFICACIONES

Si el email falla:

La reserva sigue existiendo.

La interfaz debe mostrar:

"Cita creada."

El fallo de notificación debe quedar registrado.

No crear una segunda reserva solo porque se reintente el envío.

60. TEST DE RED

Simular:

latencia

doble click

request timeout

error temporal

La aplicación no debe duplicar reservas.

61. SEGURIDAD

Realizar auditoría completa antes de publicar.

Comprobar:

RLS

auth

roles

ownership

guest booking

tokens

Edge Functions

secrets

inputs

SQL

XSS

acceso directo a URLs privadas

No colocar service role key en frontend.

No confiar en IDs proporcionados por el cliente.

Validar ownership en backend.

62. POLÍTICA DE CAMBIOS DEL PROYECTO

No introducir funcionalidades nuevas sin comprobar primero que:

no rompen reservas

no rompen RLS

no rompen UX

no rompen móvil

no crean nuevos estados inconsistentes

El sistema de reservas es la parte crítica.

Si existe conflicto entre una nueva función y la fiabilidad de reservas:

priorizar reservas.

63. FUERA DE ALCANCE DEL MVP

NO implementar todavía:

aplicación móvil nativa

marketplace avanzado

pagos

suscripciones

Stripe

WhatsApp Business API

SMS

mapas avanzados

sistema completo de mecánicos

inventario

facturación

presupuestos complejos

recogida/entrega de vehículos

programas de fidelización

publicidad

diagnóstico mecánico mediante IA

La arquitectura debe permitir añadir estas funciones posteriormente sin rehacer el núcleo.

64. REQUISITO DE DISEÑO

El producto debe parecer un servicio tecnológico profesional.

No debe parecer:

una plantilla genérica

un dashboard de administración

una web corporativa antigua

una demo de IA

Debe parecer un producto que un conductor utilizaría rápidamente desde un móvil.

65. REQUISITO DE SIMPLICIDAD

Siempre priorizar:

claridad

rapidez

confianza

disponibilidad

acción principal

Evitar:

menús innecesarios

popups

formularios excesivos

explicaciones largas

animaciones decorativas

66. PLAN DE IMPLEMENTACIÓN

Divide la construcción en estas fases:

FASE 0
Análisis y plan.

FASE 1
Sistema visual + home + routing.

FASE 2
Supabase + auth + esquema de datos.

FASE 3
Taller + onboarding + servicios + horarios.

FASE 4
Motor de disponibilidad.

FASE 5
Creación segura de reservas.

FASE 6
Dashboard + calendario.

FASE 7
Cancelación + reprogramación + máquina de estados.

FASE 8
Notificaciones.

FASE 9
Guest booking + gestión mediante token.

FASE 10
IA de clasificación.

FASE 11
Seguridad y RLS.

FASE 12
Testing exhaustivo.

FASE 13
Mobile + accesibilidad + rendimiento.

FASE 14
Preparación para producción.

No saltar directamente a funcionalidades secundarias.

67. CRITERIO PARA DECLARAR EL PROYECTO TERMINADO

El proyecto NO se considera terminado porque:

la web compila

la página se ve bien

existe una tabla de reservas

Se considera terminado únicamente cuando:

un taller puede configurarse;

un cliente puede reservar;

la disponibilidad es correcta;

no existe double-booking;

las solicitudes funcionan;

cancelaciones funcionan;

reprogramaciones funcionan;

recordatorios funcionan o quedan correctamente registrados;

los permisos funcionan;

los errores muestran alternativas;

móvil funciona;

los casos límite principales están probados;

la base de datos protege la integridad;

el proyecto tiene una estructura mantenible.

68. FORMA DE TRABAJAR DE LOVABLE

Antes de cada implementación compleja:

analiza dependencias;

identifica archivos afectados;

identifica tablas afectadas;

identifica políticas RLS afectadas;

identifica riesgos;

implementa;

prueba;

verifica regresiones.

No hagas cambios innecesarios en partes no relacionadas.

Mantén consistencia del proyecto.

No reemplaces una arquitectura funcional por una implementación más sencilla si reduce seguridad o integridad.

69. PRIMER RESULTADO QUE QUIERO

En la primera fase quiero que produzcas:

arquitectura de aplicación;

mapa de rutas;

modelo de datos;

modelo de estados;

estrategia de disponibilidad;

estrategia contra double-booking;

estrategia de autenticación;

estrategia de RLS;

estrategia de notificaciones;

estrategia de guest booking;

análisis de casos límite;

plan de pruebas;

plan de implementación por fases.

Después de ese análisis, continúa con la construcción según el plan.

No inventes funcionalidades no solicitadas.

Cuando exista una decisión técnica difícil, elige la alternativa que produzca el MVP más sencillo pero correcto.

El objetivo es construir un producto pequeño que funcione de verdad, no una demo grande que falle en reservas.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/60ad8e96-39b3-41a0-ad81-8db4ff377f3f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
