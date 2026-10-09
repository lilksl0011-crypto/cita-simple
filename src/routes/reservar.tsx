import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { CATEGORY_META, SERVICE_CATEGORIES, isCategory } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  servicio: z.string().optional().transform((v) => (isCategory(v) ? v : undefined)),
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

function Reservar() {
  const { servicio } = Route.useSearch();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-app py-8">
        <p className="animate-fade-up text-sm font-medium text-muted-foreground">Paso 1 de 5</p>
        <h1 className="animate-fade-up mt-1 text-[30px] font-medium leading-tight">¿Qué servicio necesitas?</h1>
        <div role="radiogroup" aria-label="Servicio" className="animate-fade-up mt-5 flex flex-wrap gap-2" style={{ animationDelay: "160ms" }}>
          {SERVICE_CATEGORIES.map((c) => (
            <Link
              key={c}
              to="/reservar"
              search={{ servicio: c }}
              role="radio"
              aria-checked={servicio === c}
              className={cn(
                "rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
                servicio === c
                  ? "border-primary bg-primary text-primary-foreground shadow-cta"
                  : "bg-card shadow-soft hover:border-primary",
              )}
            >
              {CATEGORY_META[c].label}
            </Link>
          ))}
        </div>

        <section className="animate-fade-up mt-10" aria-live="polite" style={{ animationDelay: "280ms" }}>
          <h2 className="text-xl font-medium">Talleres</h2>
          <div className="tile mt-3 p-8 text-center">
            <p className="font-medium">Muy pronto verás aquí talleres con horas libres.</p>
            <p className="mt-1 text-sm text-muted-foreground">Estamos preparando las horas disponibles.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
