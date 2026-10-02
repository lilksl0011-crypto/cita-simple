import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Clock, ShieldCheck, Smartphone, Wrench, Car } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { CATEGORY_META, SERVICE_CATEGORIES } from "@/lib/catalog";
import { cn } from "@/lib/utils";

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

type Tab = "taller" | "desguace";

function Home() {
  const [tab, setTab] = useState<Tab>("taller");
  const navy = tab === "desguace";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="container-app pt-12 sm:pt-16">
          <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.5px] text-foreground sm:text-[44px]">
            Tu cita. Sin llamadas.
          </h1>
          <p className="mt-3 max-w-md text-lg leading-normal text-body">
            Reserva en un taller de forma rápida y sencilla.
          </p>

          <div role="tablist" aria-label="Tipo de servicio" className="mt-6 grid grid-cols-2">
            {([
              { id: "taller", label: "Taller", icon: Wrench },
              { id: "desguace", label: "Desguace", icon: Car },
            ] as const).map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex h-[52px] items-center justify-center gap-2 border-b-[3px] bg-background text-[17px] font-medium transition-colors duration-150",
                    active
                      ? cn("text-foreground", id === "taller" ? "border-primary" : "border-navy")
                      : "border-hairline text-muted-foreground hover:bg-hover-surface",
                  )}
                >
                  <Icon
                    className={cn("size-[22px]", active ? (id === "taller" ? "text-primary" : "text-navy") : "text-muted-foreground")}
                    aria-hidden
                  />
                  {label}
                </button>
              );
            })}
          </div>

          {navy ? (
            <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
              <label className="flex h-[52px] flex-1 overflow-hidden rounded-[10px] border-[1.5px] border-navy">
                <span aria-hidden className="grid w-[34px] place-items-center bg-navy text-sm font-semibold text-navy-foreground">E</span>
                <span className="sr-only">Matrícula</span>
                <input
                  placeholder="0000 BBB"
                  className="w-full bg-background px-3 text-lg font-medium uppercase tracking-[2px] text-foreground outline-none placeholder:text-subtle"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[10px] bg-navy px-6 text-base font-medium text-navy-foreground transition-colors duration-150 hover:bg-navy-hover"
              >
                Buscar <ArrowRight className="size-[18px]" aria-hidden />
              </button>
            </form>
          ) : (
            <Link
              to="/reservar"
              className="mt-6 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-6 text-base font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:brightness-90 sm:w-auto"
            >
              Reservar cita <ArrowRight className="size-[18px]" aria-hidden />
            </Link>
          )}
        </section>

        <section className="container-app pt-6 pb-8" aria-labelledby="servicios">
          <h2 id="servicios" className="mb-3 font-sans text-sm font-medium tracking-normal text-body">
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
                    className={cn(
                      "group flex min-h-[92px] flex-col justify-between rounded-xl border border-border bg-background p-3.5 transition-colors duration-150",
                      navy ? "hover:border-navy" : "hover:border-primary",
                    )}
                  >
                    <span className="flex items-start justify-between">
                      <Icon
                        className={cn(
                          "size-[26px] text-body transition-colors duration-150",
                          navy ? "group-hover:text-navy" : "group-hover:text-primary",
                        )}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <ChevronRight className="size-[18px] text-subtle" aria-hidden />
                    </span>
                    <span className="text-base font-medium text-foreground">
                      {c === "other" ? "Otro problema" : label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="bg-band">
          <div className="container-app grid gap-5 py-5 sm:grid-cols-3">
            {[
              { icon: Clock, t: "Horas reales", d: "Solo ves horas que el taller tiene libres." },
              { icon: Smartphone, t: "Sin cuenta", d: "Reserva con tu nombre, email y teléfono." },
              { icon: ShieldCheck, t: "Precio claro", d: "Fijo, orientativo o a confirmar. Sin sorpresas." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-3">
                <Icon className="size-[22px] shrink-0 text-body" aria-hidden />
                <div>
                  <p className="text-[15px] font-medium text-foreground">{t}</p>
                  <p className="text-sm text-body">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="container-app flex flex-wrap items-center justify-between gap-2 py-6 text-sm text-body">
        <span>© CitaMotor</span>
        <Link to="/auth" className="hover:text-foreground">Menos llamadas. Más control. — Para talleres</Link>
      </footer>
    </div>
  );
}
