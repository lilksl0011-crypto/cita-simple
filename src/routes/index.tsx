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
        <section className="container-app pt-14 sm:pt-20">
          <h1 className="animate-fade-up text-[34px] font-medium leading-[1.08] tracking-[-0.02em] text-foreground sm:text-[52px]">
            Tu cita. Sin llamadas.
          </h1>
          <p className="animate-fade-up mt-4 max-w-md text-lg leading-relaxed text-body" style={{ animationDelay: "120ms" }}>
            Elige servicio, día y hora en tu taller.
          </p>

          <div role="tablist" aria-label="Tipo de servicio" className="animate-fade-up mt-8 grid grid-cols-2" style={{ animationDelay: "240ms" }}>
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
            <form className="animate-fade-up mt-6 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "360ms" }} onSubmit={(e) => e.preventDefault()}>
              <label className="flex h-[52px] flex-1 overflow-hidden rounded-xl border-[1.5px] border-navy shadow-soft">
                <span aria-hidden className="grid w-[34px] place-items-center bg-navy text-sm font-semibold text-navy-foreground">E</span>
                <span className="sr-only">Matrícula</span>
                <input
                  placeholder="0000 BBB"
                  className="w-full bg-background px-3 text-lg font-medium uppercase tracking-[2px] text-foreground outline-none placeholder:text-subtle"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-xl bg-navy px-6 text-base font-medium text-navy-foreground transition-colors duration-150 hover:bg-navy-hover"
              >
                Buscar <ArrowRight className="size-[18px]" aria-hidden />
              </button>
            </form>
          ) : (
            <Link
              to="/reservar"
              style={{ animationDelay: "360ms" }}
              className="animate-fade-up mt-6 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-cta transition-colors duration-150 hover:bg-primary-hover active:brightness-90 sm:w-auto"
            >
              Reservar cita <ArrowRight className="size-[18px]" aria-hidden />
            </Link>
          )}
        </section>

        <section className="container-app pt-8 pb-10" aria-labelledby="servicios">
          <h2 id="servicios" style={{ animationDelay: "440ms" }} className="animate-fade-up mb-4 font-sans text-sm font-semibold tracking-normal text-body">
            ¿Qué necesita tu coche?
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SERVICE_CATEGORIES.map((c, i) => {
              const { label, icon: Icon } = CATEGORY_META[c];
              return (
                <li key={c} className="animate-fade-up" style={{ animationDelay: `${480 + i * 50}ms` }}>
                  <Link
                    to="/reservar"
                    search={{ servicio: c }}
                    className={cn(
                      "group flex min-h-[96px] flex-col justify-between rounded-2xl border border-border bg-background p-4 shadow-soft transition-all duration-150 hover:shadow-lift",
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
                      {c === "other" ? "Otra consulta" : label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="border-y border-hairline bg-band">
          <div className="container-app grid gap-6 py-6 sm:grid-cols-3">
            {[
              { icon: Clock, t: "Horas reales", d: "Solo ves huecos libres del taller." },
              { icon: Smartphone, t: "Sin cuenta", d: "Solo nombre, email y teléfono." },
              { icon: ShieldCheck, t: "Precio claro", d: "Fijo, orientativo o a confirmar. Lo ves antes de reservar." },
            ].map(({ icon: Icon, t, d }, i) => (
              <div key={t} className="animate-fade-up flex gap-3" style={{ animationDelay: `${700 + i * 100}ms` }}>
                <Icon className="size-[22px] shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-[15px] font-semibold text-foreground">{t}</p>
                  <p className="text-sm text-body">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="container-app flex flex-wrap items-center justify-between gap-2 py-8 text-sm text-body">
        <span>© CitaMotor</span>
        <Link to="/auth" className="font-medium hover:text-foreground">¿Tienes un taller? Gestiona tus citas</Link>
      </footer>
    </div>
  );
}
