import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { CATEGORY_META, SERVICE_CATEGORIES } from "@/lib/catalog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CitaMotor — Tu cita en el taller. Sin llamadas." },
      { name: "description", content: "Reserva cita en un taller de forma rápida y sencilla: neumáticos, aceite, revisión, frenos, ITV y más." },
      { property: "og:title", content: "CitaMotor — Tu cita. Sin llamadas." },
      { property: "og:description", content: "Reserva en un taller de forma rápida y sencilla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="container-app pt-10 pb-8 sm:pt-20 sm:pb-12">
          <h1 className="text-4xl font-bold leading-[1.05] sm:text-6xl">
            Tu cita.
            <br />
            <span className="text-primary">Sin llamadas.</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            Reserva en un taller de forma rápida y sencilla.
          </p>
          <Button asChild variant="default" size="xl" className="mt-7 w-full sm:w-auto">
            <Link to="/reservar">
              Reservar cita <ArrowRight />
            </Link>
          </Button>
        </section>

        <section className="container-app pb-12" aria-labelledby="servicios">
          <h2 id="servicios" className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            ¿Qué necesitas?
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SERVICE_CATEGORIES.map((c) => {
              const { label, icon: Icon } = CATEGORY_META[c];
              return (
                <li key={c}>
                  <Link
                    to="/reservar"
                    search={{ servicio: c }}
                    className="tile flex min-h-24 flex-col justify-between p-4 transition-colors hover:border-primary hover:bg-accent"
                  >
                    <Icon className="size-6 text-primary" aria-hidden />
                    <span className="font-medium">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="border-t bg-secondary/50">
          <div className="container-app grid gap-6 py-10 sm:grid-cols-3">
            {[
              { icon: Clock, t: "Horas reales", d: "Solo ves horas que el taller tiene libres." },
              { icon: Smartphone, t: "Sin cuenta", d: "Reserva con tu nombre, email y teléfono." },
              { icon: ShieldCheck, t: "Precio claro", d: "Fijo, orientativo o a confirmar. Sin sorpresas." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="text-sm text-muted-foreground">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="container-app flex flex-wrap items-center justify-between gap-2 py-6 text-sm text-muted-foreground">
        <span>© CitaMotor</span>
        <Link to="/auth" className="hover:text-foreground">Menos llamadas. Más control. — Para talleres</Link>
      </footer>
    </div>
  );
}
