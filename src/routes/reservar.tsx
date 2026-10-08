import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_META, SERVICE_CATEGORIES, isCategory } from "@/lib/catalog";
import { formatDuration, formatPrice, type PriceType } from "@/lib/workshop";
import { cn } from "@/lib/utils";

// Todo el estado del flujo vive en la URL: servicio (categoría) → taller (slug) → servicio concreto (id) → fecha → hora (instante UTC).
const searchSchema = z.object({
  servicio: z.string().optional().transform((v) => (isCategory(v) ? v : undefined)),
  taller: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80).optional().catch(undefined),
  s: z.string().uuid().optional().catch(undefined),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  hora: z.string().max(40).optional().catch(undefined),
});

export const Route = createFileRoute("/reservar")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Reservar cita en un taller — CitaMotor" },
      { name: "description", content: "Elige servicio y taller y reserva tu cita en segundos." },
      { property: "og:title", content: "Reservar cita — CitaMotor" },
      { property: "og:description", content: "Elige servicio y taller y reserva tu cita en segundos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reservar,
});

type CatalogService = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price_type: PriceType;
  price_from: number | null;
  duration_minutes: number;
  booking_mode: "instant" | "request";
};
type CatalogWorkshop = {
  slug: string;
  name: string;
  city: string | null;
  address: string | null;
  timezone: string;
  is_demo: boolean;
  services: CatalogService[];
};

function todayIn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

// Suma días a una fecha "YYYY-MM-DD" sin zonas horarias (solo navegación de calendario, no es una regla de negocio).
function addDays(d: string, n: number): string {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

function Reservar() {
  const { servicio, taller, s, fecha, hora } = Route.useSearch();
  const navigate = useNavigate({ from: "/reservar" });

  const catalog = useQuery({
    queryKey: ["booking-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshops")
        .select("slug,name,city,address,timezone,is_demo,services(id,name,category,description,price_type,price_from,duration_minutes,booking_mode)")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as CatalogWorkshop[];
    },
  });

  const workshops = (catalog.data ?? [])
    .map((w) => ({ ...w, services: w.services.filter((x) => !servicio || x.category === servicio) }))
    .filter((w) => w.services.length > 0);

  const workshop = workshops.find((w) => w.slug === taller);
  const service = workshop?.services.find((x) => x.id === s);
  const tz = workshop?.timezone ?? "Europe/Madrid";
  const today = todayIn(tz);
  const date = fecha && fecha >= today ? fecha : today;

  // La disponibilidad la decide SIEMPRE la base de datos (get_availability → is_slot_bookable).
  const slots = useQuery({
    queryKey: ["availability", service?.id, date],
    enabled: !!service,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_availability", { _service_id: service!.id, _from: date, _to: date });
      if (error) throw error;
      return (data ?? []).map((r) => r.start_at);
    },
  });

  const timeFmt = new Intl.DateTimeFormat("es-ES", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const dayFmt = new Intl.DateTimeFormat("es-ES", { timeZone: tz, weekday: "long", day: "numeric", month: "long" });

  const go = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const chosen = hora && slots.data?.includes(hora) ? hora : undefined;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-app py-6">
        <p className="text-sm font-medium text-muted-foreground">Paso 1 de 5</p>
        <h1 className="mt-1 text-2xl font-bold">Elige el servicio</h1>
        <div role="radiogroup" aria-label="Servicio" className="mt-4 flex flex-wrap gap-2">
          {SERVICE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={servicio === c}
              onClick={() => go({ servicio: c, taller: undefined, s: undefined, fecha: undefined, hora: undefined })}
              className={cn(
                "rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
                servicio === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary",
              )}
            >
              {CATEGORY_META[c].label}
            </button>
          ))}
        </div>

        <section className="mt-8" aria-live="polite">
          <p className="text-sm font-medium text-muted-foreground">Paso 2 de 5</p>
          <h2 className="mt-1 text-lg font-semibold">Talleres</h2>
          {catalog.isLoading && <p className="mt-3 text-body">Cargando talleres…</p>}
          {catalog.error && <p role="alert" className="mt-3 text-destructive">No se pudieron cargar los talleres. Recarga la página.</p>}
          {catalog.data && workshops.length === 0 && (
            <div className="tile mt-3 p-6 text-center">
              <p className="font-medium">No hay talleres para este servicio todavía.</p>
              <p className="mt-1 text-sm text-muted-foreground">Prueba con otro servicio.</p>
            </div>
          )}
          <ul className="mt-3 space-y-3">
            {workshops.map((w) => {
              const open = w.slug === taller;
              return (
                <li key={w.slug} className={cn("tile p-4", open && "border-primary")}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => go({ taller: open ? undefined : w.slug, s: undefined, fecha: undefined, hora: undefined })}
                    className="flex w-full flex-col items-start text-left"
                  >
                    <span className="font-semibold">{w.name}</span>
                    <span className="text-sm text-muted-foreground">{[w.address, w.city].filter(Boolean).join(", ")}</span>
                    {w.is_demo && <span className="mt-1 text-xs text-muted-foreground">Taller de demostración · datos ficticios</span>}
                  </button>

                  {open && (
                    <div className="mt-3 space-y-2" role="radiogroup" aria-label="Servicio del taller">
                      {w.services.map((x) => (
                        <button
                          key={x.id}
                          type="button"
                          role="radio"
                          aria-checked={s === x.id}
                          onClick={() => go({ s: x.id, fecha: undefined, hora: undefined })}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                            s === x.id ? "border-primary bg-primary/5" : "bg-card hover:border-primary",
                          )}
                        >
                          <span>
                            <span className="block font-medium">{x.name}</span>
                            <span className="block text-sm text-muted-foreground">
                              {[formatDuration(x.duration_minutes), x.booking_mode === "request" ? "Por solicitud" : "Confirmación inmediata"].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="whitespace-nowrap text-sm font-medium">{formatPrice(x.price_type, x.price_from)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {workshop && service && (
          <section className="mt-8" aria-live="polite">
            <p className="text-sm font-medium text-muted-foreground">Paso 3 de 5</p>
            <h2 className="mt-1 text-lg font-semibold">Elige día y hora</h2>

            <div className="mt-3 flex items-center gap-2">
              <Button type="button" variant="outline" disabled={date <= today} onClick={() => go({ fecha: addDays(date, -1), hora: undefined })} aria-label="Día anterior">←</Button>
              <Input
                type="date"
                className="min-h-12 max-w-48"
                min={today}
                value={date}
                onChange={(e) => e.target.value && go({ fecha: e.target.value, hora: undefined })}
                aria-label="Fecha"
              />
              <Button type="button" variant="outline" onClick={() => go({ fecha: addDays(date, 1), hora: undefined })} aria-label="Día siguiente">→</Button>
            </div>
            <p className="mt-2 text-sm capitalize text-muted-foreground">{dayFmt.format(new Date(`${date}T12:00:00Z`))} · hora de {workshop.name}</p>

            {slots.isLoading && <p className="mt-4 text-body">Buscando horas disponibles…</p>}
            {slots.error && <p role="alert" className="mt-4 text-destructive">No se pudo consultar la disponibilidad. Inténtalo de nuevo.</p>}
            {slots.data && slots.data.length === 0 && (
              <div className="tile mt-4 p-4">
                <p className="font-medium">No hay horas disponibles este día.</p>
                <p className="mt-1 text-sm text-muted-foreground">Prueba con otro día.</p>
              </div>
            )}
            {slots.data && slots.data.length > 0 && (
              <div role="radiogroup" aria-label="Horas disponibles" className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.data.map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    role="radio"
                    aria-checked={chosen === iso}
                    onClick={() => go({ fecha: date, hora: iso })}
                    className={cn(
                      "min-h-12 rounded-xl border text-sm font-medium transition-colors",
                      chosen === iso ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary",
                    )}
                  >
                    {timeFmt.format(new Date(iso))}
                  </button>
                ))}
              </div>
            )}

            {chosen && (
              <div className="tile mt-6 p-4" role="status">
                <p className="font-semibold">{service.name} · {workshop.name}</p>
                <p className="mt-1 capitalize">{dayFmt.format(new Date(chosen))}, {timeFmt.format(new Date(chosen))}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Los pasos 4 y 5 (tus datos y la confirmación) llegan en la siguiente fase. Todavía no se ha reservado nada.
                </p>
                <Button className="mt-3 w-full" size="xl" disabled>Continuar (próximamente)</Button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
